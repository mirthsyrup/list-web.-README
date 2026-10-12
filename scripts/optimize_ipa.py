"""Remove only proven inline duplicates from this application's sideload IPA.

Keep the native executable and ios-entry.html byte for byte. Refuse IPAs with
resource signing/provisioning, which must be rebuilt and signed normally.
"""
from __future__ import annotations

import argparse
import base64
import copy
import hashlib
from html.parser import HTMLParser
import json
import mimetypes
from pathlib import Path
import struct
import zipfile


class InlineContent(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.scripts, self.styles = [], []
        self.active, self.parts = None, []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            if dict(attrs).get("src"):
                raise ValueError("The iOS entry still depends on an external script")
            self.active, self.parts = tag, []

    def handle_data(self, data):
        if self.active:
            self.parts.append(data)

    def handle_endtag(self, tag):
        if tag == self.active:
            target = self.scripts if tag == "script" else self.styles
            target.append("".join(self.parts))
            self.active = None


def assert_no_resource_signature(native: bytes):
    if struct.unpack_from("<I", native)[0] != 0xFEEDFACF:
        raise ValueError("Expected a thin ARM64 Mach-O executable")
    ncmds = struct.unpack_from("<I", native, 16)[0]
    offset = 32
    for _ in range(ncmds):
        command, size = struct.unpack_from("<II", native, offset)
        if size < 8 or offset + size > len(native):
            raise ValueError("Invalid Mach-O load command")
        if command == 0x1D:
            start, length = struct.unpack_from("<II", native, offset + 8)
            signature = native[start:start + length]
            magic, total, count = struct.unpack_from(">III", signature)
            if magic != 0xFADE0CC0 or total > len(signature):
                raise ValueError("Unknown native signature format")
            found = False
            for index in range(count):
                slot, position = struct.unpack_from(">II", signature, 12 + index * 8)
                if slot == 0x10000:
                    raise ValueError("A distribution signature needs normal re-signing")
                if slot == 0 or 0x1000 <= slot <= 0x1005:
                    cd = signature[position:]
                    fields = struct.unpack_from(">9I", cd)
                    if fields[0] != 0xFADE0C02:
                        raise ValueError("Unknown CodeDirectory")
                    flags, special_slots = fields[3], fields[6]
                    if not flags & 2 or special_slots:
                        raise ValueError("The executable binds signed bundle resources")
                    found = True
            if not found:
                raise ValueError("No verifiable ad-hoc CodeDirectory")
        offset += size


def optimize(source: Path, destination: Path):
    if source.resolve() == destination.resolve():
        raise ValueError("Write a new file; do not overwrite the original")
    if destination.exists():
        raise ValueError("Destination already exists")
    with zipfile.ZipFile(source) as original:
        names = original.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Duplicate archive paths")
        entries = [n for n in names if n.endswith("/web/ios-entry.html")]
        if len(entries) != 1:
            raise ValueError("Expected one self-contained iOS entry")
        entry = entries[0]
        bundle = entry.removesuffix("web/ios-entry.html")
        web = bundle + "web/"
        if any("_CodeSignature/" in n or n.endswith("embedded.mobileprovision")
               for n in names):
            raise ValueError("Signed IPA: rebuild and re-sign rather than deleting resources")
        native = original.read(bundle + "List")
        assert_no_resource_signature(native)
        if b"ios-entry.html" not in native or b"index.html" in native:
            raise ValueError("Cannot prove that the native app only opens ios-entry.html")
        html = original.read(entry).decode("utf-8")
        parsed = InlineContent()
        parsed.feed(html)
        if not parsed.scripts or not parsed.styles:
            raise ValueError("Missing inline code/styles")

        removed = {}
        for name in names:
            if not name.startswith(web):
                continue
            relative = name[len(web):]
            if relative.endswith(".js") and relative != "sw.js":
                script = original.read(name).decode().replace("</script", "<\\/script")
                if script not in parsed.scripts:
                    raise ValueError("Script is not fully inlined: " + relative)
                removed[name] = "exact inline JavaScript copy"

        # Preserve icons, manifest, SVGs and all legal notices. Only paper images
        # proven to exist as identical embedded bytes are candidates for removal.
        papers = [n for n in names if n.startswith(web + "assets/paper-")
                  and n.endswith(".jpg")]
        for name in papers:
            data_uri = "data:image/jpeg;base64," + base64.b64encode(
                original.read(name)).decode()
            if data_uri not in html:
                raise ValueError("Paper texture is not embedded: " + name)
            removed[name] = "identical paper texture embedded in CSS"

        for relative in ("style.css", "desktop.css"):
            name = web + relative
            if name not in names:
                continue
            css = original.read(name).decode()
            import re
            def inline_asset(match):
                path = web + match.group(1)
                mime = mimetypes.guess_type(path)[0]
                if not mime or path not in names:
                    raise ValueError("Missing CSS asset: " + path)
                return 'url("data:' + mime + ';base64,' + base64.b64encode(
                    original.read(path)).decode() + '")'
            inline_css = re.sub(r'url\("([^"]+)"\)', inline_asset, css)
            if inline_css not in parsed.styles:
                raise ValueError("Stylesheet differs from its inline copy: " + relative)
            removed[name] = "exact stylesheet with embedded assets"

        # These two alternative web entry/cache files are never used by the
        # native file:// entry and would reference the removed duplicate files.
        for relative in ("index.html", "sw.js"):
            name = web + relative
            if name in names:
                removed[name] = "unused alternative browser entry/service worker"

        destination.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(destination, "w") as compact:
            compact.comment = original.comment
            for item in original.infolist():
                if item.filename not in removed:
                    compact.writestr(copy.copy(item), original.read(item.filename),
                                     compress_type=item.compress_type, compresslevel=9)
        with zipfile.ZipFile(destination) as compact:
            if compact.testzip() is not None:
                raise ValueError("Output failed archive CRC validation")
            if set(compact.namelist()) != set(names) - set(removed):
                raise ValueError("Unexpected output entries")
            for name in compact.namelist():
                if compact.read(name) != original.read(name):
                    raise ValueError("Retained file was changed: " + name)
                if compact.getinfo(name).external_attr != original.getinfo(name).external_attr:
                    raise ValueError("File permissions changed: " + name)
        report = {
            "original_bytes": source.stat().st_size,
            "optimized_bytes": destination.stat().st_size,
            "saved_bytes": source.stat().st_size - destination.stat().st_size,
            "original_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
            "optimized_sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
            "entry_sha256": hashlib.sha256(original.read(entry)).hexdigest(),
            "removed_entries": removed,
            "retained_entries": len(names) - len(removed),
            "checks": ["CRC", "every retained file identical", "permissions preserved",
                       "native executable/signature identical", "iOS entry identical",
                       "all removed JS/CSS/paper bytes already inlined"],
            "limitations": ["No physical iPhone execution", "Install through the same sideload/re-signing process as the original"],
        }
    report_path = destination.with_suffix(".audit.json")
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    result = optimize(args.source, args.destination)
    print(json.dumps({k: v for k, v in result.items() if k != "removed_entries"},
                     ensure_ascii=False, indent=2))

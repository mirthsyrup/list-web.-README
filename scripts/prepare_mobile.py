"""Package reviewed web/native changes without inventing a signing identity.

iOS output keeps the existing ad-hoc native executable and needs normal sideload
signing. Android output deliberately ends in -unsigned.apk and must be aligned
and signed by the original Android build pipeline before it can update an app.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
import plistlib
import re
import struct
import zipfile
import zlib

from optimize_ipa import InlineContent, assert_no_resource_signature
from build_release import ios_entry as build_ios_entry


def digest(data):
    return hashlib.sha256(data).hexdigest()


def manifest_chunks(data):
    if struct.unpack_from("<HHI", data) != (3, 8, len(data)):
        raise ValueError("Unknown binary Android manifest")
    result, strings, offset = [], [], 8
    while offset < len(data):
        kind, header, size = struct.unpack_from("<HHI", data, offset)
        if size < header or offset + size > len(data):
            raise ValueError("Invalid manifest chunk")
        raw = bytearray(data[offset:offset + size])
        if kind == 1:
            count, styles, flags, start, _ = struct.unpack_from("<5I", raw, 8)
            if styles or flags & 256:
                raise ValueError("Review this manifest string-pool format first")
            for index in range(count):
                position = start + struct.unpack_from("<I", raw, header + index * 4)[0]
                length = struct.unpack_from("<H", raw, position)[0]
                if length >= 32768:
                    raise ValueError("Unsupported long manifest string")
                strings.append(bytes(raw[position + 2:position + 2 + length * 2]).decode("utf-16le"))
        result.append((kind, header, raw))
        offset += size
    return result, strings


def manifest_attributes(chunks, strings):
    attributes = []
    for kind, header, raw in chunks:
        if kind != 0x102:
            continue
        _, name, start, size, count = struct.unpack_from("<IIHHH", raw, header)
        for index in range(count):
            position = header + start + size * index
            _, attribute, _, _, _, value_type, value = struct.unpack_from("<IIIHBBI", raw, position)
            attributes.append((strings[name], strings[attribute], value_type,
                               strings[value] if value_type == 3 else value))
    return attributes


def serialize_manifest(data, chunks, strings):
    output = bytearray(data[:8])
    for kind, header, raw in chunks:
        if kind == 1:
            payload, offsets = bytearray(), []
            for string in strings:
                offsets.append(len(payload))
                encoded = string.encode('utf-16le')
                payload += struct.pack('<H', len(encoded)//2)+encoded+b'\0\0'
            payload += bytes(-len(payload)%4)
            raw = raw[:header]+struct.pack('<'+'I'*len(offsets), *offsets)+payload
            struct.pack_into('<I', raw, 4, len(raw))
            struct.pack_into('<I', raw, 8, len(strings))
            struct.pack_into('<I', raw, 20, header+4*len(offsets))
        output += raw
    struct.pack_into('<I', output, 4, len(output))
    return bytes(output)


def portrait_manifest(data):
    chunks, strings = manifest_chunks(data)
    before = manifest_attributes(chunks, strings)
    namespace = strings.index('http://schemas.android.com/apk/res/android')
    if 'screenOrientation' not in strings: strings.append('screenOrientation')
    orientation = strings.index('screenOrientation')
    mapping = next(raw for kind, _, raw in chunks if kind == 0x180)
    resource_ids = list(struct.unpack('<'+'I'*((len(mapping)-8)//4), mapping[8:]))
    resource_ids += [0]*(len(strings)-len(resource_ids))
    resource_ids[orientation] = 0x0101001e
    updated = []
    for kind, header, raw in chunks:
        if kind == 0x180:
            raw = bytearray(struct.pack('<HHI', kind, header, 8+4*len(resource_ids))+struct.pack('<'+'I'*len(resource_ids), *resource_ids))
        if kind == 0x102:
            _, name, start, size, count = struct.unpack_from('<IIHHH', raw, header)
            if strings[name] == 'activity':
                assert size == 20
                position = header+start
                attrs = [bytearray(raw[position+i*size:position+(i+1)*size]) for i in range(count)]
                existing = next((a for a in attrs if struct.unpack_from('<I', a, 4)[0] == orientation), None)
                if existing is not None:
                    struct.pack_into('<I', existing, 8, 0xffffffff)
                    struct.pack_into('<HBBI', existing, 12, 8, 0, 16, 1)
                else:
                    attr = bytearray(struct.pack('<IIIHBBI', namespace, orientation, 0xffffffff, 8, 0, 16, 1))
                    index = next((i for i,a in enumerate(attrs) if resource_ids[struct.unpack_from('<I',a,4)[0]] > 0x0101001e), count)
                    attrs.insert(index, attr)
                    for offset in (14,16,18):
                        old = struct.unpack_from('<H', raw, header+offset)[0]
                        if old and old >= index+1: struct.pack_into('<H', raw, header+offset, old+1)
                    struct.pack_into('<H', raw, header+12, count+1)
                raw = raw[:position]+b''.join(attrs)+raw[position+count*size:]
                struct.pack_into('<I', raw, 4, len(raw))
        updated.append((kind, header, raw))
    result = serialize_manifest(data, updated, strings)
    after = manifest_attributes(*manifest_chunks(result))
    skip = lambda a: a[:2] == ('activity','screenOrientation')
    assert [a for a in before if not skip(a)] == [a for a in after if not skip(a)]
    assert all(a[3] == 1 for a in after if skip(a))
    return result


def update_manifest(data, version, build):
    chunks, strings = manifest_chunks(data)
    before = manifest_attributes(chunks, strings)
    values = {(element, name): value for element, name, _, value in before}
    if values[("manifest", "package")] != "ru.seriylist.app":
        raise ValueError("Unexpected Android package")
    if values[("uses-sdk", "minSdkVersion")] < 23:
        raise ValueError("Native display helper requires API 23")
    if build <= values[("manifest", "versionCode")]:
        raise ValueError("Android versionCode must increase")
    changes = 0
    for kind, header, raw in chunks:
        if kind != 0x102:
            continue
        _, name, start, size, count = struct.unpack_from("<IIHHH", raw, header)
        for index in range(count):
            position = header + start + size * index
            _, attribute, _, _, _, value_type, value = struct.unpack_from("<IIIHBBI", raw, position)
            key = strings[name], strings[attribute]
            if key == ("manifest", "versionName"):
                if value_type != 3:
                    raise ValueError("Unexpected versionName encoding")
                strings[value] = version
                changes += 1
            if key == ("manifest", "versionCode"):
                if value_type != 16:
                    raise ValueError("Unexpected versionCode encoding")
                struct.pack_into("<I", raw, position + 16, build)
                changes += 1
    if changes != 2:
        raise ValueError("Expected exactly two Android version fields")
    output = bytearray(data[:8])
    for kind, header, raw in chunks:
        if kind == 1:
            payload, offsets = bytearray(), []
            for string in strings:
                offsets.append(len(payload))
                encoded = string.encode("utf-16le")
                payload += struct.pack("<H", len(encoded) // 2) + encoded + b"\0\0"
            payload += bytes(-len(payload) % 4)
            raw = raw[:header] + struct.pack("<" + "I" * len(offsets), *offsets) + payload
            struct.pack_into("<I", raw, 4, len(raw))
            struct.pack_into("<I", raw, 20, header + 4 * len(offsets))
        output += raw
    struct.pack_into("<I", output, 4, len(output))
    result = bytes(output)
    after = manifest_attributes(*manifest_chunks(result))
    ignored = {("manifest", "versionCode"), ("manifest", "versionName")}
    if [a for a in before if a[:2] not in ignored] != [a for a in after if a[:2] not in ignored]:
        raise ValueError("Unexpected manifest change outside version fields")
    return result


def write_member(archive, item, data, align=False):
    item = copy.copy(item)
    if align and item.compress_type == zipfile.ZIP_STORED:
        base = archive.fp.tell() + 30 + len(item.filename.encode("utf-8"))
        padding = -(base + 4) % 4
        item.extra = struct.pack("<HH", 65535, padding) + bytes(padding)
    archive.writestr(item, data, compresslevel=9)


def prepare(platform, source, destination, site, version, build, ios_entry=None, android_dex=None):
    if source.resolve() == destination.resolve() or destination.exists():
        raise ValueError("Write to a new destination")
    if not re.fullmatch(r"\d+\.\d+\.\d+", version) or not 0 < build < 2 ** 31:
        raise ValueError("Invalid release version/build")
    web = {path.relative_to(site).as_posix(): path.read_bytes()
           for path in site.rglob("*") if path.is_file()}
    if not {"index.html", "motion-ui.js", "app.js", "style.css"} <= web.keys():
        raise ValueError("Incomplete website directory")
    replacements, removed, added = {}, [], []
    with zipfile.ZipFile(source) as old:
        names = old.namelist()
        if len(names) != len(set(names)) or old.testzip():
            raise ValueError("Invalid source archive")
        if platform == "ios":
            if ios_entry is None:
                raise ValueError("--ios-entry is required")
            entries = [name for name in names if name.endswith("/web/ios-entry.html")]
            if len(entries) != 1 or any("_CodeSignature/" in n or n.endswith("embedded.mobileprovision") for n in names):
                raise ValueError("Use the reviewed ad-hoc sideload IPA, not a provisioned IPA")
            entry = entries[0]
            bundle = entry.removesuffix("web/ios-entry.html")
            info_path = bundle + "Info.plist"
            info = plistlib.loads(old.read(info_path))
            native_path = bundle + info["CFBundleExecutable"]
            assert_no_resource_signature(old.read(native_path))
            if info["CFBundleIdentifier"] != "ru.seriylist.app" or build <= int(info["CFBundleVersion"]):
                raise ValueError("Unexpected iOS bundle or non-increasing build")
            html = ios_entry.read_bytes()
            if html != build_ios_entry(site).encode():
                raise ValueError("iOS entry is stale: rebuild it from this exact site directory")
            parsed = InlineContent()
            parsed.feed(html.decode())
            if not parsed.styles:
                raise ValueError("iOS CSS is not inline")
            for name, data in web.items():
                if name.endswith(".js") and name != "sw.js":
                    if data.decode().replace("</script", "<\\/script") not in parsed.scripts:
                        raise ValueError("iOS entry does not match site script " + name)
            info["CADisableMinimumFrameDurationOnPhone"] = True
            info["UISupportedInterfaceOrientations"] = ["UIInterfaceOrientationPortrait"]
            info["UISupportedInterfaceOrientations~ipad"] = ["UIInterfaceOrientationPortrait"]
            info["UIRequiresFullScreen"] = True
            info["CFBundleShortVersionString"], info["CFBundleVersion"] = version, str(build)
            replacements[info_path] = plistlib.dumps(info, fmt=plistlib.FMT_XML, sort_keys=False)
            replacements[entry] = html
            # Keep the compact payload compact: only refresh already-retained web assets.
            for name in names:
                relative = name.removeprefix(bundle + "web/")
                if name.startswith(bundle + "web/") and relative in web:
                    replacements[name] = web[relative]
        elif platform == "android":
            if not destination.name.endswith("-unsigned.apk") or android_dex is None:
                raise ValueError("Require --android-dex and an output named *-unsigned.apk")
            dex = android_dex.read_bytes()
            if (not dex.startswith(b"dex\n") or b"Lru/seriylist/app/HighRefresh;" not in dex
                    or hashlib.sha1(dex[32:]).digest() != dex[12:32]
                    or zlib.adler32(dex[12:]) != struct.unpack_from("<I", dex, 8)[0]):
                raise ValueError("Invalid or unpatched DEX")
            replacements["classes.dex"] = dex
            replacements["AndroidManifest.xml"] = update_manifest(portrait_manifest(old.read("AndroidManifest.xml")), version, build)
            removed = [name for name in names if name.startswith(("META-INF/", "assets/web/"))]
            replacements.update({"assets/web/" + name: data for name, data in web.items()})
        else:
            raise ValueError("Unknown platform")
        destination.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as new:
            for item in old.infolist():
                if item.filename in removed:
                    continue
                write_member(new, item, replacements.get(item.filename, old.read(item)), align=platform == "android")
            for name, data in replacements.items():
                if name not in names or name in removed:
                    new.writestr(name, data)
                    added.append(name)
    with zipfile.ZipFile(source) as old, zipfile.ZipFile(destination) as new:
        if new.testzip() or len(new.namelist()) != len(set(new.namelist())):
            raise ValueError("Invalid output archive")
        for name in set(old.namelist()) & set(new.namelist()):
            if name not in replacements and old.read(name) != new.read(name):
                raise ValueError("Unexpected archive change: " + name)
        for name, data in replacements.items():
            if new.read(name) != data:
                raise ValueError("Replacement failed readback: " + name)
        if set(new.namelist()) != (set(old.namelist()) - set(removed)) | set(replacements):
            raise ValueError("Unexpected output archive members")
        if platform == "android":
            packaged_web = {name.removeprefix("assets/web/"): new.read(name)
                            for name in new.namelist() if name.startswith("assets/web/")}
            if packaged_web != web:
                raise ValueError("Android web payload differs from site sources")
        if platform == "ios" and old.read(native_path) != new.read(native_path):
            raise ValueError("The iOS executable changed")
    report = {
        "platform": platform, "version": version, "build": build,
        "source_sha256": digest(source.read_bytes()), "output_sha256": digest(destination.read_bytes()),
        "output_bytes": destination.stat().st_size, "device_tested": False,
        "signing": "original Android signing key required" if platform == "android" else "normal sideload re-signing required",
        "web_sha256": {name: digest(data) for name, data in sorted(web.items())},
        "replaced_members": sorted(replacements), "removed_members": sorted(set(removed) - set(replacements)),
        "added_members": sorted(set(added) - set(names)),
    }
    destination.with_suffix(destination.suffix + ".audit.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({key: value for key, value in report.items() if not isinstance(value, (dict, list))}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("platform", choices=("ios", "android"))
    for name in ("source", "destination", "site"):
        parser.add_argument("--" + name, required=True, type=Path)
    parser.add_argument("--version", required=True)
    parser.add_argument("--build", required=True, type=int)
    parser.add_argument("--ios-entry", type=Path)
    parser.add_argument("--android-dex", type=Path)
    args = parser.parse_args()
    prepare(**vars(args))

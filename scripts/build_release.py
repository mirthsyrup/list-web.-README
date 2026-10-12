"""Build the website ZIP and self-contained iOS web entry from the same sources.

This does not sign or publish native applications. Output stays outside site/.
"""
from pathlib import Path
import argparse
import base64
import hashlib
import json
import mimetypes
import re
import zipfile


def ios_entry(site: Path) -> str:
    html = (site / "index.html").read_text()

    def script(match):
        source = (site / match[1]).read_text().replace("</script", "<\\/script")
        return "<script>" + source + "</script>"

    html = re.sub(r'<script src="([^"]+)"></script>', script, html)
    # Native file:// cannot use the normal lazy catalog loader.
    extra = "".join("<script>" + (site / "data" / (cat + ".js")).read_text().replace(
        "</script", "<\\/script") + "</script>"
        for cat in ("feats", "spells", "actions", "conditions"))
    html = html.replace("</head>", extra + "</head>")

    def stylesheet(match):
        css_path = site / match[1]

        def asset(url):
            target = css_path.parent / url[1]
            mime = mimetypes.guess_type(target)[0]
            if not mime or not target.is_file():
                raise ValueError("Missing CSS asset: " + str(target))
            return 'url("data:' + mime + ';base64,' + base64.b64encode(
                target.read_bytes()).decode() + '")'

        return "<style>" + re.sub(r'url\("([^"]+)"\)', asset, css_path.read_text()) + "</style>"

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', stylesheet, html)
    if re.search(r'<script\s+src=|<link\s+rel="stylesheet"', html):
        raise ValueError("External script/stylesheet left in iOS entry")
    return html


def build(site: Path, output: Path, version: str):
    if output.resolve() == site.resolve() or site.resolve() in output.resolve().parents:
        raise ValueError("Build output must be outside site/")
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:-[\w.-]+)?", version):
        raise ValueError("Invalid release version")
    output.mkdir(parents=True, exist_ok=True)
    files = sorted(path for path in site.rglob("*") if path.is_file())
    archive_path = output / f"list-site-{version}.zip"
    with zipfile.ZipFile(archive_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in files:
            info = zipfile.ZipInfo("site/" + path.relative_to(site).as_posix(), (2026, 1, 1, 0, 0, 0))
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes(), compresslevel=9)
    entry_path = output / "ios-entry.html"
    entry_path.write_text(ios_entry(site))
    manifest = {path.relative_to(site).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in files}
    (output / "web-sources.sha256.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return {"version": version, "source_files": len(files), "zip": str(archive_path),
            "ios_entry": str(entry_path), "zip_sha256": hashlib.sha256(archive_path.read_bytes()).hexdigest()}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", type=Path, default=Path(__file__).resolve().parents[1] / "site")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--version", required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.site, args.out, args.version), indent=2))

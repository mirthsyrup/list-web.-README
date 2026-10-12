"""Add one native display preference call to the reviewed Android 2.8.5 shell.

Requires Java and the SHA-256-pinned smali dependencies in --tools-dir.
It does not sign APKs or download anything by itself.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

BASE_DEX_SHA256 = "4e12b22219304d17fa8dc33afe0e2a7514cd5daf17ba5807ef9e0f65a437784b"
TOOLS = {
    "antlr-3.5.2.jar": "5ac36c2acfb0a0f3d37dafe20b5b570f2643e2d000c648d44503c2738be643df",
    "antlr-runtime-3.5.2.jar": "ce3fc8ecb10f39e9a3cddcbb2ce350d272d9cd3d0b1e18e6fe73c3b9389c8734",
    "baksmali-2.5.2.jar": "1ed236266d7dc4907aade0b19a34f77efac25342b63c8ace52e579039941b389",
    "dexlib2-2.5.2.jar": "5a5c8982d8bd7d6e3bb1a0713049e3c78b719ec32b20f6b619885cec30a0dd61",
    "guava-27.1-android.jar": "686404f2d1d4d221911f96bd627ff60dac2226a5dfa6fb8ba517073eb97ec0ef",
    "jcommander-1.64.jar": "156be736199c990321d9ff77090b199629cfc9865e2d6c13f7cd291bb1641817",
    "smali-2.5.2.jar": "136c5c4653d6531bd7b6f10f35f8691cb96432e727d30b4d5579826ee01e9419",
    "stringtemplate-3.2.1.jar": "f66ce72e965e5301cb0f020e54d2ba6ad76feb91b3cbfc30dbbf00c06a6df6d7",
    "util-2.5.2.jar": "4f580a9cff3ebb83cb3fd20bec88e37e4f183796ca652732992611620282daea",
}
CALL = "    invoke-static {p0}, Lru/seriylist/app/HighRefresh;->apply(Landroid/app/Activity;)V\n"


def patch(apk: Path, destination: Path, tools: Path):
    if destination.exists():
        raise ValueError("Destination already exists")
    jars = []
    for name, expected in TOOLS.items():
        file = tools / name
        if hashlib.sha256(file.read_bytes()).hexdigest() != expected:
            raise ValueError("Unverified tool: " + name)
        jars.append(str(file.resolve()))
    java = ["java", "-cp", ":".join(jars)]
    with zipfile.ZipFile(apk) as archive:
        dex = archive.read("classes.dex")
    if hashlib.sha256(dex).hexdigest() != BASE_DEX_SHA256:
        raise ValueError("Unknown native shell: review it before applying this patch")
    with tempfile.TemporaryDirectory(prefix="list-dex-") as directory:
        root = Path(directory)
        original = root / "original.dex"
        original.write_bytes(dex)
        before, after = root / "before", root / "after"
        subprocess.run(java + ["org.jf.baksmali.Main", "disassemble", "--sequential-labels",
                              str(original), "-o", str(before)], check=True)
        main = before / "ru/seriylist/app/MainActivity.smali"
        old_main = main.read_text()
        anchor = "    invoke-super {p0}, Landroid/app/Activity;->onResume()V\n"
        if old_main.count(anchor) != 1:
            raise ValueError("Cannot identify onResume insertion point")
        main.write_text(old_main.replace(anchor, anchor + "\n" + CALL))
        helper = before / "ru/seriylist/app/HighRefresh.smali"
        shutil.copyfile(Path(__file__).parent / "android-refresh/HighRefresh.smali", helper)
        built = root / "patched.dex"
        subprocess.run(java + ["org.jf.smali.Main", "assemble", "--api", "26",
                              str(before), "-o", str(built)], check=True)
        subprocess.run(java + ["org.jf.baksmali.Main", "disassemble", "--sequential-labels",
                              str(built), "-o", str(after)], check=True)
        checked = []
        for file in before.rglob("*.smali"):
            relative = file.relative_to(before)
            if relative.name == "HighRefresh.smali":
                continue
            if file.read_bytes() != (after / relative).read_bytes():
                raise ValueError("Unexpected native change after round-trip: " + str(relative))
            checked.append(str(relative))
        if set(p.relative_to(before) for p in before.rglob("*.smali")) != set(
                p.relative_to(after) for p in after.rglob("*.smali")):
            raise ValueError("Unexpected added/removed native class")
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(built.read_bytes())
    report = {
        "base_dex_sha256": BASE_DEX_SHA256,
        "patched_dex_sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "unchanged_original_classes_except_onResume_call": checked,
        "added_class": "ru.seriylist.app.HighRefresh",
        "device_tested": False,
        "signing": "Requires the original APK signing key after packaging",
    }
    destination.with_suffix(".audit.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apk", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--tools-dir", required=True, type=Path)
    args = parser.parse_args()
    patch(args.apk, args.output, args.tools_dir)

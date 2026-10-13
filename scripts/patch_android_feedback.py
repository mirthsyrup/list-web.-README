"""Add a bounded, settings-respecting haptic bridge to the reviewed refresh DEX.

Requires pinned local smali tools; never downloads, signs or publishes anything.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

from patch_android_refresh import TOOLS

BASE_DEX_SHA256 = "0107789ad11fd0dff585b61a6eae52b2954f609f00160f731309dff4aae5fd8a"
BRIDGE = "ru/seriylist/app/MainActivity$Bridge.smali"
HELPER = "ru/seriylist/app/HapticFeedback.smali"
METHOD = '''.method public haptic(Ljava/lang/String;)V
    .registers 3
    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    iget-object v0, p0, Lru/seriylist/app/MainActivity$Bridge;->this$0:Lru/seriylist/app/MainActivity;
    invoke-static {v0}, Lru/seriylist/app/MainActivity;->access$3(Lru/seriylist/app/MainActivity;)Landroid/webkit/WebView;
    move-result-object v0
    invoke-static {v0, p1}, Lru/seriylist/app/HapticFeedback;->request(Landroid/webkit/WebView;Ljava/lang/String;)V
    return-void
.end method

'''


def patch(source: Path, destination: Path, tools: Path):
    if destination.exists():
        raise ValueError("Destination already exists")
    dex = source.read_bytes()
    if hashlib.sha256(dex).hexdigest() != BASE_DEX_SHA256:
        raise ValueError("Unknown native shell: review before patching")
    jars = []
    for name, expected in TOOLS.items():
        jar = tools / name
        if hashlib.sha256(jar.read_bytes()).hexdigest() != expected:
            raise ValueError("Unverified tool: " + name)
        jars.append(str(jar.resolve()))
    java = ["java", "-cp", ":".join(jars)]
    with tempfile.TemporaryDirectory(prefix="list-haptic-") as directory:
        root = Path(directory)
        before, after = root / "before", root / "after"
        subprocess.run(java + ["org.jf.baksmali.Main", "disassemble", "--sequential-labels",
                              str(source), "-o", str(before)], check=True)
        originals = {str(p.relative_to(before)): p.read_text() for p in before.rglob("*.smali")}
        if len(originals) != 10 or "ru/seriylist/app/HighRefresh.smali" not in originals:
            raise ValueError("Expected the nine original classes plus HighRefresh")
        bridge = before / BRIDGE
        anchor = ".method public importFile()V\n"
        if originals[BRIDGE].count(anchor) != 1:
            raise ValueError("Cannot identify bridge insertion point")
        bridge.write_text(originals[BRIDGE].replace(anchor, METHOD + anchor))
        shutil.copyfile(Path(__file__).parent / "android-feedback/HapticFeedback.smali", before / HELPER)
        built = root / "patched.dex"
        subprocess.run(java + ["org.jf.smali.Main", "assemble", "--api", "26",
                              str(before), "-o", str(built)], check=True)
        subprocess.run(java + ["org.jf.baksmali.Main", "disassemble", "--sequential-labels",
                              str(built), "-o", str(after)], check=True)
        if set(str(p.relative_to(after)) for p in after.rglob("*.smali")) != set(originals) | {HELPER}:
            raise ValueError("Unexpected added or removed native class")
        unchanged = []
        for relative, original in originals.items():
            actual = (after / relative).read_text()
            if relative == BRIDGE:
                actual, count = re.subn(r"\.method public haptic\(Ljava/lang/String;\)V\n.*?\.end method\n\n", "", actual, flags=re.S)
                if count != 1:
                    raise ValueError("Expected exactly one haptic method")
            if actual != original:
                raise ValueError("Unexpected existing native change: " + relative)
            unchanged.append(relative)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(built.read_bytes())
    report = {
        "base_dex_sha256": BASE_DEX_SHA256,
        "patched_dex_sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "unchanged_existing_classes_except_added_bridge_method": unchanged,
        "added_class": "ru.seriylist.app.HapticFeedback",
        "bridge_method": "NativeBridge.haptic(String)",
        "vibrator_permission_required": False,
        "feedback_flags": 0,
        "device_tested": False,
    }
    destination.with_suffix(".audit.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dex", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--tools-dir", required=True, type=Path)
    args = parser.parse_args()
    patch(args.dex, args.output, args.tools_dir)

"""Ensure editable sources still match the archive used by the public loader."""
from pathlib import Path
import re
import zipfile

root = Path(__file__).resolve().parents[1]
loader = (root / 'index.html').read_text()
match = re.search(r"fetch\('([^']+\.zip)'", loader)
if not match:
    raise SystemExit('Cannot identify the archive in the public loader')
with zipfile.ZipFile(root / match.group(1)) as archive:
    members = {name for name in archive.namelist() if not name.endswith('/')}
    actual = {path.relative_to(root).as_posix() for path in (root / 'site').rglob('*') if path.is_file()}
    if members != actual:
        raise SystemExit('Source/archive file lists differ: ' + str(members ^ actual))
    for name in sorted(members):
        if (root / name).read_bytes() != archive.read(name):
            raise SystemExit('Source/archive bytes differ: ' + name)
    if archive.testzip() is not None:
        raise SystemExit('Archive CRC check failed')
print(f'{len(members)} source files match {match.group(1)}; public loader unchanged')

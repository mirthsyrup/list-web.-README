"""Unpack pinned Debian LLVM tools locally; no sudo or Apple SDK downloads."""
from pathlib import Path
import argparse,hashlib,json,subprocess,urllib.request


def fetch(destination):
    locks=json.loads((Path(__file__).resolve().parents[1]/'native/ios/toolchain.lock.json').read_text())
    destination.mkdir(parents=True,exist_ok=True)
    for name,record in locks.items():
        archive=destination/(name+'.deb')
        if not archive.exists():
            with urllib.request.urlopen(record['url'],timeout=90) as source:
                archive.write_bytes(source.read())
        if hashlib.sha256(archive.read_bytes()).hexdigest()!=record['sha256']:
            raise ValueError('Unverified LLVM package: '+name)
        subprocess.run(['dpkg-deb','-x',str(archive),str(destination/'root')],check=True)
        print(name,record['version'],'verified')


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('destination',type=Path);a=p.parse_args();fetch(a.destination)

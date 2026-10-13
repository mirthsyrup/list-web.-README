"""Package a rebuilt native shell with the reviewed IPA's unchanged web/resources."""
from pathlib import Path
import argparse,hashlib,json,plistlib,re,zipfile
from check_ios_native import inspect


def package(source,binary,destination,version,build):
    if destination.exists() or source.resolve()==destination.resolve():raise ValueError('Use a new output path')
    if not re.fullmatch(r'\d+\.\d+\.\d+',version):raise ValueError('Invalid version')
    native=inspect(binary);changes={}
    with zipfile.ZipFile(source) as old:
        names=old.namelist()
        if len(names)!=len(set(names)) or old.testzip():raise ValueError('Invalid original IPA')
        if any('_CodeSignature/' in x or x.endswith('embedded.mobileprovision') for x in names):raise ValueError('Use the reviewed ad-hoc IPA without provisioned resources')
        plist_name='Payload/List.app/Info.plist';exe='Payload/List.app/List';entry='Payload/List.app/web/ios-entry.html';privacy='Payload/List.app/PrivacyInfo.xcprivacy'
        info=plistlib.loads(old.read(plist_name))
        if info['CFBundleIdentifier']!='ru.seriylist.app' or info['CFBundleExecutable']!='List':raise ValueError('Unknown native bundle')
        if build<=int(info['CFBundleVersion']):raise ValueError('Build number must increase')
        text=old.read(entry);marker=('версия '+info['CFBundleShortVersionString']).encode()
        if text.count(marker)!=1:raise ValueError('Cannot identify the embedded About version')
        changes[entry]=text.replace(marker,('версия '+version).encode())
        info['CFBundleShortVersionString']=version;info['CFBundleVersion']=str(build)
        info['CADisableMinimumFrameDurationOnPhone']=True
        changes[plist_name]=plistlib.dumps(info,fmt=plistlib.FMT_BINARY,sort_keys=False)
        changes[exe]=binary.read_bytes()
        manifest=plistlib.loads(old.read(privacy))
        manifest['NSPrivacyAccessedAPITypes']=[{'NSPrivacyAccessedAPIType':'NSPrivacyAccessedAPICategoryUserDefaults','NSPrivacyAccessedAPITypeReasons':['CA92.1']}]
        changes[privacy]=plistlib.dumps(manifest,fmt=plistlib.FMT_XML,sort_keys=False)
        destination.parent.mkdir(parents=True,exist_ok=True)
        with zipfile.ZipFile(destination,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as output:
            for member in old.infolist():
                data=changes.get(member.filename,old.read(member.filename));member.compress_type=zipfile.ZIP_DEFLATED
                output.writestr(member,data,compresslevel=9)
    with zipfile.ZipFile(source) as old,zipfile.ZipFile(destination) as new:
        assert old.namelist()==new.namelist() and new.testzip() is None
        unchanged=[name for name in old.namelist() if name not in changes]
        for name in unchanged:assert old.read(name)==new.read(name),name
        assert new.read(exe)==binary.read_bytes()
    report={'version':version,'build':build,'bytes':destination.stat().st_size,
        'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'native_sha256':native['sha256'],'bundle_id':'ru.seriylist.app',
        'native_data_path':'Application Support/List/state-v1.json',
        'modified_members':sorted(changes),'unchanged_members':unchanged,
        'web_change':'About version only; all rules, logic, styles and catalogs unchanged',
        'signing':'ad-hoc executable; normal sideload re-signing required','physical_device_tested':False}
    destination.with_suffix('.audit.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='unchanged_members'},indent=2))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('source','binary','destination'):p.add_argument('--'+name,type=Path,required=True)
    p.add_argument('--version',required=True);p.add_argument('--build',type=int,required=True);a=p.parse_args()
    package(a.source,a.binary,a.destination,a.version,a.build)

"""Check device architecture, platform, dependencies and every ad-hoc code hash."""
from pathlib import Path
import argparse
import hashlib
import json
import struct


def inspect(path):
    data=Path(path).read_bytes()
    magic,cpu,subtype,kind,count,length,flags,_=struct.unpack_from('<8I',data)
    if (magic,cpu,subtype,kind)!=(0xfeedfacf,0x100000c,0,2):
        raise ValueError('Expected a device arm64 Mach-O executable')
    position=32;commands=[];segments=[];sections=[];dependencies=[];platform=None;signature=None;symtab=None;indirect=None
    for _ in range(count):
        cmd,size=struct.unpack_from('<2I',data,position)
        if size<8 or position+size>32+length:raise ValueError('Malformed load command')
        commands.append((cmd,position,size))
        if cmd==0x19:
            values=struct.unpack_from('<II16sQQQQIIII',data,position)
            name=values[2].split(b'\0')[0].decode();segments.append({'name':name,'vmaddr':values[3],'vmsize':values[4],'fileoff':values[5],'filesize':values[6]})
            for i in range(values[9]):
                fields=struct.unpack_from('<16s16sQQ8I',data,position+72+i*80)
                sections.append({'name':fields[0].split(b'\0')[0].decode(),'segment':fields[1].split(b'\0')[0].decode(),'addr':fields[2],'size':fields[3],'offset':fields[4],'reserved1':fields[9],'reserved2':fields[10]})
        elif cmd==0xc:
            offset=struct.unpack_from('<I',data,position+8)[0]
            dependencies.append(data[position+offset:position+size].split(b'\0')[0].decode())
        elif cmd==0x32:platform=struct.unpack_from('<4I',data,position+8)
        elif cmd==0x1d:signature=struct.unpack_from('<2I',data,position+8)
        elif cmd==2:symtab=struct.unpack_from('<4I',data,position+8)
        elif cmd==0xb:indirect=struct.unpack_from('<I',data,position+56)[0]
        position+=size
    if position!=32+length:raise ValueError('Load command length mismatch')
    if not platform or platform[:3]!=(2,0x100000,0x120000):raise ValueError('Expected iOS device, minimum16, SDK metadata18')
    wanted={'/System/Library/Frameworks/UIKit.framework/UIKit','/System/Library/Frameworks/Foundation.framework/Foundation','/System/Library/Frameworks/WebKit.framework/WebKit','/usr/lib/libobjc.A.dylib','/usr/lib/libSystem.B.dylib'}
    if set(dependencies)!=wanted:raise ValueError('Unexpected runtime dependency: '+str(dependencies))
    if not signature:raise ValueError('Missing ad-hoc executable signature')
    offset,size=signature
    if offset+size!=len(data):raise ValueError('Unexpected bytes after code signature')
    magic,total,slots=struct.unpack_from('>3I',data,offset)
    if magic!=0xfade0cc0 or total>size:raise ValueError('Invalid signature superblob')
    code=None
    for i in range(slots):
        typ,relative=struct.unpack_from('>2I',data,offset+12+i*8)
        if typ==0:code=offset+relative
    if code is None:raise ValueError('Missing CodeDirectory')
    values=struct.unpack_from('>9I4B',data,code)
    if values[0]!=0xfade0c02 or not values[3]&2 or values[10]!=2 or values[9]!=32:
        raise ValueError('Expected ad-hoc SHA256 CodeDirectory')
    hash_offset,special,number,limit=values[4],values[6],values[7],values[8]
    page_size=1<<values[12]
    if special!=0 or limit!=offset or number!=(limit+page_size-1)//page_size:
        raise ValueError('Unexpected signed resources, bounds or page count')
    for i in range(number):
        digest=hashlib.sha256(data[i*page_size:min((i+1)*page_size,limit)]).digest()
        if digest!=data[code+hash_offset+i*32:code+hash_offset+(i+1)*32]:raise ValueError('Code signature hash failure at page '+str(i))
    symbols=[];stubs={}
    if symtab:
        table,n,strings,_=symtab
        for i in range(n):
            name_offset,typ,sect,desc,value=struct.unpack_from('<IBBHQ',data,table+i*16)
            name=data[strings+name_offset:].split(b'\0',1)[0].decode()
            symbols.append({'name':name,'type':typ,'value':value})
        for section in sections:
            if section['name']=='__stubs':
                for i in range(section['size']//section['reserved2']):
                    index=struct.unpack_from('<I',data,indirect+(section['reserved1']+i)*4)[0]
                    stubs[section['addr']+i*section['reserved2']]=symbols[index]['name']
    return {'arm64_device':True,'minimum_ios':'16.0','sdk_metadata':'18.0','dependencies':dependencies,
            'signature_pages_verified':number,'adhoc_signature_valid':True,'executable_bytes':len(data),
            'sha256':hashlib.sha256(data).hexdigest(),'device_tested':False,
            'segments':segments,'sections':sections,'symbols':symbols,'stubs':stubs}


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('binary',type=Path);p.add_argument('--out',type=Path);args=p.parse_args()
    result=inspect(args.binary)
    if args.out:args.out.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ('segments','sections','symbols','stubs')},indent=2))

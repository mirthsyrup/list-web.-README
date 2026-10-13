"""Execute the shipped ARM64 shell; mock system Objective-C APIs, not app code.

Requires unicorn==2.1.4. UIKit itself is not emulated: these checks establish
native argument flow, message validation, persistence and haptic dispatch.
They do not establish physical device behaviour or installation.
"""
from pathlib import Path
import argparse,json,struct,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[3]/'scripts'))
from check_ios_native import inspect
from unicorn import Uc,UC_ARCH_ARM64,UC_MODE_ARM,UC_HOOK_CODE
from unicorn.arm64_const import UC_ARM64_REG_X0,UC_ARM64_REG_X1,UC_ARM64_REG_X2,UC_ARM64_REG_X3,UC_ARM64_REG_X4,UC_ARM64_REG_X5,UC_ARM64_REG_X6,UC_ARM64_REG_X7,UC_ARM64_REG_SP,UC_ARM64_REG_LR,UC_ARM64_REG_PC,UC_ARM64_REG_D0,UC_ARM64_REG_D1,UC_ARM64_REG_D2,UC_ARM64_REG_D3
X=[UC_ARM64_REG_X0,UC_ARM64_REG_X1,UC_ARM64_REG_X2,UC_ARM64_REG_X3,UC_ARM64_REG_X4,UC_ARM64_REG_X5,UC_ARM64_REG_X6,UC_ARM64_REG_X7]
D=[UC_ARM64_REG_D0,UC_ARM64_REG_D1,UC_ARM64_REG_D2,UC_ARM64_REG_D3]


class Runtime:
    def __init__(self,binary):
        self.info=inspect(binary);self.data=Path(binary).read_bytes();self.uc=Uc(UC_ARCH_ARM64,UC_MODE_ARM)
        for segment in self.info['segments']:
            if segment['name']=='__PAGEZERO' or not segment['vmsize']:continue
            self.uc.mem_map(segment['vmaddr'],(segment['vmsize']+4095)&~4095)
            self.uc.mem_write(segment['vmaddr'],self.data[segment['fileoff']:segment['fileoff']+segment['filesize']])
        self.uc.mem_map(0x30000000,0x400000);self.uc.mem_map(0x70000000,0x200000);self.uc.mem_map(0x6fff0000,4096)
        self.objects={};self.next=0x20000000;self.heap=0x30000000;self.classes={};self.selectors={};self.methods={}
        self.files={};self.evaluations=[];self.effects=[];self.scripts=[];self.calls=[];self.now=100.;self.active=0;self.on_main=True;self.write_ok=True;self.attached=True;self.stop_error=None
        self.defaults=self.obj('NSUserDefaults',{});self.application=self.obj('UIApplication');self.manager=self.obj('NSFileManager');self.content=0;self.window=0;self.web=0;self.controller=0
        self.uc.hook_add(UC_HOOK_CODE,self.hook)
    def obj(self,kind,value=None,**attrs):
        self.next+=16;self.objects[self.next]={'kind':kind,'value':value,**attrs};return self.next
    def box(self,value):
        if value is None:return 0
        if isinstance(value,str):return self.obj('NSString',value)
        if isinstance(value,(int,float,bool)):return self.obj('NSNumber',value)
        if isinstance(value,list):return self.obj('NSArray',[self.box(x) for x in value])
        if isinstance(value,dict):return self.obj('NSDictionary',{k:self.box(v) for k,v in value.items()})
        raise TypeError(type(value))
    def py(self,obj):
        if not obj:return None
        data=self.objects[obj];v=data.get('value')
        if data['kind']=='NSArray':return [self.py(x) for x in v]
        if data['kind'] in ('NSDictionary','NSUserDefaults'):return {k:self.py(x) for k,x in v.items()}
        return v
    def cstr(self,pointer):
        result=bytearray()
        while True:
            b=bytes(self.uc.mem_read(pointer,1));pointer+=1
            if b==b'\0':return result.decode('utf-8')
            result+=b
    def string_pointer(self,s):
        data=s.encode()+b'\0';result=self.heap;self.heap+=len(data)+16;self.uc.mem_write(result,data);return result
    def reg(self,i):return self.uc.reg_read(X[i])
    def fp(self,i):return struct.unpack('<d',struct.pack('<Q',self.uc.reg_read(D[i])))[0]
    def result(self,value=0):self.uc.reg_write(X[0],value or 0)
    def float_result(self,value):self.uc.reg_write(D[0],struct.unpack('<Q',struct.pack('<d',value))[0])
    def hook(self,uc,address,size,user):
        if address==0x6fff0000:uc.emu_stop();return
        name=self.info['stubs'].get(address)
        if not name:return
        try:
            if name=='_objc_getClass':
                key=self.cstr(self.reg(0));self.classes.setdefault(key,self.obj('Class',key));self.result(self.classes[key])
            elif name=='_sel_registerName':
                key=self.cstr(self.reg(0));self.selectors.setdefault(key,self.obj('Selector',key));self.result(self.selectors[key])
            elif name=='_objc_allocateClassPair':
                key=self.cstr(self.reg(1));self.classes[key]=self.obj('Class',key,superclass=self.reg(0));self.result(self.classes[key])
            elif name=='_class_addMethod':
                key=(self.py(self.reg(0)),self.py(self.reg(1)));self.methods[key]=(self.reg(2),self.cstr(self.reg(3)));self.result(1)
            elif name in ('_objc_registerClassPair','_objc_autoreleasePoolPop'):self.result()
            elif name in ('_objc_getProtocol','_class_addProtocol','_objc_autoreleasePoolPush'):self.result(1)
            elif name=='_UIApplicationMain':self.result()
            elif name=='_NSTemporaryDirectory':self.result(self.box('/sandbox/tmp'))
            elif name=='_objc_msgSend':self.message()
            else:raise AssertionError('Unhandled system import '+name)
            uc.reg_write(UC_ARM64_REG_PC,uc.reg_read(UC_ARM64_REG_LR))
        except Exception as error:self.stop_error=error;uc.emu_stop()
    def message(self):
        target=self.reg(0);selector=self.py(self.reg(1));a=[self.reg(i) for i in range(2,8)]
        if not target:self.result();self.float_result(0);return
        obj=self.objects[target];kind=obj['kind'];value=obj.get('value');cls=value if kind=='Class' else kind
        self.calls.append((cls,selector))
        result=0
        if selector in ('init','autorelease','retain'):result=target
        elif selector=='release':pass
        elif selector=='alloc':result=self.obj(cls)
        elif selector=='isKindOfClass:':result=kind==self.py(a[0]) or self.py(a[0])=='NSObject'
        elif selector=='stringWithUTF8String:':result=self.box(self.cstr(a[0]))
        elif selector=='UTF8String':result=self.string_pointer(value)
        elif selector=='isEqualToString:':result=value==self.py(a[0])
        elif selector=='length':result=obj.get('length_override',len(value.encode('utf-16-le'))//2 if isinstance(value,str) else len(value))
        elif selector=='stringByAppendingString:':result=self.box(value+self.py(a[0]))
        elif selector=='stringByAppendingPathComponent:':result=self.box(value.rstrip('/')+'/'+self.py(a[0]))
        elif selector=='lastPathComponent':result=self.box(value.rstrip('/').split('/')[-1])
        elif selector in ('longLongValue','integerValue'):result=int(value)
        elif selector=='stringValue':result=self.box(str(value))
        elif selector=='objectForKey:':result=value.get(self.py(a[0]),0)
        elif selector=='setObject:forKey:':value[self.py(a[1])]=a[0]
        elif selector=='standardUserDefaults':result=self.defaults
        elif selector=='stringForKey:':result=value.get(self.py(a[0]),0)
        elif selector=='dictionary':result=self.obj('NSDictionary',{})
        elif selector=='arrayWithObject:':result=self.obj('NSArray',[a[0]])
        elif selector=='firstObject':result=value[0] if value else 0
        elif selector=='dataWithJSONObject:options:error:':result=self.obj('NSData',json.dumps(self.py(a[0]),ensure_ascii=False,separators=(',',':')).encode())
        elif selector=='initWithData:encoding:':obj.update(kind='NSString',value=self.py(a[0]).decode());result=target
        elif selector=='dataUsingEncoding:':result=self.obj('NSData',value.encode())
        elif selector=='JSONObjectWithData:options:error:':
            try:result=self.box(json.loads(self.py(a[0])))
            except (ValueError,TypeError):result=0
        elif selector=='defaultManager':result=self.manager
        elif selector=='URLsForDirectory:inDomains:':
            assert (a[0],a[1])==(14,1);result=self.obj('NSArray',[self.obj('NSURL','/sandbox/Library/Application Support')])
        elif selector=='URLByAppendingPathComponent:':result=self.obj('NSURL',value.rstrip('/')+'/'+self.py(a[0]))
        elif selector=='createDirectoryAtURL:withIntermediateDirectories:attributes:error:':assert a[1]==1;result=1
        elif selector=='stringWithContentsOfURL:encoding:error:':result=self.box(self.files.get(self.py(a[0])))
        elif selector=='writeToURL:atomically:encoding:error:':
            assert a[1:3]==[1,4]
            if self.write_ok:self.files[self.py(a[0])]=value
            result=self.write_ok
        elif selector=='writeToFile:atomically:encoding:error:':
            assert a[1:3]==[1,4]
            if self.write_ok:self.files[self.py(a[0])]=value
            result=self.write_ok
        elif selector=='fileURLWithPath:':result=self.obj('NSURL',self.py(a[0]))
        elif selector=='path':result=self.box(value)
        elif selector=='URLByResolvingSymlinksInPath':result=target
        elif selector=='fileExistsAtPath:':result=1
        elif selector=='mainBundle':result=self.obj('NSBundle')
        elif selector=='bundleURL':result=self.obj('NSURL','/app/Payload/List.app')
        elif selector=='mainScreen':result=self.obj('UIScreen')
        elif selector=='bounds':
            rect=obj.get('bounds',(0.,0.,390.,844.))
            for i,v in enumerate(rect):self.uc.reg_write(D[i],struct.unpack('<Q',struct.pack('<d',v))[0])
            self.result();return
        elif selector=='initWithFrame:':obj['bounds']=tuple(self.fp(i) for i in range(4));result=target;self.window=target if kind=='UIWindow' else self.window
        elif selector=='view':
            if not obj.get('view'):obj['view']=self.obj('UIView')
            result=obj['view'];self.controller=target if kind=='ListController' else self.controller
        elif selector=='scrollView':
            if not obj.get('scrollView'):obj['scrollView']=self.obj('UIScrollView')
            result=obj['scrollView']
        elif selector=='userContentController':
            if not obj.get('content'):obj['content']=self.obj('WKUserContentController')
            result=obj['content'];self.content=result
        elif selector=='addScriptMessageHandler:name:':obj.setdefault('handlers',{})[self.py(a[1])]=a[0]
        elif selector=='initWithSource:injectionTime:forMainFrameOnly:':
            assert a[1:3]==[0,1];obj['source']=self.py(a[0]);result=target
        elif selector=='addUserScript:':self.scripts.append(self.objects[a[0]]['source'])
        elif selector=='removeAllUserScripts':self.scripts.clear()
        elif selector=='reload':obj['reloads']=obj.get('reloads',0)+1
        elif selector=='initWithFrame:configuration:':obj['bounds']=tuple(self.fp(i) for i in range(4));obj['config']=a[0];self.web=target;result=target
        elif selector=='setFrame:':obj['frame']=tuple(self.fp(i) for i in range(4))
        elif selector=='colorWithRed:green:blue:alpha:':result=self.obj('UIColor',tuple(self.fp(i) for i in range(4)))
        elif selector=='systemFontOfSize:':result=self.obj('UIFont',self.fp(0))
        elif selector=='addSubview:':obj.setdefault('subviews',[]).append(a[0])
        elif selector=='makeKeyAndVisible':obj['visible']=True
        elif selector=='sharedApplication':result=self.application
        elif selector=='applicationState':result=self.active
        elif selector=='supportsAlternateIcons':result=0
        elif selector=='traitCollection':result=self.obj('UITraitCollection')
        elif selector=='userInterfaceStyle':result=1
        elif selector=='isMainThread':result=self.on_main
        elif selector=='window':result=self.window if self.attached else 0
        elif selector=='isHidden':result=obj.get('hidden',False)
        elif selector=='date':result=self.obj('NSDate')
        elif selector=='timeIntervalSinceReferenceDate':self.float_result(self.now);self.result();return
        elif selector=='initWithStyle:':obj['style']=a[0];result=target
        elif selector=='prepare':pass
        elif selector=='impactOccurredWithIntensity:':self.effects.append(('impact',obj['style'],self.fp(0)))
        elif selector=='notificationOccurred:':self.effects.append(('notification',a[0]))
        elif selector=='evaluateJavaScript:completionHandler:':self.evaluations.append(self.py(a[0]))
        elif selector=='loadFileURL:allowingReadAccessToURL:':obj['loaded']=(self.py(a[0]),self.py(a[1]));result=self.obj('WKNavigation')
        elif selector=='performSelector:withObject:afterDelay:':assert self.fp(0)==20
        elif selector=='initWithActivityItems:applicationActivities:':obj['items']=a[0];result=target
        elif selector=='popoverPresentationController':result=self.obj('UIPopoverPresentationController')
        elif selector=='setSourceRect:':obj['sourceRect']=tuple(self.fp(i) for i in range(4))
        elif selector=='presentViewController:animated:completion:':obj['presented']=a[0]
        elif selector=='setNeedsStatusBarAppearanceUpdate':pass
        elif selector.startswith('set') and selector.endswith(':'):
            key=selector[3:-1];key=key[0].lower()+key[1:];obj[key]=a[0]
        elif selector in obj:result=obj[selector]
        else:raise AssertionError(f'Unexpected Objective-C call {kind}.{selector}')
        self.result(result)
    def call(self,address,args=(),limit=400000):
        self.stop_error=None
        for r in X:self.uc.reg_write(r,0)
        for i,a in enumerate(args):self.uc.reg_write(X[i],a)
        self.uc.reg_write(UC_ARM64_REG_SP,0x701ff000);self.uc.reg_write(UC_ARM64_REG_LR,0x6fff0000)
        self.uc.emu_start(address,0,count=limit)
        if self.stop_error:raise self.stop_error
        assert self.uc.reg_read(UC_ARM64_REG_PC)==0x6fff0000,'Native call did not return'
        return self.reg(0)
    def start(self,state=None):
        if state is not None:self.files['/sandbox/Library/Application Support/List/state-v1.json']=state
        main=next(s['value'] for s in self.info['symbols'] if s['name']=='_main');self.call(main)
        self.delegate=self.obj('ListDelegate')
        self.call(self.methods[('ListDelegate','application:didFinishLaunchingWithOptions:')][0],[self.delegate,0,self.application,0])
    def emit(self,name,body,main=True,controller=None):
        frame=self.obj('WKFrameInfo',isMainFrame=main)
        message=self.obj('WKScriptMessage',name=self.box(name),body=self.box(body),frameInfo=frame)
        self.call(self.methods[('ListDelegate','userContentController:didReceiveScriptMessage:')][0],[self.delegate,0,self.content if controller is None else controller,message])


def verify(binary,output):
    checks=[];runtime=Runtime(binary)
    old=json.dumps({'format':'list-store','version':1,'sequence':42,'hash':'deadbeef','body':'{"characters":[{"name":"Мираэль🧝🏻"}]}'},ensure_ascii=False)
    runtime.start(old)
    assert set(runtime.objects[runtime.content]['handlers'])=={'exportFile','appStatus','saveState','setTheme','haptic'}
    assert runtime.objects[runtime.web]['loaded']==('/app/Payload/List.app/web/ios-entry.html','/app/Payload/List.app/web')
    snapshots=next(s for s in runtime.scripts if s.startswith('window.__LIST_NATIVE_SNAPSHOTS='));assert json.loads(snapshots.split('=',1)[1][:-1])==[old]
    assert ('NSThread','isMainThread') not in runtime.calls
    checks.append('compiled shell boots through original file path and injects exact Unicode native backup before scripts')
    runtime.emit('haptic',{'kind':'damage'});assert not runtime.effects
    runtime.emit('appStatus','ready')
    expected={'damage':('impact',1,.6),'heal':('impact',4,.35),'roll':('impact',0,.3),'critical-success':('notification',0),'critical-failure':('notification',1),'invalid':('impact',3,.3)}
    for kind,effect in expected.items():
        runtime.now+=1;runtime.emit('haptic',{'kind':kind});assert runtime.effects[-1]==effect,(kind,runtime.effects)
    checks.append('all six actual ARM64 paths dispatch exact UIKit styles and floating point intensity arguments')
    count=len(runtime.effects);runtime.emit('haptic',{'kind':'damage'});assert len(runtime.effects)==count
    runtime.now+=.13;runtime.emit('haptic',{'kind':'damage'});assert len(runtime.effects)==count+1
    for setup in ('iframe','foreign_controller','inactive','detached','non_main','unknown','badbody','longkind'):
        count=len(runtime.effects);runtime.now+=1
        if setup=='iframe':runtime.emit('haptic',{'kind':'damage'},main=False)
        elif setup=='foreign_controller':runtime.emit('haptic',{'kind':'damage'},controller=1)
        elif setup=='inactive':runtime.active=2;runtime.emit('haptic',{'kind':'damage'});runtime.active=0
        elif setup=='detached':runtime.attached=False;runtime.emit('haptic',{'kind':'damage'});runtime.attached=True
        elif setup=='non_main':runtime.on_main=False;runtime.emit('haptic',{'kind':'damage'});runtime.on_main=True
        elif setup=='unknown':runtime.emit('haptic',{'kind':'not-a-command'})
        elif setup=='badbody':runtime.emit('haptic','damage')
        else:runtime.emit('haptic',{'kind':'damage'*10})
        assert len(runtime.effects)==count,setup
    checks.append('actual bridge rejects early, background, iframe, foreign, detached, off-main, rapid and malformed requests')
    raw=json.dumps({'format':'list-store','version':1,'sequence':43,'hash':'beadbead','body':'{"characters":[]}'})
    runtime.emit('saveState',{'payload':raw,'sequence':43})
    path='/sandbox/Library/Application Support/List/state-v1.json';assert runtime.files[path]==raw;assert runtime.evaluations[-1].endswith('(43,true);')
    for bad in [[],{'sequence':43,'payload':'[]'},{'sequence':42,'payload':old},{'sequence':44,'payload':'invalid JSON'}, {'sequence':44,'payload':json.dumps({'format':'list-store','version':{},'sequence':44})}]:
        runtime.emit('saveState',bad);assert runtime.files[path]==raw
    runtime.write_ok=False;runtime.emit('saveState',{'payload':raw.replace('43','44'),'sequence':44});assert runtime.files[path]==raw;assert runtime.evaluations[-1].endswith('(44,false);');runtime.write_ok=True
    checks.append('native atomic UTF8 journal preserves same App Support path, rejects stale/invalid records and acknowledges write failure')
    runtime.emit('exportFile',{'text':'{"имя":"Мираэль🧝🏻"}','name':'../folder/герой.json'})
    assert runtime.files['/sandbox/tmp/герой.json']=='{"имя":"Мираэль🧝🏻"}'
    share=runtime.objects[runtime.controller]['presented'];item=runtime.objects[share]['items'];url=runtime.objects[item]['value'][0];assert runtime.py(url)=='/sandbox/tmp/герой.json'
    checks.append('compiled export writes exact Unicode content, strips path components and presents system share sheet')
    runtime.emit('setTheme','dark');assert runtime.py(runtime.objects[runtime.defaults]['value']['ListTheme'])=='dark'
    style=runtime.call(runtime.methods[('ListController','preferredStatusBarStyle')][0],[runtime.controller,0]);assert style==1
    runtime.emit('setTheme','light');assert runtime.call(runtime.methods[('ListController','preferredStatusBarStyle')][0],[runtime.controller,0])==3
    runtime.call(runtime.methods[('ListController','viewDidLayoutSubviews')][0],[runtime.controller,0]);assert runtime.objects[runtime.web]['frame']==(0.,0.,390.,844.)
    checks.append('theme persistence, status style and real CGRect ARM64 arguments retain original layout contract')
    terminated=runtime.methods[('ListDelegate','webViewWebContentProcessDidTerminate:')][0]
    runtime.call(terminated,[runtime.delegate,0,runtime.web])
    snapshot=next(s for s in runtime.scripts if s.startswith('window.__LIST_NATIVE_SNAPSHOTS='));assert json.loads(snapshot.split('=',1)[1][:-1])==[raw]
    runtime.call(terminated,[runtime.delegate,0,runtime.web]);assert runtime.objects[runtime.web]['reloads']==1;assert runtime.files[path]==raw
    checks.append('bounded process recovery rereads the latest durable snapshot and never erases the native journal')
    report={'passed':True,'checks':checks,'sha256':runtime.info['sha256'],'emulator':'Unicorn ARM64; real compiled code with mocked system APIs','physical_device_tested':False}
    if output:Path(output).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('binary',type=Path);parser.add_argument('--out',type=Path);args=parser.parse_args();verify(args.binary,args.out)

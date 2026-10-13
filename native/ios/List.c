/* Reproducible iOS WebKit shell. UIKit and WebKit are system frameworks.
 * Preserves the original bundle ID, web entry and Application Support/List store.
 */
#include "Runtime.h"
#include "HapticPolicy.h"
#define MAX_STATE_LENGTH (9L*1024*1024)
static Id web, window, controller, statusLabel, contentController;
static Id impacts[5], notification;
static Bool lightTheme=1, interfaceReady=0;
static Integer savedSequence=-1;
static double lastHaptic=-1;
static int processRestarts=0;

static Id Color(double r,double g,double b) {
    return ((Id(*)(Id,Sel,double,double,double,double))objc_msgSend)
        (C("UIColor"),S("colorWithRed:green:blue:alpha:"),r,g,b,1.0);
}
static void Evaluate(Id source) {
    ((void(*)(Id,Sel,Id,Id))objc_msgSend)(web,S("evaluateJavaScript:completionHandler:"),source,0);
}
static void Status(const char *text) {
    V1(statusLabel,"setText:",String(text));VI(statusLabel,"setHidden:",0);
}
static Id StateURL(void) {
    Id manager=O0(C("NSFileManager"),"defaultManager");
    Id urls=((Id(*)(Id,Sel,Integer,UInteger))objc_msgSend)
        (manager,S("URLsForDirectory:inDomains:"),14,1);
    Id directory=O1(O0(urls,"firstObject"),"URLByAppendingPathComponent:",String("List"));
    ((Bool(*)(Id,Sel,Id,Bool,Id,Id))objc_msgSend)
        (manager,S("createDirectoryAtURL:withIntermediateDirectories:attributes:error:"),directory,1,0,0);
    return O1(directory,"URLByAppendingPathComponent:",String("state-v1.json"));
}
static Id ReadState(void) {
    return ((Id(*)(Id,Sel,Id,UInteger,Id))objc_msgSend)
        (C("NSString"),S("stringWithContentsOfURL:encoding:error:"),StateURL(),4,0);
}
static Id JSON(Id object) {
    Id data=((Id(*)(Id,Sel,Id,UInteger,Id))objc_msgSend)
        (C("NSJSONSerialization"),S("dataWithJSONObject:options:error:"),object,0,0);
    if(!data)return 0;
    Id result=((Id(*)(Id,Sel,Id,UInteger))objc_msgSend)
        (O0(C("NSString"),"alloc"),S("initWithData:encoding:"),data,4);
    return O0(result,"autorelease");
}
static Id Parse(Id text) {
    if(!Is(text,"NSString"))return 0;
    Id data=((Id(*)(Id,Sel,UInteger))objc_msgSend)(text,S("dataUsingEncoding:"),4);
    return ((Id(*)(Id,Sel,Id,UInteger,Id))objc_msgSend)
        (C("NSJSONSerialization"),S("JSONObjectWithData:options:error:"),data,0,0);
}
static void AddScript(Id text) {
    Id script=((Id(*)(Id,Sel,Id,Integer,Bool))objc_msgSend)
        (O0(C("WKUserScript"),"alloc"),S("initWithSource:injectionTime:forMainFrameOnly:"),text,0,1);
    V1(contentController,"addUserScript:",script);V0(script,"release");
}
static void InstallScripts(void) {
    V0(contentController,"removeAllUserScripts");
    Id old=ReadState();
    if(old&&I0(old,"length")<=MAX_STATE_LENGTH){
        Id parsed=Parse(old);
        if(Is(parsed,"NSDictionary")&&Equal(O1(parsed,"objectForKey:",String("format")),"list-store")){
            Id seq=O1(parsed,"objectForKey:",String("sequence"));
            if(Is(seq,"NSNumber")){Integer n=I0(seq,"longLongValue");if(n>=0&&n<=9007199254740991L&&n>savedSequence)savedSequence=n;}
        }
        Id snapshots=JSON(O1(C("NSArray"),"arrayWithObject:",old));
        if(snapshots)AddScript(Cat(Cat(String("window.__LIST_NATIVE_SNAPSHOTS="),snapshots),String(";")));
    }
    AddScript(String("(()=>{const send=s=>window.webkit.messageHandlers.appStatus.postMessage(s);document.addEventListener('DOMContentLoaded',()=>{if(document.querySelector('#app .shell'))send('ready');});})();"));
}
static void Ack(Id sequence,Bool ok) {
    if(!Is(sequence,"NSNumber"))return;
    Id n=O0(sequence,"stringValue");
    Evaluate(Cat(Cat(String("window.__listStorageAck&&window.__listStorageAck("),n),String(ok?",true);":",false);")));
}
static void Save(Id body) {
    if(!Is(body,"NSDictionary"))return;
    Id payload=O1(body,"objectForKey:",String("payload")),seq=O1(body,"objectForKey:",String("sequence"));
    if(!Is(seq,"NSNumber"))return;
    Integer number=I0(seq,"longLongValue");
    if(number<0 || number>9007199254740991L)return;
    if(!Is(payload,"NSString")||I0(payload,"length")>MAX_STATE_LENGTH||number<savedSequence){Ack(seq,0);return;}
    Id record=Parse(payload);
    if(!Is(record,"NSDictionary")){Ack(seq,0);return;}
    Id recordSeq=O1(record,"objectForKey:",String("sequence")),version=O1(record,"objectForKey:",String("version"));
    if(!Equal(O1(record,"objectForKey:",String("format")),"list-store")||
       !Is(recordSeq,"NSNumber")||I0(recordSeq,"longLongValue")!=number||
       !Is(version,"NSNumber")||I0(version,"integerValue")!=1||
       !Is(O1(record,"objectForKey:",String("body")),"NSString")||
       !Is(O1(record,"objectForKey:",String("hash")),"NSString")){Ack(seq,0);return;}
    Bool ok=((Bool(*)(Id,Sel,Id,Bool,UInteger,Id))objc_msgSend)
        (payload,S("writeToURL:atomically:encoding:error:"),StateURL(),1,4,0);
    if(ok)savedSequence=number;
    Ack(seq,ok);
}
static void UpdateIcon(void) {
    Id app=O0(C("UIApplication"),"sharedApplication");
    if(I0(app,"applicationState")!=0||!B0(app,"supportsAlternateIcons"))return;
    Bool dark=I0(O0(window,"traitCollection"),"userInterfaceStyle")==2;
    Id current=O0(app,"alternateIconName");
    if(dark?Equal(current,"Dark"):!current)return;
    ((void(*)(Id,Sel,Id,Id))objc_msgSend)(app,S("setAlternateIconName:completionHandler:"),dark?String("Dark"):0,0);
}
static void Theme(Id theme) {
    if(!Equal(theme,"light")&&!Equal(theme,"dark"))return;
    lightTheme=Equal(theme,"light");
    O2(O0(C("NSUserDefaults"),"standardUserDefaults"),"setObject:forKey:",theme,String("ListTheme"));
    Id color=lightTheme?Color(.95,.91,.84):Color(.263,.263,.278);
    V1(window,"setBackgroundColor:",color);V1(O0(controller,"view"),"setBackgroundColor:",color);
    V1(web,"setBackgroundColor:",color);V1(O0(web,"scrollView"),"setBackgroundColor:",color);
    V0(controller,"setNeedsStatusBarAppearanceUpdate");
}
static void Export(Id body) {
    if(!Is(body,"NSDictionary"))return;
    Id text=O1(body,"objectForKey:",String("text")),name=O1(body,"objectForKey:",String("name"));
    if(!Is(text,"NSString")||I0(text,"length")>MAX_STATE_LENGTH)return;
    name=Is(name,"NSString")?O0(name,"lastPathComponent"):String("Персонаж.json");
    if(I0(name,"length")==0||I0(name,"length")>200)name=String("Персонаж.json");
    Id path=O1(NSTemporaryDirectory(),"stringByAppendingPathComponent:",name);
    Bool ok=((Bool(*)(Id,Sel,Id,Bool,UInteger,Id))objc_msgSend)
        (text,S("writeToFile:atomically:encoding:error:"),path,1,4,0);
    if(!ok){Evaluate(String("(()=>{const t=document.getElementById('toast');if(t){t.textContent='Не удалось подготовить файл экспорта.';t.classList.add('on');setTimeout(()=>t.classList.remove('on'),3500);}})();"));return;}
    Id url=O1(C("NSURL"),"fileURLWithPath:",path);
    Id items=O1(C("NSArray"),"arrayWithObject:",url);
    Id share=O2(O0(C("UIActivityViewController"),"alloc"),"initWithActivityItems:applicationActivities:",items,0);
    Id pop=O0(share,"popoverPresentationController");
    Id view=O0(controller,"view");V1(pop,"setSourceView:",view);
    Rect r=R0(view,"bounds");r=(Rect){{r.size.width/2,r.size.height/2},{1,1}};VR(pop,"setSourceRect:",r);
    ((void(*)(Id,Sel,Id,Bool,Id))objc_msgSend)(controller,S("presentViewController:animated:completion:"),share,1,0);
    V0(share,"release");
}
static void Haptic(Id body) {
    if(!Is(body,"NSDictionary")||!B0(C("NSThread"),"isMainThread"))return;
    Id name=O1(body,"objectForKey:",String("kind"));
    if(!Is(name,"NSString")||I0(name,"length")>32)return;
    ListHaptic choice;if(!ListHapticForKind(UTF8(name),&choice))return;
    Id app=O0(C("UIApplication"),"sharedApplication");
    Bool visible=O0(web,"window")&&!B0(web,"isHidden")&&interfaceReady;
    double now=D0(O0(C("NSDate"),"date"),"timeIntervalSinceReferenceDate");
    if(!ListHapticAllowed(1,I0(app,"applicationState")==0,visible,now,lastHaptic))return;
    lastHaptic=now;
    if(choice.notification){
        if(!notification)notification=New("UINotificationFeedbackGenerator");
        V0(notification,"prepare");VI(notification,"notificationOccurred:",choice.style);
    }else{
        Id generator=impacts[choice.style];
        if(!generator){
            generator=((Id(*)(Id,Sel,Integer))objc_msgSend)
                (O0(C("UIImpactFeedbackGenerator"),"alloc"),S("initWithStyle:"),choice.style);
            impacts[choice.style]=generator;
        }
        V0(generator,"prepare");
        ((void(*)(Id,Sel,double))objc_msgSend)(generator,S("impactOccurredWithIntensity:"),choice.intensity);
    }
}
static void Message(Id self,Sel command,Id userController,Id message) {
    (void)self;(void)command;
    if(userController!=contentController||!B0(O0(message,"frameInfo"),"isMainFrame"))return;
    Id name=O0(message,"name"),body=O0(message,"body");
    if(Equal(name,"haptic"))Haptic(body);
    else if(Equal(name,"saveState"))Save(body);
    else if(Equal(name,"setTheme"))Theme(body);
    else if(Equal(name,"exportFile"))Export(body);
    else if(Equal(name,"appStatus")&&Equal(body,"ready")){interfaceReady=1;VI(statusLabel,"setHidden:",1);}
}
static Integer StatusStyle(Id self,Sel command){(void)self;(void)command;return lightTheme?3:1;}
static Bool HideHome(Id self,Sel command){(void)self;(void)command;return 1;}
static void Layout(Id self,Sel command) {
    (void)command;Rect r=R0(O0(self,"view"),"bounds");VR(web,"setFrame:",r);
    Rect label={{24,80},{r.size.width-48,r.size.height-160}};VR(statusLabel,"setFrame:",label);
}
/* A navigation decisionHandler is a system Objective-C block. */
typedef struct { void *isa; int flags,reserved; void (*invoke)(void *,Integer); } DecisionBlock;
static void Policy(Id self,Sel command,Id view,Id action,Id decision) {
    (void)self;(void)command;(void)view;
    Id url=O0(O0(action,"request"),"URL"),scheme=O0(url,"scheme");
    Bool local=Equal(scheme,"file")||Equal(scheme,"about");
    if(!local&&I0(action,"navigationType")==0&&(Equal(scheme,"https")||Equal(scheme,"http")||Equal(scheme,"mailto"))){
        Id app=O0(C("UIApplication"),"sharedApplication");
        ((void(*)(Id,Sel,Id,Id,Id))objc_msgSend)(app,S("openURL:options:completionHandler:"),url,O0(C("NSDictionary"),"dictionary"),0);
    }
    if(decision)((DecisionBlock*)decision)->invoke(decision,local?1:0);
}
static Id NewWindow(Id self,Sel command,Id view,Id config,Id action,Id features) {
    (void)self;(void)command;(void)view;(void)config;(void)features;
    Id request=O0(action,"request"),scheme=O0(O0(request,"URL"),"scheme");
    if(Equal(scheme,"file"))O1(web,"loadRequest:",request);
    else if((Equal(scheme,"https")||Equal(scheme,"http"))&&I0(action,"navigationType")==0){
        ((void(*)(Id,Sel,Id,Id,Id))objc_msgSend)(O0(C("UIApplication"),"sharedApplication"),S("openURL:options:completionHandler:"),O0(request,"URL"),O0(C("NSDictionary"),"dictionary"),0);
    }
    return 0;
}
static void Failed(Id self,Sel command,Id view,Id navigation,Id error) {
    (void)self;(void)command;(void)view;(void)navigation;
    if(I0(error,"code")==-999)return;
    Status("Не удалось открыть лист. Закрой и снова открой приложение. Сохранения остаются в памяти телефона.");
}
static void Terminated(Id self,Sel command,Id view) {
    (void)self;(void)command;(void)view;interfaceReady=0;
    if(processRestarts++){Status("Лист остановился. Закрой и снова открой приложение. Сохранения остаются в памяти телефона.");return;}
    Status("Открываем лист…");InstallScripts();O0(web,"reload");
}
static void Timeout(Id self,Sel command,Id unused) {
    (void)self;(void)command;(void)unused;
    if(!interfaceReady)Status("Лист не открылся. Закрой и снова открой приложение. Сохранения остаются в памяти телефона.");
}
static void Active(Id self,Sel command,Id app) {
    (void)self;(void)command;(void)app;lastHaptic=-1;UpdateIcon();
}
static Bool Launch(Id self,Sel command,Id app,Id options) {
    (void)command;(void)app;(void)options;
    Id defaults=O0(C("NSUserDefaults"),"standardUserDefaults");
    Id theme=O1(defaults,"stringForKey:",String("ListTheme"));lightTheme=!Equal(theme,"dark");
    Rect bounds=R0(O0(C("UIScreen"),"mainScreen"),"bounds");
    window=((Id(*)(Id,Sel,Rect))objc_msgSend)(O0(C("UIWindow"),"alloc"),S("initWithFrame:"),bounds);
    controller=New("ListController");
    Id configuration=New("WKWebViewConfiguration");contentController=O0(configuration,"userContentController");
    VI(configuration,"setIgnoresViewportScaleLimits:",0);
    const char *handlers[]={"exportFile","appStatus","saveState","setTheme","haptic"};
    for(int i=0;i<5;i++)O2(contentController,"addScriptMessageHandler:name:",self,String(handlers[i]));
    InstallScripts();
    web=((Id(*)(Id,Sel,Rect,Id))objc_msgSend)(O0(C("WKWebView"),"alloc"),S("initWithFrame:configuration:"),bounds,configuration);
    V0(configuration,"release");V1(web,"setNavigationDelegate:",self);V1(web,"setUIDelegate:",self);
    VI(web,"setOpaque:",0);VI(web,"setAutoresizingMask:",18);VI(web,"setAllowsBackForwardNavigationGestures:",1);
    Id view=O0(controller,"view");V1(view,"addSubview:",web);
    statusLabel=((Id(*)(Id,Sel,Rect))objc_msgSend)(O0(C("UILabel"),"alloc"),S("initWithFrame:"),bounds);
    VI(statusLabel,"setNumberOfLines:",0);VI(statusLabel,"setTextAlignment:",1);
    V1(statusLabel,"setTextColor:",lightTheme?Color(.23,.21,.19):Color(.94,.93,.92));
    Id font=((Id(*)(Id,Sel,double))objc_msgSend)(C("UIFont"),S("systemFontOfSize:"),18);
    V1(statusLabel,"setFont:",font);Status("Открываем лист…");V1(view,"addSubview:",statusLabel);
    V1(window,"setRootViewController:",controller);Theme(lightTheme?String("light"):String("dark"));
    V0(window,"makeKeyAndVisible");
    Id bundle=O0(O0(C("NSBundle"),"mainBundle"),"bundleURL");bundle=O0(bundle,"URLByResolvingSymlinksInPath");
    Id directory=O1(bundle,"URLByAppendingPathComponent:",String("web"));
    Id entry=O1(directory,"URLByAppendingPathComponent:",String("ios-entry.html"));
    if(B1(O0(C("NSFileManager"),"defaultManager"),"fileExistsAtPath:",O0(entry,"path")))
        O2(web,"loadFileURL:allowingReadAccessToURL:",entry,directory);
    else Status("Не найден файл листа. Переустанови приложение из актуальной IPA.");
    ((void(*)(Id,Sel,Sel,Id,double))objc_msgSend)(self,S("performSelector:withObject:afterDelay:"),S("startupTimeout:"),0,20);
    UpdateIcon();return 1;
}
int main(int argc,char **argv) {
    void *pool=objc_autoreleasePoolPush();
    Class vc=objc_allocateClassPair(C("UIViewController"),"ListController",0);
    Method(vc,"preferredStatusBarStyle",(void(*)(void))StatusStyle,"q@:");
    Method(vc,"prefersHomeIndicatorAutoHidden",(void(*)(void))HideHome,"B@:");
    Method(vc,"viewDidLayoutSubviews",(void(*)(void))Layout,"v@:");objc_registerClassPair(vc);
    Class delegate=objc_allocateClassPair(C("NSObject"),"ListDelegate",0);
    const char *protocols[]={"UIApplicationDelegate","WKNavigationDelegate","WKScriptMessageHandler","WKUIDelegate"};
    for(int i=0;i<4;i++)class_addProtocol(delegate,objc_getProtocol(protocols[i]));
    Method(delegate,"application:didFinishLaunchingWithOptions:",(void(*)(void))Launch,"B@:@@");
    Method(delegate,"applicationDidBecomeActive:",(void(*)(void))Active,"v@:@");
    Method(delegate,"userContentController:didReceiveScriptMessage:",(void(*)(void))Message,"v@:@@");
    Method(delegate,"webView:decidePolicyForNavigationAction:decisionHandler:",(void(*)(void))Policy,"v@:@@@?");
    Method(delegate,"webView:createWebViewWithConfiguration:forNavigationAction:windowFeatures:",(void(*)(void))NewWindow,"@@:@@@@");
    Method(delegate,"webView:didFailNavigation:withError:",(void(*)(void))Failed,"v@:@@@");
    Method(delegate,"webView:didFailProvisionalNavigation:withError:",(void(*)(void))Failed,"v@:@@@");
    Method(delegate,"webViewWebContentProcessDidTerminate:",(void(*)(void))Terminated,"v@:@");
    Method(delegate,"startupTimeout:",(void(*)(void))Timeout,"v@:@");objc_registerClassPair(delegate);
    int result=UIApplicationMain(argc,argv,0,String("ListDelegate"));objc_autoreleasePoolPop(pool);return result;
}

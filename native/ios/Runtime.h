/* Minimal public Objective-C runtime declarations; no copied Apple SDK. */
#ifndef LIST_IOS_RUNTIME_H
#define LIST_IOS_RUNTIME_H
typedef void *Id;
typedef void *Class;
typedef void *Sel;
typedef _Bool Bool;
typedef long Integer;
typedef unsigned long UInteger;
typedef struct { double x,y; } Point;
typedef struct { double width,height; } Size;
typedef struct { Point origin; Size size; } Rect;
extern Class objc_getClass(const char *);
extern Class objc_allocateClassPair(Class,const char *,UInteger);
extern void objc_registerClassPair(Class);
extern Sel sel_registerName(const char *);
extern Bool class_addMethod(Class,Sel,void (*)(void),const char *);
extern Id objc_getProtocol(const char *);
extern Bool class_addProtocol(Class,Id);
extern void objc_msgSend(void);
extern void *objc_autoreleasePoolPush(void);
extern void objc_autoreleasePoolPop(void *);
extern int UIApplicationMain(int,char **,Id,Id);
extern Id NSTemporaryDirectory(void);
#define S(name) sel_registerName(name)
#define C(name) objc_getClass(name)
/* Exact prototypes matter: arm64 CGRect is a four-double homogeneous aggregate. */
static Id O0(Id o,const char *s){return ((Id(*)(Id,Sel))objc_msgSend)(o,S(s));}
static Id O1(Id o,const char *s,Id a){return ((Id(*)(Id,Sel,Id))objc_msgSend)(o,S(s),a);}
static Id O2(Id o,const char *s,Id a,Id b){return ((Id(*)(Id,Sel,Id,Id))objc_msgSend)(o,S(s),a,b);}
static void V0(Id o,const char *s){((void(*)(Id,Sel))objc_msgSend)(o,S(s));}
static void V1(Id o,const char *s,Id a){((void(*)(Id,Sel,Id))objc_msgSend)(o,S(s),a);}
static void VI(Id o,const char *s,Integer n){((void(*)(Id,Sel,Integer))objc_msgSend)(o,S(s),n);}
static Bool B0(Id o,const char *s){return ((Bool(*)(Id,Sel))objc_msgSend)(o,S(s));}
static Bool B1(Id o,const char *s,Id a){return ((Bool(*)(Id,Sel,Id))objc_msgSend)(o,S(s),a);}
static Integer I0(Id o,const char *s){return ((Integer(*)(Id,Sel))objc_msgSend)(o,S(s));}
static double D0(Id o,const char *s){return ((double(*)(Id,Sel))objc_msgSend)(o,S(s));}
static Rect R0(Id o,const char *s){return ((Rect(*)(Id,Sel))objc_msgSend)(o,S(s));}
static void VR(Id o,const char *s,Rect r){((void(*)(Id,Sel,Rect))objc_msgSend)(o,S(s),r);}
static Id String(const char *s){return ((Id(*)(Id,Sel,const char *))objc_msgSend)(C("NSString"),S("stringWithUTF8String:"),s);}
static const char *UTF8(Id o){return ((const char *(*)(Id,Sel))objc_msgSend)(o,S("UTF8String"));}
static Bool Is(Id o,const char *cls){return o && B1(o,"isKindOfClass:",C(cls));}
static Bool Equal(Id o,const char *s){return Is(o,"NSString") && B1(o,"isEqualToString:",String(s));}
static Id New(const char *cls){return O0(O0(C(cls),"alloc"),"init");}
static Id Cat(Id a,Id b){return O1(a,"stringByAppendingString:",b);}
static void Method(Class cls,const char *name,void (*fn)(void),const char *type){class_addMethod(cls,S(name),fn,type);}
#endif

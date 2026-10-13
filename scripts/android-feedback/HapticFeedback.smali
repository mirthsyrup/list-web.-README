.class public final Lru/seriylist/app/HapticFeedback;
.super Ljava/lang/Object;
.source "HapticFeedback.java"
.implements Ljava/lang/Runnable;

.field private static lastUptime:J
.field private final web:Landroid/webkit/WebView;
.field private final effect:I

.method static constructor <clinit>()V
    .registers 2
    const-wide/16 v0, -0x78
    sput-wide v0, Lru/seriylist/app/HapticFeedback;->lastUptime:J
    return-void
.end method

.method private constructor <init>(Landroid/webkit/WebView;I)V
    .registers 3
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    iput-object p1, p0, Lru/seriylist/app/HapticFeedback;->web:Landroid/webkit/WebView;
    iput p2, p0, Lru/seriylist/app/HapticFeedback;->effect:I
    return-void
.end method

.method public static request(Landroid/webkit/WebView;Ljava/lang/String;)V
    .registers 5
    if-eqz p0, :done
    if-eqz p1, :done
    const-string v0, "damage"
    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-nez v1, :context
    const-string v0, "heal"
    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-nez v1, :tick
    const-string v0, "roll"
    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-nez v1, :tick
    const-string v0, "test"
    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-nez v1, :tick
    const-string v0, "critical-success"
    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-nez v1, :success
    const-string v0, "critical-failure"
    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-nez v1, :failure
    const-string v0, "invalid"
    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-nez v1, :failure
    const-string v0, "error"
    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z
    move-result v1
    if-eqz v1, :done
    :failure
    sget v0, Landroid/os/Build$VERSION;->SDK_INT:I
    const/16 v1, 0x1e
    if-lt v0, v1, :context
    const/16 v2, 0x11
    goto :post
    :success
    sget v0, Landroid/os/Build$VERSION;->SDK_INT:I
    const/16 v1, 0x1e
    if-lt v0, v1, :long_press
    const/16 v2, 0x10
    goto :post
    :long_press
    const/4 v2, 0x0
    goto :post
    :context
    const/4 v2, 0x6
    goto :post
    :tick
    const/4 v2, 0x4
    :post
    :try_start
    new-instance v0, Lru/seriylist/app/HapticFeedback;
    invoke-direct {v0, p0, v2}, Lru/seriylist/app/HapticFeedback;-><init>(Landroid/webkit/WebView;I)V
    invoke-virtual {p0, v0}, Landroid/webkit/WebView;->post(Ljava/lang/Runnable;)Z
    :try_end
    .catch Ljava/lang/RuntimeException; {:try_start .. :try_end} :catch
    :done
    return-void
    :catch
    move-exception v0
    return-void
.end method

.method public run()V
    .registers 9
    :try_start
    iget-object v0, p0, Lru/seriylist/app/HapticFeedback;->web:Landroid/webkit/WebView;
    invoke-virtual {v0}, Landroid/webkit/WebView;->isAttachedToWindow()Z
    move-result v1
    if-eqz v1, :done
    invoke-virtual {v0}, Landroid/webkit/WebView;->isShown()Z
    move-result v1
    if-eqz v1, :done
    invoke-virtual {v0}, Landroid/webkit/WebView;->hasWindowFocus()Z
    move-result v1
    if-eqz v1, :done
    invoke-static {}, Landroid/os/SystemClock;->uptimeMillis()J
    move-result-wide v2
    sget-wide v4, Lru/seriylist/app/HapticFeedback;->lastUptime:J
    cmp-long v1, v2, v4
    if-ltz v1, :perform
    sub-long v4, v2, v4
    const-wide/16 v6, 0x78
    cmp-long v1, v4, v6
    if-ltz v1, :done
    :perform
    sput-wide v2, Lru/seriylist/app/HapticFeedback;->lastUptime:J
    iget v1, p0, Lru/seriylist/app/HapticFeedback;->effect:I
    const/4 v2, 0x0
    invoke-virtual {v0, v1, v2}, Landroid/webkit/WebView;->performHapticFeedback(II)Z
    :try_end
    .catch Ljava/lang/RuntimeException; {:try_start .. :try_end} :catch
    :done
    return-void
    :catch
    move-exception v0
    return-void
.end method

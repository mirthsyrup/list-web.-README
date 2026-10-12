.class public final Lru/seriylist/app/HighRefresh;
.super Ljava/lang/Object;
.source "HighRefresh.java"

# A display preference, not a timer or a promise of 120 rendered frames/second.
# All called APIs exist at API 23; the application requires API 26.
.method public static apply(Landroid/app/Activity;)V
    .locals 12

    :try_start
    invoke-virtual {p0}, Landroid/app/Activity;->getWindow()Landroid/view/Window;
    move-result-object v0
    if-eqz v0, :done
    invoke-virtual {v0}, Landroid/view/Window;->getAttributes()Landroid/view/WindowManager$LayoutParams;
    move-result-object v1
    const/4 v2, 0x0

    const-string v3, "power"
    invoke-virtual {p0, v3}, Landroid/app/Activity;->getSystemService(Ljava/lang/String;)Ljava/lang/Object;
    move-result-object v3
    check-cast v3, Landroid/os/PowerManager;
    if-eqz v3, :select
    invoke-virtual {v3}, Landroid/os/PowerManager;->isPowerSaveMode()Z
    move-result v3
    if-nez v3, :apply

    :select
    invoke-virtual {p0}, Landroid/app/Activity;->getWindowManager()Landroid/view/WindowManager;
    move-result-object v3
    invoke-interface {v3}, Landroid/view/WindowManager;->getDefaultDisplay()Landroid/view/Display;
    move-result-object v3
    if-eqz v3, :done
    invoke-virtual {v3}, Landroid/view/Display;->getMode()Landroid/view/Display$Mode;
    move-result-object v4
    invoke-virtual {v4}, Landroid/view/Display$Mode;->getPhysicalWidth()I
    move-result v5
    invoke-virtual {v4}, Landroid/view/Display$Mode;->getPhysicalHeight()I
    move-result v6
    invoke-virtual {v4}, Landroid/view/Display$Mode;->getRefreshRate()F
    move-result v7
    invoke-virtual {v3}, Landroid/view/Display;->getSupportedModes()[Landroid/view/Display$Mode;
    move-result-object v3
    const/4 v8, 0x0

    :loop
    array-length v9, v3
    if-ge v8, v9, :apply
    aget-object v9, v3, v8
    invoke-virtual {v9}, Landroid/view/Display$Mode;->getPhysicalWidth()I
    move-result v10
    if-ne v10, v5, :next
    invoke-virtual {v9}, Landroid/view/Display$Mode;->getPhysicalHeight()I
    move-result v10
    if-ne v10, v6, :next
    invoke-virtual {v9}, Landroid/view/Display$Mode;->getRefreshRate()F
    move-result v10
    cmpg-float v11, v10, v7
    if-ltz v11, :next
    move v7, v10
    invoke-virtual {v9}, Landroid/view/Display$Mode;->getModeId()I
    move-result v2

    :next
    add-int/lit8 v8, v8, 0x1
    goto :loop

    :apply
    iget v3, v1, Landroid/view/WindowManager$LayoutParams;->preferredDisplayModeId:I
    if-eq v3, v2, :done
    iput v2, v1, Landroid/view/WindowManager$LayoutParams;->preferredDisplayModeId:I
    invoke-virtual {v0, v1}, Landroid/view/Window;->setAttributes(Landroid/view/WindowManager$LayoutParams;)V
    :try_end
    .catch Ljava/lang/RuntimeException; {:try_start .. :try_end} :unsupported

    :done
    return-void

    :unsupported
    move-exception v0
    return-void
.end method

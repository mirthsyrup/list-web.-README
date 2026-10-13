package ru.seriylist.app;

import android.os.Build;
import android.os.SystemClock;
import android.webkit.WebView;

/** NativeBridge.haptic calls request; View settings are always respected. */
public final class HapticFeedback implements Runnable {
    private static long lastUptime = -120L;
    private final WebView web;
    private final int effect;

    private HapticFeedback(WebView web, int effect) {
        this.web = web;
        this.effect = effect;
    }

    public static void request(WebView web, String kind) {
        if (web == null || kind == null) return;
        int effect;
        if ("damage".equals(kind)) effect = 6; // CONTEXT_CLICK
        else if ("heal".equals(kind) || "roll".equals(kind) || "test".equals(kind)) effect = 4; // CLOCK_TICK
        else if ("critical-success".equals(kind)) effect = Build.VERSION.SDK_INT >= 30 ? 16 : 0; // CONFIRM / LONG_PRESS
        else if ("critical-failure".equals(kind) || "invalid".equals(kind) || "error".equals(kind)) effect = Build.VERSION.SDK_INT >= 30 ? 17 : 6; // REJECT / CONTEXT_CLICK
        else return;
        try {
            web.post(new HapticFeedback(web, effect));
        } catch (RuntimeException ignored) {
            // A detached or destroyed WebView must never interrupt game actions.
        }
    }

    @Override public void run() {
        try {
            if (!web.isAttachedToWindow() || !web.isShown() || !web.hasWindowFocus()) return;
            long now = SystemClock.uptimeMillis();
            if (now >= lastUptime && now - lastUptime < 120L) return;
            lastUptime = now;
            web.performHapticFeedback(effect, 0);
        } catch (RuntimeException ignored) {
            // No IGNORE_* flags, no vibrator permission, no hardware assumptions.
        }
    }
}

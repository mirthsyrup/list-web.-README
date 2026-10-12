package ru.seriylist.app;

import android.app.Activity;
import android.os.PowerManager;
import android.view.Display;
import android.view.Window;
import android.view.WindowManager;

/** Readable equivalent of HighRefresh.smali; for the original Android project. */
public final class HighRefresh {
    private HighRefresh() {}

    // Call after super.onResume(). Minimum supported Android API: 23.
    public static void apply(Activity activity) {
        try {
            Window window = activity.getWindow();
            if (window == null) return;
            WindowManager.LayoutParams attributes = window.getAttributes();
            PowerManager power = (PowerManager) activity.getSystemService("power");
            int preferredMode = 0; // Zero returns control to the system.
            if (power == null || !power.isPowerSaveMode()) {
                Display display = activity.getWindowManager().getDefaultDisplay();
                if (display == null) return;
                Display.Mode current = display.getMode();
                float refreshRate = current.getRefreshRate();
                for (Display.Mode mode : display.getSupportedModes()) {
                    if (mode.getPhysicalWidth() == current.getPhysicalWidth()
                            && mode.getPhysicalHeight() == current.getPhysicalHeight()
                            && mode.getRefreshRate() >= refreshRate) {
                        refreshRate = mode.getRefreshRate();
                        preferredMode = mode.getModeId();
                    }
                }
            }
            if (attributes.preferredDisplayModeId != preferredMode) {
                attributes.preferredDisplayModeId = preferredMode;
                window.setAttributes(attributes);
            }
        } catch (RuntimeException unsupportedDisplay) {
            // A vendor display API failure must not prevent opening the sheet.
        }
    }
}

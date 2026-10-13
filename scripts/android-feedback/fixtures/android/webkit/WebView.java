package android.webkit;
import java.util.ArrayDeque;
public class WebView {
    public final ArrayDeque<Runnable> queue = new ArrayDeque<Runnable>();
    public boolean attached = true, shown = true, focused = true, enabled = true;
    public boolean failPost, failVisibility, failPerform;
    public int attempts, effects, lastEffect = -1, lastFlags = -1;
    public Thread effectThread;
    public boolean post(Runnable action) {
        if (failPost) throw new IllegalStateException("destroyed");
        queue.add(action); return true;
    }
    public boolean isAttachedToWindow() { if (failVisibility) throw new IllegalStateException("gone"); return attached; }
    public boolean isShown() { return shown; }
    public boolean hasWindowFocus() { return focused; }
    public boolean performHapticFeedback(int effect, int flags) {
        attempts++; effectThread = Thread.currentThread(); lastEffect = effect; lastFlags = flags;
        if (failPerform) throw new IllegalStateException("device failure");
        if (enabled) effects++;
        return enabled;
    }
    public void flush() { while (!queue.isEmpty()) queue.remove().run(); }
}

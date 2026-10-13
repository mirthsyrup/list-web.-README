import android.os.Build;
import android.os.SystemClock;
import android.webkit.WebView;
import java.lang.reflect.Field;
import ru.seriylist.app.HapticFeedback;

/** Executes the assembled DEX after enjarify translation, not a mocked helper. */
public class HapticFeedbackFixture {
    static int passed;
    static void equal(long actual, long expected, String label) {
        if (actual != expected) throw new AssertionError(label + ": " + actual + " != " + expected);
        passed++;
    }
    static WebView fresh(int sdk) throws Exception {
        Field clock = HapticFeedback.class.getDeclaredField("lastUptime");
        clock.setAccessible(true); clock.setLong(null, -120L);
        Build.VERSION.SDK_INT = sdk; SystemClock.now = 1000L; return new WebView();
    }
    static void effect(String kind, int sdk, int expected) throws Exception {
        WebView web = fresh(sdk); HapticFeedback.request(web, kind);
        equal(web.attempts, 0, "no off-thread immediate vibration"); web.flush();
        equal(web.effects, 1, "one " + kind + " effect on SDK" + sdk);
        equal(web.lastEffect, expected, kind + " mapping");
        equal(web.lastFlags, 0, "never ignores device settings");
    }
    public static void main(String[] args) throws Exception {
        effect("damage",26,6); effect("heal",26,4); effect("roll",34,4); effect("test",34,4);
        effect("critical-success",26,0); effect("critical-success",29,0); effect("critical-success",30,16); effect("critical-success",34,16);
        effect("critical-failure",26,6); effect("critical-failure",29,6); effect("critical-failure",30,17);
        effect("invalid",34,17); effect("error",26,6);
        WebView web = fresh(34);
        HapticFeedback.request(null,"damage"); HapticFeedback.request(web,null);
        HapticFeedback.request(web,""); HapticFeedback.request(web,"LONG_PRESS"); HapticFeedback.request(web,"damage ");
        equal(web.queue.size(),0,"invalid input never dispatched");
        final WebView threaded = web;
        Thread worker = new Thread(() -> HapticFeedback.request(threaded,"damage")); worker.start(); worker.join();
        equal(web.attempts,0,"bridge worker does not perform effect"); web.flush();
        if (web.effectThread != Thread.currentThread()) throw new AssertionError("effect must run on UI dispatcher"); passed++;
        for (int i=0;i<25;i++) HapticFeedback.request(web,"damage"); web.flush();
        equal(web.attempts,1,"rapid repeated events bounded");
        SystemClock.now = 1119L; HapticFeedback.request(web,"heal"); web.flush(); equal(web.attempts,1,"119ms debounced");
        SystemClock.now = 1120L; HapticFeedback.request(web,"heal"); web.flush(); equal(web.attempts,2,"120ms allowed");
        SystemClock.now = 500L; HapticFeedback.request(web,"heal"); web.flush(); equal(web.attempts,3,"clock reset safe");
        web = fresh(34); web.attached=false; HapticFeedback.request(web,"damage"); web.flush(); equal(web.attempts,0,"detached");
        web.attached=true; web.shown=false; HapticFeedback.request(web,"damage"); web.flush(); equal(web.attempts,0,"hidden");
        web.shown=true; web.focused=false; HapticFeedback.request(web,"damage"); web.flush(); equal(web.attempts,0,"background");
        web.focused=true; HapticFeedback.request(web,"damage"); web.focused=false; web.flush(); equal(web.attempts,0,"became background while queued");
        web = fresh(34); web.enabled=false; HapticFeedback.request(web,"damage"); web.flush(); equal(web.effects,0,"system haptics disabled"); equal(web.lastFlags,0,"disabled setting respected");
        web = fresh(34); web.failPost=true; HapticFeedback.request(web,"damage"); equal(web.attempts,0,"destroyed dispatcher tolerated");
        web = fresh(34); web.failVisibility=true; HapticFeedback.request(web,"damage"); web.flush(); equal(web.attempts,0,"visibility exception tolerated");
        web = fresh(34); web.failPerform=true; HapticFeedback.request(web,"damage"); web.flush(); equal(web.attempts,1,"hardware exception tolerated");
        System.out.println("PASS " + passed + " native haptic assertions (assembled DEX translated to JVM; not device testing)");
    }
}

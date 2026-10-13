# Android haptic bridge

`patch_android_feedback.py` accepts only the reviewed HighRefresh DEX SHA256
`0107789ad11fd0dff585b61a6eae52b2954f609f00160f731309dff4aae5fd8a`.
It verifies local smali tools against the pins in `patch_android_refresh.py`,
adds one helper and `NativeBridge.haptic(String)`, and checks the disassembled
output preserves all existing methods and classes. It never signs or publishes.

```sh
python scripts/patch_android_feedback.py \
  --dex /path/classes-refresh.dex \
  --output /path/classes-feedback.dex \
  --tools-dir /path/smali-tools
```

`HapticFeedback.java` is the readable equivalent of the shipped smali helper.
Effects are Android constants; API30 CONFIRM/REJECT use API26 fallbacks.
Supported events are `damage`, `heal`, `roll`, `critical-success`,
`critical-failure`, `invalid`, `error` (alias), and `test`.

The WebView queues work onto the main thread. Effects require attachment,
visibility and window focus at execution time, and have a 120ms debounce.
`performHapticFeedback(effect, 0)` respects device settings, requires no
VIBRATE permission, and can silently do nothing on unsupported hardware.
Exceptions from a destroyed WebView or device are contained.

## Verification

Translate the assembled DEX with enjarify, then compile the fixtures against
that JAR using ECJ (Java8 output) or javac. Run `HapticFeedbackFixture` with
the fixture classes first on the classpath and the translated JAR second.
The Android stubs model the main-thread queue and device setting. The suite
checks worker dispatch, API mappings, debounce boundaries, foreground changes,
disabled haptics, invalid inputs and exception containment. It exercises the
assembled DEX, not a substitute implementation.

Compile the readable Java helper against the same fixture stubs into a separate
directory and run the fixture again with that directory instead of the JAR.
Both paths must pass the same 68 assertions. These JVM checks are not physical
Android device testing and do not establish how strong an effect feels.

There is no iOS haptic bridge in the existing IPA. Adding iPhone haptics requires
native iOS source and a reproducible build; this Android patch does not change
the iOS executable or imply that Safari can vibrate.

# iOS startup fix 2.9.5

The iPhone 13 Pro crash report for IPA 2.9.3 (build 292) on iOS 27.0
identifies `EXC_BAD_ACCESS` at address `0x44`, before `UIApplicationMain`.
The stack is `class_addProtocol` → `class_conformsToProtocol` →
`_class_conformsToProtocol_unrealized_nolock`. The app frame is `main + 332`
(image offset 16716). In that executable this is the return address of the
call adding `WKUIDelegate` to the still-constructing `ListDelegate` class.

The shell now installs methods, registers the class and sends its inherited
`+class` method to trigger normal Objective-C runtime realization before
adding protocols. It also skips any protocol absent from the runtime.
This removes the observed construction-time/unrealized conformance walk.
No web logic, haptic policy, bundle ID or storage path changes are needed.

The ARM64 mock harness previously returned success for every protocol operation,
so it missed this startup ordering problem. It now tracks registration and
realization, models the failing WKUIDelegate path, checks every protocol is
added after both steps and covers an unavailable protocol. The original 2.9.3
binary fails this check; the corrected binary passes it and the existing
native storage, export, haptic and process recovery checks.

These are compiled ARM64 checks with mocked system APIs, not an iPhone UIKit
execution. The packaged HTML is separately checked for native snapshot
restoration, saving, export and haptic commands in a browser harness. Physical
device startup still needs confirmation after normal sideload re-signing.

# 2.8.4: motion only

Removes the visible “Здоровье и защита” heading; its section keeps an accessible name.

Ordinary renders reconcile existing DOM nodes. Pages and categories fade the previous scene before bringing in the new one. Popup close retains DOM and scroll lock until exit finishes; reopening cancels it. Accordions reverse from the current intermediate height. Filters, searches, controls, toast opacity and HP meters use short transitions. Card ordering preserves placeholder spacing and uses transforms with time-based edge scrolling.

No combat mode, biography, color presets or stat feedback are introduced.

## Verification

64 tests passed: 47 rules/archetypes/storage tests, 16 motion/state integration tests, one ZIP bootstrap test. All root JavaScript files passed syntax checks; both stylesheets parsed successfully.

Tests exercise rapid switching, redraw during entry, focus/draft/caret preservation, close/reopen races, nested popup history, repeated searches, interrupted folds, cross-section card identity, reduced motion and preference changes, drag/drop and scroll preservation, completed-note return, persisted collapsed groups, filter selection and expansion.

The ZIP test executes the public loader and generated blob scripts in JSDOM. It supplies native setImmediate because JSDOM does not implement the vendor ZIP library’s browser scheduling shim reliably.

JSDOM and a controllable Web Animations mock verify DOM/state/lifecycle behavior. They do not measure browser layout, frame rate, visual quality or physical iPhone smoothness. Browser/phone visual QA was unavailable in this environment.

## Reproduction

From a repository checkout (Node 22+, Python 3):

```sh
python -m zipfile -e list-site-2.8.4.zip verification-2.8.4
cp index.html verification-2.8.4/root-index.html
cp list-site-2.8.4.zip verification-2.8.4/list-site-2.8.4.zip
npm install --prefix verification-2.8.4/qa jsdom@26.1.0
node --test verification-2.8.4/tests/*.test.cjs
```

# 2.8.6: coordinated color palettes

Six complete combinations, each with individually selected light and dark tones: rose/sage, pine/brass, lagoon/coral, berry/copper, terracotta/jade and amber/indigo. Neutrals, ink, panels, inputs, glass, selected controls, primary actions and companion colors belong to the same palette. Old fixed pink/teal UI colors are replaced by role tokens. Health, error and positive-change colors keep consistent meanings across choices.

Settings → Appearance → Color palette offers interface miniatures, named combinations, live application and light/dark comparison. Selection persists locally. Existing character data is not changed. Old accent names migrate; invalid preferences and blocked storage are handled safely. Page/search fade regressions remain covered.

71 tests passed: 47 rules/storage/archetype checks, 19 DOM/lifecycle checks, four palette checks and one public-loader ZIP bootstrap check. JavaScript syntax and both stylesheets parsed successfully.

Color checks enforce at least 4.5:1 for the tested normal-text roles and button labels, and 3:1 for input outlines. Black/white bounds cover the selected paper-wash background composition. Semantic role consistency, old-preference migration, prototype-key rejection, persistence, absent literal old accent colors, full settings flow, control/scroll/focus retention and unchanged character storage are verified.

A swatch board was inspected for palette harmony; it is not a browser screenshot. Runtime tests use JSDOM and controlled Web Animations. Actual browser/device layout and rendering were not available for verification.

## Reproduction

From a checkout (Node 22+, Python 3):

```sh
python -m zipfile -e list-site-2.8.6-r1.zip verification-2.8.6
cp index.html verification-2.8.6/root-index.html
cp list-site-2.8.6-r1.zip verification-2.8.6/list-site-2.8.6-r1.zip
npm install --prefix verification-2.8.6/qa jsdom@26.1.0
node --test verification-2.8.6/tests/*.test.cjs
```

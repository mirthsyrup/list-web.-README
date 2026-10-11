# Website 2.8.2 verification

This release adds an optional compact combat sheet, source-based usage hints, feedback from actual calculated stat changes, a hero card and editable biography, four accent colors, and short UI transitions.

The standard sheet remains the default. Combat view is stored per character; the accent is stored per device. Usage hints use explicit requirements, triggers, frequencies and supported structured conditions from the catalog. They do not turn target immunity into a usage frequency. No Pathfinder mechanics or free-archetype slot rules were changed in this release.

## Reproduce

From this directory, extract the repository's `list-site-2.8.2.zip`, which contains the `site/` source directory, then run:

```sh
npm install --prefix qa jsdom@26.1.0
node --test tests/*.test.cjs tests/experience.cjs
```

54 tests passed: 47 existing rules, archetypes and storage checks plus 7 experience checks. The latter exercise the complete app in JSDOM, including mode persistence, multiple classes, reaction and attack cards, actual stat feedback and stacking, safe biography rendering, accent persistence, reduced motion, held card moves between sections, completed-note return and pin ordering.

Additional checks: JavaScript syntax, CSS parsing, local script dependencies and ZIP integrity. Animations use transform/opacity without height animation, springs or scale on presses. Normal rerenders do not fade ability groups again. Reduced motion disables the added transitions.

JSDOM checks DOM behavior and state, not browser layout or physical-device smoothness. No browser or phone visual check was available in this environment.

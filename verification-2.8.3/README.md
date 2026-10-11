# Website 2.8.3 verification

The character sheet has one standard view. The alternate renderer, switch, styles and stored setting have been removed. Previously saved characters are migrated to the standard sheet; biography, portrait, accents, hints and animations are preserved.

54 checks passed. Extract ../list-site-2.8.3.zip into this directory, run `npm install --prefix qa jsdom@26.1.0`, then `node --test tests/*.test.cjs tests/experience.cjs`.

DOM and state checks use JSDOM; physical-device layout and animation smoothness were not checked.

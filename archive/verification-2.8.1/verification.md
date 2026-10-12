# Website 2.8.1 verification

Fixes: remove owned-ability search; allow eligible archetype follow-up class feats in the ordinary class-feat substitution picker; prioritize the level-2 archetype at every even level; replace handmade costs with standard Pathfinder2eActions outlines and align symbols with wrapped titles.

Root cause: ordinary class-feat picker filtered archetypes to dedication-only, while dedication prerequisites blocked new archetypes. Eligible follow-ups such as Vigilante Safe House and Social Purview were omitted.

Validation:
- 47 existing rules, magic, advancement, build-choice, archetype and persistence regression tests passed.
- Actual paid-picker predicate offers Vigilante follow-ups at 4 before other archetypes, keeps skill archetype feats out of class slots, excludes duplicates and keeps dedication prerequisite checks.
- Ordinary and Free Archetype picks commit separately; preview does not mutate the live character.
- Original archetype priority checked at even levels 4 through 20.
- Browser: Animist with Vigilante dedication at level 2, 3→4 advancement, ordinary class-feat substitution, independent free pick, nested choice, apply, reload persistence.
- Same browser scenario passed against the packaged ZIP loader.
- Standard action 1/2/3, free and reaction glyphs; accessible names; wrapped titles and no horizontal overflow at 320/390/1440; dark/light screenshots inspected; no JavaScript errors.

To reproduce: extract list-site-2.8.1.zip into this verification directory (creating site/), then run node tests/picker-regression.cjs and node --test tests/*test.cjs. Browser checks require Playwright and a Chromium executable; adjust its environment-specific executable path before running tests/browser.cjs. Test character is synthetic.

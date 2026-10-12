# Website 2.8.0 verification

Unzip `list-site-2.8.0.zip` at the repository root to create `site/`.
Run `node verification-2.8.0/check.cjs` and `node verification-2.8.0/archetype-order-check.cjs`.
Browser checks require Playwright, Python 3 and Chromium: set `CODEX_PRIMARY_RUNTIME_NODE_MODULES` to the node_modules directory and `LIST_CHROME` to the Chromium executable. Run browser.cjs for the unpacked site or browser-packed.cjs for the published ZIP loader.

Verified at widths 320 (dark), 390 and 1440: group collapse and shared search, spell action symbols, rank-specific summaries, nested level choices, staged stats, level commit, save/reload and no horizontal overflow or JavaScript errors. Packed loader also verified at 390.

Rule checks cover Fighter, Wizard, Swashbuckler and Monk; reaction/free/variable costs; summaries for every spell at base rank and rank 10; multiple damage components; fixed and interval heightening; incomplete and invalid nested choices; archetype prioritization at even levels 4–20. Existing creation, storage and magic/advancement regression suite: 36 passing tests.

Spell damage/heightening metadata matched by stable item ID and base rank from Foundry PF2e commit 654d12aaf03735986a8781ecfb6a583d9b587823. Existing Russian descriptions are retained. Conditional, ability-modifier, persistent or variant-dependent formulas remain in full descriptions; no dice expressions are inferred from narrative text.

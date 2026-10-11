# 2.8.5: remove page and search flicker

The supplied iPhone recording showed the whole reference page dimming during category changes. Version 2.8.4 sequenced a fade-out snapshot followed by a fade-in, creating a visible brightness dip.

Remove snapshots and whole-page/result-list opacity and displacement animations. Reconcile pages and results immediately, preserving control identity, focus and scroll. Keep control color transitions, popup entry/exit, accordions and actual card movement.

66 tests passed: 47 rule/storage/archetype tests, 18 DOM/lifecycle regressions, one actual ZIP bootstrap test. New regressions replay the recording's category sequence and repeated search keystrokes and assert that the page/results receive no animation, opacity reset, pointer blocking or snapshot overlay. JavaScript syntax and stylesheet parsing passed.

The recording was inspected. Runtime checks use JSDOM and controlled Web Animations; they cannot establish physical iPhone frame rate or rendering quality. Browser QA was unavailable.

## Reproduction

From a repository checkout (Node 22+, Python 3):

```sh
python -m zipfile -e list-site-2.8.5.zip verification-2.8.5
cp index.html verification-2.8.5/root-index.html
cp list-site-2.8.5.zip verification-2.8.5/list-site-2.8.5.zip
npm install --prefix verification-2.8.5/qa jsdom@26.1.0
node --test verification-2.8.5/tests/*.test.cjs
```

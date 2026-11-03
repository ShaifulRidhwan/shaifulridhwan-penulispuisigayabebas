# AKSARA Repository Cleanup Audit — 2026-11-03

## Verified baseline
- Baseline `main`: `9e62e223ec847f2f781e08362a0b6568bd35b74a`, 318 files.
- Closed superseded PRs #51, #123, #144, #155, #172 with explanation, retaining history.
- Retired 15 one-off workflows tied to completed experiments/old branches, preserving active PR/push checks and manual production smoke testing.
- Retired six inactive ambient-video and legacy wallpaper artifacts. Current production Bilik uses the static `aksara-celestial-static.webp` wallpaper; browser tests check video is absent.
- Collapsed two conditional preloads of the same shared WebP to one preload.
- Removed obsolete CI syntax-check reference to the retired video JS and added a regression assertion.

## Safety and limits
No history rewrite, branch deletion, router change, model/key change, Voice Live change, session/memory change, Studio change, or novel content change. Removed files persist in Git history; Git clone history size is unchanged. Code was reviewed statically; production behavior and all CI checks must be verified before merge. Removing unrequested static files does not itself improve user-facing page-load time, but reduces clutter and the scope of Cloudflare asset copying.

## Follow-up audit
Map serverless module usage with import graph plus runtime traces before deleting backend code; inspect CSS specificity conflicts and JS duplicated listeners; consolidate CI only after comparing coverage; inspect unmerged branches by merge-base rather than age. Do not force-push `main`.

### Additional proof
The 1,132,173-byte retired `bilik-antara-background.mp4` was not referenced by active HTML/CSS/JS and matched the broad Cloudflare static-asset copier. Two older WebP variants were also not referenced in active pages; one is byte-for-byte identical to the retained `aksara-background-cahaya-gelap.webp`. Their unused Netlify cache rules have been removed. These changes reduce shipped source files, not Git history.

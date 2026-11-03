# Bilik Antara CSS archaeology | 2026-11-03

Base: `644f7fa4d98950701f36253d05bf4d635e9e77fd` on `main`.

Removed inactive animated ambient particles/haze layers, old wallpaper movement and sweep keyframes, obsolete mobile wallpaper override, unused location display styles and five empty breakpoint stubs.

Fixed reduced-motion CSS which had erroneously *re-enabled* infinite animations with `!important`. The active masked glass-frame animations remain enabled under normal motion and turn off under reduced motion.

The browser intentionally renders timestamp metadata but not optional user-supplied location labels. Existing privacy semantics are preserved; location labels are not rendered.

Updated `bilik-antara.css` version to `v=104` because the stylesheet is cached up to 30 days. Existing UI, storage defaults, voice stack, AI routing, Code Engine and cross-page assets remain unchanged.

Test coverage: static design regression, actual Playwright desktop/mobile background and reduced-motion audit, all platform/CI suites. The remaining 289 `!important`/layered selectors were **not** blindly flattened; future CSS refactors require explicit computed-style comparisons across breakpoints.

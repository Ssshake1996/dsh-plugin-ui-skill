# Changelog

## 0.1.1 - 2026-10-12

- Accept valid scoped npm technical package names while keeping sidebar/main UI IDs stable kebab-case.
- Inspect `exports["./client"]`, including nested conditional and array targets, instead of a server-only `package.main`; declaration-only targets are not scanned.
- Fail missing, out-of-root and `node_modules` client targets without hiding missing native slots behind unrelated server code. Preserve conventional entry checks for older packages and the bundled template.
- Resolve package-root junctions consistently, and resolve descriptor constants individually so different sidebar/main keys fail rather than producing a false pass.
- Add 12 dependency-free CLI fixture tests. Reproduced the Remote Ops false failure (4 errors); the corrected checker reports 14 passes, no errors and one unrelated Codex-manifest warning.

## 0.1.0 - 2026-10-07

- Initial public release.
- Added host-owned DSH sidebar/main registration contract.
- Added locale, accessibility, lifecycle, compatibility, upgrade, and release guidance.
- Added copyable `dsh-global-panel` template.
- Added dependency-free static contract checker.

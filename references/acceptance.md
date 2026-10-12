# DSH plugin UI acceptance

## Static checks

Run the Skill checker against the plugin root and keep the output with the release evidence:

```powershell
node "$env:CODEX_HOME\skills\dsh-plugin-ui\scripts\check_dsh_ui_contract.mjs" .
```

The checker covers package identity/version/main, declared client sources, host inject metadata, native slot signals, a shared stable UI ID, and locale/tooltip label signals. Confirm its inspected-file list points to the actual client. With `exports["./client"]`, a missing source must fail instead of falling back to unrelated server/conventional code. Without that export, conventional entry checks are retained.

The checker does not resolve the JavaScript import graph or prove icon props, absence of custom sidebars, packaged locale files, lifecycle cleanup, or host compatibility; inspect those artifacts and exercise the running host separately. Scoped npm package names are valid technical identities and do not replace the kebab-case sidebar/main ID.

## Fake-slot/unit checks

For a main workspace, assert one paired main/sidebar entry with the same ID/key. For a right Sidebar, assert one official left action, no main replacement, an openTab call, a registered tab type whose ID matches its body key, and the correct session owner. Exercise disposers, service/slot unload and reload, locale labels and collapsed accessibility. Source checks cannot prove the runtime destination or lifecycle.

## Real DSH Web checks

At minimum test:

1. 1280px expanded sidebar: label, icon and click open the requested destination. For a right Sidebar, prove the main conversation DOM and draft remain, repeated clicks reuse one tab, and closing/reopening preserves the conversation. Main-workspace navigation intentionally replaces the main area.
2. Collapse/reopen: 56px rail, tooltip/accessible name, no duplicate row.
3. 390px narrow view: panel remains usable, no horizontal overflow or clipped action.
4. Reload and MCP reconnect: current panel/tab and error/retry state behave predictably.
5. Keyboard: Tab reaches the row, Enter/Space activates it, tabs support arrows/Home/End, focus is visible.
6. `prefers-reduced-motion`: no required information depends on animation.
7. Uninstall/reload: no stale row, listener, timer, console error or duplicate registration.

Record host version, browser viewport, build/package version and whether the result is local-only, installed, or multi-machine. A fake-slot test is not a substitute for real DSH Web evidence.

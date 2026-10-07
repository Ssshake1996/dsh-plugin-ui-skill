# DSH plugin UI acceptance

## Static checks

Run the Skill checker against the plugin root and keep the output with the release evidence:

```powershell
node "$env:CODEX_HOME\skills\dsh-plugin-ui\scripts\check_dsh_ui_contract.mjs" .
```

Expected checks include stable identity, paired `main`/`sidebar.panellist`, locale-aware label, icon props, no obvious custom sidebar, and package metadata files.

## Fake-slot/unit checks

Use a fake `ctx.slots` implementation to assert that the plugin registers exactly one main entry and one sidebar entry, uses the same ID/key, returns disposers, and leaves no entries after disposal. Test label resolution for Chinese and English and icon output for `active=true/false` and two sizes.

## Real DSH Web checks

At minimum test:

1. 1280px expanded sidebar: row label, icon, active state and click open the right panel.
2. Collapse/reopen: 56px rail, tooltip/accessible name, no duplicate row.
3. 390px narrow view: panel remains usable, no horizontal overflow or clipped action.
4. Reload and MCP reconnect: current panel/tab and error/retry state behave predictably.
5. Keyboard: Tab reaches the row, Enter/Space activates it, tabs support arrows/Home/End, focus is visible.
6. `prefers-reduced-motion`: no required information depends on animation.
7. Uninstall/reload: no stale row, listener, timer, console error or duplicate registration.

Record host version, browser viewport, build/package version and whether the result is local-only, installed, or multi-machine. A fake-slot test is not a substitute for real DSH Web evidence.

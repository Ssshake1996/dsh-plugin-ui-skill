# DSH Plugin UI Skill

Reusable Codex Skill for building and reviewing DeepSeek Harness (DSH) plugins with a consistent Web UI contract.

Current version: **v0.1.3**. Expanded left-sidebar entries align their icon and label to the left with native host entries; collapsed entries keep a centered icon and Tooltip. See [CHANGELOG.md](CHANGELOG.md).

It distinguishes main workspaces (`sidebar.panellist` + `main`) from a left action opening the native right Sidebar (`sidebar.footer.action` + `sidebarRight.openTab`). Choose the destination the user requests, preserve conversation drafts for right-Sidebar tools, keep stable identity and accessible locale labels, and verify lifecycle and compatibility on the real host.

## Install for Codex

Copy the repository directory to the Codex skills directory:

```powershell
$skills = if ($env:CODEX_HOME) { Join-Path $env:CODEX_HOME 'skills' } else { Join-Path $HOME '.codex\skills' }
Copy-Item -Recurse -Force . (Join-Path $skills 'dsh-plugin-ui')
```

The skill keeps implicit invocation enabled. It should be selected automatically when a task mentions DSH plugins, Cordis slots, sidebar/panel UI, plugin manifests, or DSH plugin release work. It can also be invoked explicitly as `$dsh-plugin-ui`.

## Included

- `SKILL.md`: workflow and implementation rules.
- `references/`: sidebar contract, compatibility/upgrade notes, and acceptance checklist.
- `scripts/check_dsh_ui_contract.mjs`: dependency-free static contract checker with `--json` and `--strict` modes.
- `assets/dsh-global-panel-template/`: copyable panel, locale, icon, metadata, and lifecycle skeleton.
- `agents/openai.yaml`: Codex display metadata and automatic invocation policy.

## Validate

```powershell
$env:PYTHONUTF8 = '1'
python <skill-creator>/scripts/quick_validate.py .
node --test test/check_dsh_ui_contract.test.mjs
node scripts/check_dsh_ui_contract.mjs <plugin-root>
```

The static checker is evidence for common mistakes, not a substitute for real DSH Web testing. Release evidence should include host version, viewport, expand/collapse, keyboard, ARIA, reduced-motion, reload/reconnect, uninstall, and console checks.

The checker accepts valid lowercase npm package names, including scoped names; the sidebar/main UI key still uses stable kebab-case. When `exports["./client"]` is declared, it inspects that client source, including conditional/array targets, instead of treating `package.main` as browser code. Missing or out-of-root targets and targets under `node_modules` fail. Without a declared client export, the existing conventional entry-file checks remain available. It is a bounded source inspection, not a JavaScript import resolver or runtime compatibility proof.

## Scope

This Skill standardizes first-party plugin implementation. A plugin cannot force unrelated third-party plugins to share its CSS or sidebar behavior; true global uniformity must be provided by the DSH host itself.

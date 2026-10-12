import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const skillRoot = fileURLToPath(new URL('../', import.meta.url));
const checker = path.join(skillRoot, 'scripts/check_dsh_ui_contract.mjs');
const nativeClient = (id = 'remote-ops') => `
const PANEL_ID = '${id}';
const t = ctx.locale.bind('remoteOps');
ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, Page));
ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
  name: 'sidebar.panellist', id: PANEL_ID, label: () => t('panel'), title: 'Remote Ops'
}, Icon));
`;
const rightClient = (bodyKey = 'TAB_ID') => `
const TAB_ID = '@dsh/remote-ops';
const t = ctx.locale.bind('remoteOps');
ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
  name: 'sidebar.footer.action', id: 'remote-ops-launch', label: () => t('panel')
}, () => React.createElement('button', { 'aria-label': t('panel'), onClick: () => ctx.sidebarRight.openTab('remote-ops') })));
ctx.sidebarRightTabs.register({ id: TAB_ID, kind: 'remote-ops', title: () => t('panel') });
ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: ${bodyKey} }, Page));
`;

function fixture(t, overrides = {}, files = {}) {
  const prefix = path.join(os.tmpdir(), 'dsh-ui-check-');
  const root = fs.mkdtempSync(prefix);
  t.after(() => {
    // Only remove the fresh fixture allocated by this test.
    assert.ok(path.resolve(root).startsWith(path.resolve(prefix)));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const pkg = {
    name: '@dsh/remote-ops', version: '1.0.0', main: './lib/index.js',
    exports: { '.': './lib/index.js', './client': './lib/client.js' },
    dsh: { client: { inject: ['slots', 'locale', 'layout'] } }, ...overrides,
  };
  for (const [relative, content] of Object.entries({
    'package.json': JSON.stringify(pkg),
    'lib/index.js': 'export function apply(ctx) { /* server only */ }',
    'lib/client.js': nativeClient(), ...files,
  })) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

function inspect(root, flags = []) {
  const result = spawnSync(process.execPath, [checker, root, '--json', ...flags], { encoding: 'utf8' });
  assert.equal(result.error, undefined);
  assert.equal(result.stderr, '');
  return { status: result.status, ...JSON.parse(result.stdout) };
}

function check(result, id) {
  return result.checks.find((item) => item.id === id);
}

test('scoped package uses its declared client while the main entry is server-only', (t) => {
  const result = inspect(fixture(t));
  assert.equal(result.status, 0);
  assert.equal(result.summary.errors, 0);
  assert.equal(check(result, 'identity.package-name').level, 'pass');
  assert.match(check(result, 'entry.source').message, /lib[\\/]client\.js/);
  assert.equal(check(result, 'host.sidebar-main-pair').level, 'pass');
});

test('a left action opens a registered right Sidebar tab without a main replacement', (t) => {
  const result = inspect(fixture(t, {}, { 'lib/client.js': rightClient() }));
  assert.equal(result.status, 0);
  assert.equal(check(result, 'host.sidebar-slot').level, 'pass');
  assert.equal(check(result, 'host.right-tab-pair').level, 'pass');
  assert.equal(check(result, 'identity.ui-id').level, 'pass');
});

test('a footer action alone cannot pass as a complete right Sidebar integration', (t) => {
  const client = rightClient().split('ctx.sidebarRightTabs.register')[0];
  const result = inspect(fixture(t, {}, { 'lib/client.js': client }));
  assert.equal(result.status, 1);
});

test('right Sidebar type id and body key must match even for scoped technical ids', (t) => {
  const result = inspect(fixture(t, {}, { 'lib/client.js': rightClient("'other-body'") }));
  assert.equal(result.status, 1);
  assert.equal(check(result, 'host.right-tab-pair').level, 'error');
});

test('conditional and array client exports include executable targets, not declaration files', (t) => {
  const root = fixture(t, { exports: { './client': {
    types: './types/client.d.ts',
    browser: { import: ['./web/panel.mjs', './web/panel.mjs'] },
    default: './lib/fallback.cjs',
  } } }, {
    'lib/client.js': '', 'web/panel.mjs': nativeClient(),
    'lib/fallback.cjs': 'module.exports = {};',
  });
  const result = inspect(root);
  assert.equal(result.status, 0);
  const message = check(result, 'entry.source').message;
  assert.match(message, /web[\\/]panel\.mjs/);
  assert.match(message, /lib[\\/]fallback\.cjs/);
  assert.doesNotMatch(message, /client\.d\.ts/);
});

test('a missing declared client fails even when a conventional file has valid slots', (t) => {
  const result = inspect(fixture(t, { exports: { './client': './web/missing.js' } }, {
    'client.js': nativeClient(),
  }));
  assert.equal(result.status, 1);
  assert.equal(check(result, 'entry.client').level, 'error');
});

test('client source without native slots does not pass using the server entry', (t) => {
  const result = inspect(fixture(t, {}, {
    'lib/index.js': nativeClient(), 'lib/client.js': 'export const inject = [];',
  }));
  assert.equal(result.status, 1);
  assert.equal(check(result, 'host.sidebar-slot').level, 'error');
  assert.equal(check(result, 'host.main-slot').level, 'error');
});

for (const target of ['../outside.js', './node_modules/fake/client.js']) {
  test(`client export cannot inspect ${target}`, (t) => {
    const result = inspect(fixture(t, { exports: { './client': target } }, {
      'client.js': nativeClient(), 'node_modules/fake/client.js': nativeClient(),
    }));
    assert.equal(result.status, 1);
    assert.equal(check(result, 'entry.client').level, 'error');
    assert.doesNotMatch(check(result, 'entry.source')?.message ?? '', /Inspected .*node_modules/);
  });
}

test('a scoped technical package does not make a scoped UI id valid', (t) => {
  const result = inspect(fixture(t, {}, { 'lib/client.js': nativeClient('@dsh/remote-ops') }));
  assert.equal(result.status, 1);
  assert.equal(check(result, 'identity.package-name').level, 'pass');
  assert.equal(check(result, 'identity.ui-id').level, 'error');
});

test('valid lowercase npm technical names are independent from the kebab panel key', (t) => {
  const result = inspect(fixture(t, { name: '@team_scope/remote.ops' }));
  assert.equal(result.status, 0);
  assert.equal(check(result, 'identity.package-name').level, 'pass');
  assert.equal(check(result, 'identity.ui-id').level, 'pass');
});

test('invalid scoped package names remain errors', (t) => {
  const result = inspect(fixture(t, { name: '@DSH/remote-ops' }));
  assert.equal(result.status, 1);
  assert.equal(check(result, 'identity.package-name').level, 'error');
});

test('a junction to the package root inspects the same client as its physical path', (t) => {
  const root = fixture(t);
  const alias = `${root}-junction`;
  fs.symlinkSync(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  t.after(() => fs.unlinkSync(alias));
  const physical = inspect(root);
  const linked = inspect(alias);
  assert.equal(linked.status, 0);
  assert.deepEqual(linked.summary, physical.summary);
  assert.equal(check(linked, 'host.sidebar-main-pair').level, 'pass');
});

test('descriptor constants are resolved individually; different or unknown keys cannot pass', (t) => {
  const client = nativeClient('fixture-panel')
    .replace("const PANEL_ID = 'fixture-panel';", "const PANEL_ID = 'fixture-panel';\nconst OTHER_ID = 'different-panel';")
    .replace('key: PANEL_ID', 'key: OTHER_ID');
  const mismatch = inspect(fixture(t, {}, { 'lib/client.js': client }));
  assert.equal(mismatch.status, 1);
  assert.equal(check(mismatch, 'host.sidebar-main-pair').level, 'error');
  const unknown = inspect(fixture(t, {}, { 'lib/client.js': client.replace('key: OTHER_ID', 'key: resolvePanelId()') }));
  assert.equal(check(unknown, 'host.sidebar-main-pair').level, 'warn');
});

test('the existing template keeps its conventional client and helper checks', () => {
  const result = inspect(path.join(skillRoot, 'assets/dsh-global-panel-template'));
  assert.equal(result.status, 0);
  assert.equal(check(result, 'host.sidebar-main-pair').level, 'pass');
  assert.match(check(result, 'entry.source').message, /register-global-panel\.mjs/);
  assert.equal(inspect(path.join(skillRoot, 'assets/dsh-global-panel-template'), ['--strict']).status, 1);
});

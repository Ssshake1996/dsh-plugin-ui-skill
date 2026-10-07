#!/usr/bin/env node
/**
 * Static checks for the DSH plugin UI contract.
 *
 * This intentionally uses lightweight text/JSON inspection rather than a
 * JavaScript parser so it can run in a newly installed plugin without
 * dependencies.  It reports errors for broken registrations and warnings for
 * conventions that can be adopted incrementally.
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
let root = process.cwd();
let jsonOutput = false;
let strict = false;
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--json') jsonOutput = true;
  else if (arg === '--strict') strict = true;
  else if (arg === '--help' || arg === '-h') {
    console.log('Usage: node scripts/check_dsh_ui_contract.mjs [plugin-root] [--json] [--strict]');
    process.exit(0);
  } else if (!arg.startsWith('-')) {
    root = path.resolve(arg);
  } else {
    console.error(`Unknown option: ${arg}`);
    process.exit(2);
  }
}

const checks = [];
function add(id, level, message, details = undefined) {
  const item = { id, level, message };
  if (details) item.details = details;
  checks.push(item);
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
  } catch {
    return null;
  }
}

function firstMatch(text, expressions) {
  for (const expression of expressions) {
    const match = text.match(expression);
    if (match) return match;
  }
  return null;
}

function unquote(value) {
  if (!value) return null;
  return value.replace(/^['"`]|['"`]$/g, '');
}

function isStableIdentity(value) {
  return typeof value === 'string'
    && /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)
    && !/(?:todo|example|sample|plugin-name|replace|undefined)/i.test(value);
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  add('root', 'error', `Plugin root does not exist or is not a directory: ${root}`);
} else {
  const packageText = read('package.json');
  let pkg = null;
  if (!packageText) {
    add('package.json', 'error', 'package.json is required at the plugin root.');
  } else {
    try {
      pkg = JSON.parse(packageText);
      add('package.json.parse', 'pass', 'package.json is valid JSON.');
    } catch (error) {
      add('package.json.parse', 'error', `package.json is not valid JSON: ${error.message}`);
    }
  }

  if (pkg) {
    if (isStableIdentity(pkg.name)) {
      add('identity.package-name', 'pass', `Stable package identity: ${pkg.name}`);
    } else {
      add('identity.package-name', 'error', 'package.name must be a stable lowercase hyphenated id (for example, my-plugin).', { value: pkg.name });
    }

    if (typeof pkg.version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(pkg.version)) {
      add('identity.version', 'pass', `Package version is semver: ${pkg.version}`);
    } else {
      add('identity.version', 'error', 'package.version must be a semver value (for example, 1.0.0).', { value: pkg.version });
    }

    const main = typeof pkg.main === 'string' ? pkg.main : null;
    if (!main) {
      add('entry.main', 'error', 'package.main is required so DSH has one deterministic entry point.');
    } else if (exists(main)) {
      add('entry.main', 'pass', `package.main resolves to ${main}.`);
    } else {
      add('entry.main', 'error', `package.main does not resolve to a file: ${main}`);
    }

    const dsh = pkg.dsh;
    if (dsh && Array.isArray(dsh.client?.inject)) {
      add('host.inject', 'pass', `DSH host modules declared (${dsh.client.inject.length}).`);
    } else {
      add('host.inject', 'warn', 'package.dsh.client.inject is missing; add host UI modules when the plugin has a web panel.');
    }
  }

  const pluginJson = read('.codex-plugin/plugin.json');
  if (pluginJson) {
    try {
      const manifest = JSON.parse(pluginJson);
      if (pkg && manifest.name && manifest.name !== pkg.name) {
        add('identity.manifest-match', 'warn', 'plugin.json name differs from package.json name; use one stable identity across all surfaces.', { packageName: pkg.name, manifestName: manifest.name });
      } else if (manifest.name) {
        add('identity.manifest-match', 'pass', 'plugin.json and package.json share the same identity.');
      }
      if (manifest.interface?.displayName) {
        add('identity.display-name', 'pass', `Display name declared: ${manifest.interface.displayName}`);
      } else {
        add('identity.display-name', 'warn', 'plugin.json interface.displayName is missing; provide a human-readable fallback.');
      }
    } catch (error) {
      add('plugin-manifest.parse', 'error', `plugin.json is not valid JSON: ${error.message}`);
    }
  } else {
    add('plugin-manifest', 'warn', 'No .codex-plugin/plugin.json found; keep this warning only for packages that are not Codex plugins.');
  }

  // Search the entry point and the conventional client file.  The search is
  // bounded to root-level source files to avoid scanning node_modules/builds.
  const candidates = [];
  if (pkg?.main && exists(pkg.main)) candidates.push(pkg.main);
  for (const relative of ['client.js', 'client.mjs', 'register-global-panel.mjs', 'register-global-panel.js', 'index.js', 'index.mjs', 'src/client.js', 'src/client.mjs']) {
    if (exists(relative) && !candidates.includes(relative)) candidates.push(relative);
  }
  let source = '';
  for (const relative of candidates) source += `\n/* ${relative} */\n${read(relative) ?? ''}`;
  if (!source) {
    add('entry.source', 'error', 'No JavaScript entry source found to inspect for DSH slot registration.');
  } else {
    add('entry.source', 'pass', `Inspected ${candidates.join(', ')}.`);
  }

  const hasInject = /(?:ctx\.)?slots\s*\.\s*inject\s*\(/.test(source);
  const hasRegister = /(?:ctx\.)?slots\s*\.\s*register\s*\(/.test(source);
  const hasSidebarSlot = /sidebar\.panellist/.test(source);
  const hasMainSlot = /(?:name\s*:\s*['"]main['"]|slot\s*:\s*['"]main['"])/.test(source);
  if (hasInject && hasRegister) {
    add('host.slots-api', 'pass', 'Uses host-native slots.inject + slots.register.');
  } else {
    add('host.slots-api', 'error', 'Register the UI through host-native slots.inject and slots.register; do not mutate the host sidebar DOM.');
  }
  if (hasSidebarSlot) {
    add('host.sidebar-slot', 'pass', 'Registers the host sidebar.panellist slot.');
  } else {
    add('host.sidebar-slot', 'error', 'A web plugin must register sidebar.panellist so the host owns click, collapse, focus, and responsive behavior.');
  }
  if (hasMainSlot) {
    add('host.main-slot', 'pass', 'Registers the host main slot.');
  } else {
    add('host.main-slot', 'error', 'Register a main slot panel paired with the sidebar item.');
  }

  const registrations = [...source.matchAll(/slots\.register\(\s*\{([\s\S]*?)\}\s*(?:,|\))/g)].map((match) => match[1]);
  const stableConstant = firstMatch(source, [
    /\b(?:const|let)\s+([A-Z][A-Z0-9_]*(?:PANEL|PLUGIN|ID)[A-Z0-9_]*)\s*=\s*['"]([^'"]+)['"]/, 
    /\b(?:const|let)\s+((?:PANEL|PLUGIN)[A-Z0-9_]*ID)\s*=\s*['"]([^'"]+)['"]/
  ]);
  const inferredUiId = stableConstant && isStableIdentity(stableConstant[2]) ? stableConstant[2] : null;
  const descriptorValue = (block, property) => {
    const match = block.match(new RegExp(`${property}\\s*:\\s*['"]([^'"]+)['"]`));
    if (match?.[1]) return match[1];
    // Shared helpers often receive `id` as an argument and use object
    // shorthand (`{ id }`). Resolve that shorthand from PANEL_ID/PLUGIN_ID
    // when the caller declares a stable constant.
    return inferredUiId && new RegExp(`\\b${property}\\b`).test(block) ? inferredUiId : null;
  };
  const sidebarIds = registrations
    .filter((block) => /(?:name|slot)\s*:\s*['"]sidebar\.panellist['"]/.test(block))
    .map((block) => descriptorValue(block, 'id') || descriptorValue(block, 'key')).filter(Boolean);
  const mainIds = registrations
    .filter((block) => /(?:name|slot)\s*:\s*['"]main['"]/.test(block))
    .map((block) => descriptorValue(block, 'key') || descriptorValue(block, 'id')).filter(Boolean);
  if (sidebarIds.length && mainIds.length && sidebarIds.some((id) => mainIds.includes(id))) {
    add('host.sidebar-main-pair', 'pass', `Sidebar and main panel share a stable key (${sidebarIds.find((id) => mainIds.includes(id))}).`);
  } else if (hasSidebarSlot && hasMainSlot) {
    add('host.sidebar-main-pair', 'warn', 'Could not prove that sidebar and main registration share the same stable key; use one explicit panelKey.');
  }

  const descriptorId = sidebarIds[0] || mainIds[0] || inferredUiId;
  const idMatch = descriptorId ? [null, descriptorId] : firstMatch(source, [/(?:panelKey)\s*:\s*['"]([^'"]+)['"]/]);
  if (idMatch && isStableIdentity(idMatch[1])) {
    add('identity.ui-id', 'pass', `UI descriptor has a stable id/key: ${idMatch[1]}`);
  } else {
    add('identity.ui-id', 'warn', 'Add an explicit stable id/panelKey shared by sidebar and main registration.');
  }

  // `toLocaleString()` used for formatting a number/date is not a locale-aware
  // sidebar label. Require a host locale API (or an explicit label resolver)
  // before treating this contract as satisfied.
  const hasLocaleApi = /(?:ctx\s*\.\s*locale|locale\s*\.\s*(?:register|bind|t)\s*\(|i18n\s*\.|labelForLocale|displayNameFor)/i.test(source);
  const dynamicLabel = /\blabel\s*:\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>|\blabel\s*:\s*[A-Za-z_$][\w$]*\s*\(/.test(source);
  const hardCodedLabel = /\blabel\s*:\s*['"][^'"]+['"]/.test(source);
  if (hasLocaleApi && dynamicLabel) {
    add('accessibility.locale-label', 'pass', 'Label generation includes a locale/i18n path.');
  } else if (hardCodedLabel) {
    add('accessibility.locale-label', 'warn', 'Sidebar label is hard-coded; provide a locale-aware label with an English fallback.');
  } else {
    add('accessibility.locale-label', 'warn', 'Declare a locale-aware sidebar label or a stable display-name fallback.');
  }

  const hasAria = /(?:aria-label|ariaLabel|tooltip|title\s*:)/.test(source);
  if (hasAria) add('accessibility.tooltip', 'pass', 'Collapsed-state tooltip/accessible label signal found.');
  else add('accessibility.tooltip', 'warn', 'Provide tooltip/aria-label metadata for the collapsed sidebar state.');
}

const errors = checks.filter((item) => item.level === 'error');
const warnings = checks.filter((item) => item.level === 'warn');
const result = {
  pluginRoot: root,
  ok: errors.length === 0 && (!strict || warnings.length === 0),
  summary: { errors: errors.length, warnings: warnings.length, passed: checks.filter((item) => item.level === 'pass').length },
  checks,
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`DSH UI contract: ${result.ok ? 'PASS' : 'FAIL'} (${root})`);
  for (const item of checks) {
    const prefix = item.level === 'pass' ? '✓' : item.level === 'warn' ? '!' : '✗';
    console.log(`${prefix} [${item.id}] ${item.message}`);
  }
  console.log(`Summary: ${result.summary.passed} passed, ${result.summary.warnings} warnings, ${result.summary.errors} errors.`);
}
process.exit(result.ok ? 0 : 1);

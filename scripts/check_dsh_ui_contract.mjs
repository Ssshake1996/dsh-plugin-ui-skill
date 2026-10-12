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

// npm package names are technical identities; scoped names and dots/underscores
// are legal here even though host UI ids must remain kebab-case.
function isPackageName(value) {
  if (typeof value !== 'string' || value.length > 214) return false;
  const parts = value.startsWith('@') ? value.slice(1).split('/') : [value];
  if (parts.length !== (value.startsWith('@') ? 2 : 1)) return false;
  return parts.every((part) => /^[a-z0-9~][a-z0-9._~-]*$/.test(part)
    && !['node_modules', 'favicon.ico'].includes(part));
}

function clientTargets(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(clientTargets);
  if (value && typeof value === 'object') {
    // A declaration file is not an executable client entry.
    return Object.entries(value).filter(([condition]) => condition !== 'types')
      .flatMap(([, target]) => clientTargets(target));
  }
  return [];
}

function localSource(target) {
  if (typeof target !== 'string' || !target.startsWith('./')) return null;
  const absolute = path.resolve(root, target);
  const withinRoot = (base, candidate) => {
    const relative = path.relative(base, candidate);
    return relative && !relative.startsWith(`..${path.sep}`) && relative !== '..'
      && !path.isAbsolute(relative) && !relative.split(path.sep).includes('node_modules');
  };
  try {
    if (!withinRoot(root, absolute) || !withinRoot(fs.realpathSync(root), fs.realpathSync(absolute))
      || !fs.statSync(absolute).isFile() || !/\.(?:[cm]?js|jsx|tsx?)$/.test(absolute)
      || /\.d\.[cm]?ts$/.test(absolute)) return null;
    return path.relative(root, absolute);
  } catch {
    return null;
  }
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
    if (isPackageName(pkg.name)) {
      add('identity.package-name', 'pass', `Valid lowercase npm package identity: ${pkg.name}`);
    } else {
      add('identity.package-name', 'error', 'package.name must be a valid lowercase npm name (for example, my-plugin or @team/my-plugin).', { value: pkg.name });
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

  // Prefer the declared browser/client entry to a package.main that may be
  // server-only. Conditional exports can point to more than one client file.
  // Preserve conventional candidates only for packages without ./client.
  const candidates = [];
  const declaredClient = pkg?.exports && Object.hasOwn(pkg.exports, './client');
  if (declaredClient) {
    const targets = [...new Set(clientTargets(pkg.exports['./client']))];
    if (!targets.length) add('entry.client', 'error', 'exports["./client"] has no executable client target.');
    for (const target of targets) {
      const relative = localSource(target);
      if (relative) {
        candidates.push(relative);
        add('entry.client', 'pass', `Client export resolves to ${relative}.`);
      } else {
        add('entry.client', 'error', `Client export must resolve to a local source file outside node_modules: ${target}`);
      }
    }
  } else {
    const conventional = [pkg?.main, 'client.js', 'client.mjs', 'register-global-panel.mjs', 'register-global-panel.js', 'index.js', 'index.mjs', 'src/client.js', 'src/client.mjs'];
    for (const target of conventional) {
      if (typeof target !== 'string') continue;
      const relative = localSource(target.startsWith('./') ? target : `./${target}`);
      if (relative && !candidates.includes(relative)) candidates.push(relative);
    }
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
  const hasFooterAction = /(?:name|slot)\s*:\s*['"]sidebar\.footer\.action['"]/.test(source);
  const hasRightBody = /(?:name|slot)\s*:\s*['"]sidebar\.right\.pane\.tab['"]/.test(source);
  const hasRightTab = /sidebarRightTabs\s*\.\s*register\s*\(/.test(source);
  const hasRightOpen = /\bopenTab\s*\(/.test(source);
  const hasRightNavigation = hasFooterAction && hasRightBody && hasRightTab && hasRightOpen;
  if (hasInject && hasRegister) {
    add('host.slots-api', 'pass', 'Uses host-native slots.inject + slots.register.');
  } else {
    add('host.slots-api', 'error', 'Register the UI through host-native slots.inject and slots.register; do not mutate the host sidebar DOM.');
  }
  if (hasSidebarSlot) {
    add('host.sidebar-slot', 'pass', 'Registers the host sidebar.panellist slot.');
  } else if (hasFooterAction) {
    add('host.sidebar-slot', 'pass', 'Uses the official sidebar.footer.action seat for an action that preserves the main conversation.');
  } else {
    add('host.sidebar-slot', 'error', 'Register sidebar.panellist for a main workspace or sidebar.footer.action for a right-Sidebar action.');
  }
  if (hasMainSlot) {
    add('host.main-slot', 'pass', 'Registers the host main slot.');
  } else if (hasRightNavigation && !hasSidebarSlot) {
    add('host.main-slot', 'pass', 'Uses a right-Sidebar tab instead of replacing the main conversation.');
  } else {
    add('host.main-slot', 'error', 'Pair sidebar.panellist with main, or provide a complete footer action + sidebarRightTabs + right tab body + openTab integration.');
  }

  const registrations = [...source.matchAll(/slots\.register\(\s*\{([\s\S]*?)\}\s*(?:,|\))/g)].map((match) => match[1]);
  const constants = new Map([...source.matchAll(/\b(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*['"]([^'"]+)['"]/g)]
    .map((match) => [match[1], match[2]]));
  const inferredUiId = constants.get('PANEL_ID') ?? constants.get('PLUGIN_ID') ?? null;
  // Preserve the bundled helper pattern, but only infer its `id` parameter
  // from an explicit caller argument rather than an unrelated first constant.
  const helperIds = [...source.matchAll(/\bregisterGlobalPanel\(\s*[^,]+,\s*\{[^}]*?\bid\s*:\s*([A-Za-z_$][\w$]*)\s*(?:,|\})/g)]
    .map((match) => constants.get(match[1])).filter(Boolean);
  const sharedHelperId = helperIds.length && new Set(helperIds).size === 1 ? helperIds[0] : null;
  const descriptorValue = (block, property) => {
    const match = block.match(new RegExp(`\\b${property}\\s*:\\s*['"]([^'"]+)['"]`));
    if (match?.[1]) return match[1];
    const reference = block.match(new RegExp(`\\b${property}\\s*:\\s*([A-Za-z_$][\\w$]*)(?=\\s*(?:,|$))`))?.[1];
    if (reference) return constants.get(reference) ?? (reference === 'id' ? sharedHelperId : null);
    if (new RegExp(`(?:^|,)\\s*${property}\\s*(?:,|$)`).test(block)) {
      return constants.get(property) ?? (property === 'id' ? sharedHelperId : null);
    }
    return null;
  };
  const sidebarIds = registrations
    .filter((block) => /(?:name|slot)\s*:\s*['"]sidebar\.panellist['"]/.test(block))
    .map((block) => descriptorValue(block, 'id') || descriptorValue(block, 'key')).filter(Boolean);
  const mainIds = registrations
    .filter((block) => /(?:name|slot)\s*:\s*['"]main['"]/.test(block))
    .map((block) => descriptorValue(block, 'key') || descriptorValue(block, 'id')).filter(Boolean);
  if (sidebarIds.length && mainIds.length && sidebarIds.some((id) => isStableIdentity(id) && mainIds.includes(id))) {
    add('host.sidebar-main-pair', 'pass', `Sidebar and main panel share a stable key (${sidebarIds.find((id) => mainIds.includes(id))}).`);
  } else if (sidebarIds.length && mainIds.length) {
    add('host.sidebar-main-pair', 'error', 'Resolved sidebar and main registration keys do not match.', { sidebarIds, mainIds });
  } else if (hasSidebarSlot && hasMainSlot) {
    add('host.sidebar-main-pair', 'warn', 'Could not prove that sidebar and main registration share the same stable key; use one explicit panelKey.');
  }

  if (hasRightNavigation) {
    const typeIds = [...source.matchAll(/sidebarRightTabs\s*\.\s*register\(\s*\{([\s\S]*?)\}\s*\)/g)]
      .map((match) => descriptorValue(match[1], 'id')).filter(Boolean);
    const bodyIds = registrations.filter((block) => /(?:name|slot)\s*:\s*['"]sidebar\.right\.pane\.tab['"]/.test(block))
      .map((block) => descriptorValue(block, 'key')).filter(Boolean);
    if (typeIds.length && bodyIds.length) {
      const paired = typeIds.every((id) => bodyIds.includes(id));
      add('host.right-tab-pair', paired ? 'pass' : 'error', paired ? 'Right-Sidebar type ids match their body keys.' : 'Right-Sidebar type ids and body keys do not match.', { typeIds, bodyIds });
    } else {
      add('host.right-tab-pair', 'warn', 'Could not resolve right-Sidebar type/body keys; verify the runtime registration.');
    }
  }
  const footerIds = registrations.filter((block) => /(?:name|slot)\s*:\s*['"]sidebar\.footer\.action['"]/.test(block))
    .map((block) => descriptorValue(block, 'id')).filter(Boolean);
  const descriptorId = sidebarIds[0] || mainIds[0] || footerIds[0] || inferredUiId;
  const idMatch = descriptorId ? [null, descriptorId] : firstMatch(source, [/(?:panelKey)\s*:\s*['"]([^'"]+)['"]/]);
  if (idMatch && isStableIdentity(idMatch[1])) {
    add('identity.ui-id', 'pass', `UI descriptor has a stable id/key: ${idMatch[1]}`);
  } else if (idMatch) {
    add('identity.ui-id', 'error', 'UI descriptor id/key must be stable kebab-case, independent from the npm package name.', { value: idMatch[1] });
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

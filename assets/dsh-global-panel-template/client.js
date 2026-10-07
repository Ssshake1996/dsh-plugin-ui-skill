import { registerGlobalPanel } from './register-global-panel.mjs'
import { PanelShell } from './ui/panel-shell.mjs'

const PANEL_ID = 'my-dsh-plugin'
const NS = 'myDshPlugin'

export const inject = ['slots', 'locale', 'layout']

function Icon({ size = 18, active = false } = {}) {
  return {
    type: 'svg',
    props: {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'aria-hidden': 'true',
      'data-active': String(active),
      children: [{ type: 'path', props: { d: 'M5 5h14v14H5z' } }],
    },
  }
}

function Page({ request }) {
  return PanelShell({
    title: 'My DSH plugin',
    request,
    children: { type: 'p', props: { children: 'Replace this panel with plugin content.' } },
  })
}

export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, {
    en: { panel: 'My DSH plugin' },
    zh: { panel: '我的 DSH 插件' },
  }), `${PANEL_ID}: dictionaries`)

  return registerGlobalPanel(ctx, {
    id: PANEL_ID,
    namespace: NS,
    label: (t) => t('panel'),
    Icon,
    Page,
  })
}

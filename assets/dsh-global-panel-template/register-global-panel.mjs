/**
 * Register one host-owned DSH global panel.
 * Adapt imports/signatures to the DSH version in the target repository.
 */
export function registerGlobalPanel(ctx, {
  id,
  namespace,
  order = 40,
  label,
  Icon,
  Page,
}) {
  if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error('DSH panel id must be stable kebab-case')
  }
  if (typeof label !== 'function') throw new TypeError('label must be a locale thunk')
  if (typeof Icon !== 'function' || typeof Page !== 'function') {
    throw new TypeError('Icon and Page must be functions')
  }

  const disposers = []
  const t = ctx.locale.bind(namespace)
  disposers.push(ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main', key: id, locale: namespace,
  }, Page)))
  disposers.push(ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id, order, locale: namespace,
    label: () => label(t),
  }, Icon)))

  return () => disposers.splice(0).forEach((dispose) => dispose?.())
}

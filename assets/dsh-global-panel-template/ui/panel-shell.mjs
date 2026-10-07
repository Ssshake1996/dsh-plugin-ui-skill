export function PanelShell({ title, request, children }) {
  return {
    type: 'section',
    props: {
      class: 'dsh-plugin-panel',
      'aria-label': title,
      children: [
        { type: 'header', props: { class: 'dsh-plugin-panel__header', children: title } },
        { type: 'div', props: { class: 'dsh-plugin-panel__body', children } },
        request ? { type: 'footer', props: { class: 'dsh-plugin-panel__footer', children: request } } : null,
      ].filter(Boolean),
    },
  }
}

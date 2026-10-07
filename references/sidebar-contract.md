# DSH Web UI contract

这份参考描述当前已核对的 DSH 0.2.x Web 侧栏契约；具体仓库仍应在安装/验证时 inspect 目标宿主，因为 slot API 可能变化。

## Slot registration

`sidebar.panellist` 是宿主拥有的扁平列表。注册项的核心字段是 `id`、`order`、`label` 和可选 `locale`；图标组件接收 `{ size, active }`。对应的 `main` 注册项使用 `key`。同一个插件必须满足：

```text
sidebar.panellist.id === main.key === stable PANEL_ID
```

推荐顺序区间：内置项使用宿主保留的低序号；第三方/业务插件从 20–89 中选择并在仓库中登记，避免冲突。顺序不是业务优先级，不应在运行时频繁改变。

## Host-owned behavior

DSH SidebarRoot 负责：

- 展开 row 的按钮、点击、hover/active/focus 状态和 `aria-current=page`；
- 收起后的 56px rail、图标尺寸、label tooltip 和可访问名称；
- 全局折叠、宽度和转场；
- 键盘 Tab/Enter/Space 以及宿主的 reduced-motion 处理。

插件图标只渲染 currentColor SVG；不要渲染 button、tooltip、背景、文字或自有折叠逻辑。`ctx.layout.toggleSidebar()`、`ctx.layout.selectPanel()` 等由宿主维护，插件不要复制状态机。

## Panel rules

插件主面板应使用自己的前缀类名和 `--dsw-*` 主题 token，避免硬编码宿主 row 的颜色/尺寸。面板内部的多个功能使用 tabs 或 details/summary；sidebar slot 当前不支持插件自定义分组或每项独立折叠。若未来需要分组，应向 DSH 提案新增 group slot，而不是读 DOM。

## Registration checklist

- `inject` 包含实际使用的 `slots`、`locale`、`layout` 能力。
- locale namespace 稳定，`label` 是动态 thunk，不是启动时固定字符串。
- `main` 与 sidebar 在同一 owner 下注册和释放。
- 无 `position: fixed` sidebar、body/iframe portal、全局 z-index 或宿主 DOM 查询。
- 页面支持 loading、empty、error、retry；卸载时无定时器/事件/订阅泄漏。

# DSH Web UI contract

这份参考描述当前已核对的 DSH 0.2.x Web 侧栏契约；具体仓库仍应在安装/验证时 inspect 目标宿主，因为 slot API 可能变化。

## Slot registration

`sidebar.panellist` 是宿主拥有的主工作区列表。DSH 0.2.0-rc.2 的 row 点击固定调用 `selectPanel(id)`，没有自定义 click action；不能用于保留对话的右侧栏入口。主工作区注册项核心字段是 `id`、`order`、`label` 和可选 `locale`；图标接收 `{ size, active }`，`main` 使用 `key`。主工作区模式满足：

```text
sidebar.panellist.id === main.key === stable PANEL_ID
```

右栏模式使用官方 `sidebar.footer.action`（接收 `{ wide }`），由插件渲染一个可访问按钮并调用 `sidebarRight.openTab(kind)`。注册 `sidebarRightTabs` 的类型及 `sidebar.right.pane.tab` body，满足 `type.id === body.key`；保留已有技术 ID。该模式不注册 `main` / `sidebar.panellist`，主对话仍在宿主主区域。重复点击应复用现有标签，关闭/收起后保留对话草稿。窄屏下右栏可能由宿主自动全屏；不要用全局 CSS 改写。

展开的左侧入口采用图标加文字左对齐，缩进与宿主原生入口一致。`sidebar.footer.action` 必须根据 `wide` 区分样式：展开为 `flex-start`，收起为居中图标并保留 Tooltip/可访问名称。用插件前缀样式实现并在真实宿主核对几何位置；不能统一居中，也不能通过全局 CSS 调整宿主行。主工作区行继续由宿主布局。

推荐顺序区间：内置项使用宿主保留的低序号；第三方/业务插件从 20–89 中选择并在仓库中登记，避免冲突。顺序不是业务优先级，不应在运行时频繁改变。

## Host-owned behavior

主工作区行由 DSH SidebarRoot 负责（右栏 action 自身负责按钮、对齐和可访问提示，侧栏宽度与折叠仍由宿主负责）：

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
- 主工作区的 `main` 与 sidebar 配对；右栏 action、tab 类型和 body 按各自宿主服务生命周期注册和释放。
- 无 `position: fixed` sidebar、body/iframe portal、全局 z-index 或宿主 DOM 查询。
- 页面支持 loading、empty、error、retry；卸载时无定时器/事件/订阅泄漏。

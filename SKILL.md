---
name: dsh-plugin-ui
description: "开发、审查或升级 DeepSeek Harness（DSH）插件时，自动应用统一的 Web 插件 UI 契约：宿主侧栏注册、主面板、折叠与响应式行为、locale、ARIA、生命周期、兼容性、静态检查和发布验收。适用于任何 DSH 插件仓库，不限于 one_search；当任务涉及 DSH sidebar、panel、plugin manifest、Cordis slots 或插件发布时使用。"
---

# DSH Plugin UI

这个 Skill 把 DSH Web 插件当作“宿主注册 + 一个全局面板”来实现。目标是让不同插件在侧栏的点击、激活、折叠、Tooltip、键盘操作和响应式行为由 DSH 宿主统一负责，插件只提供稳定的元数据、图标和面板内容。

## 适用时先做的事

1. 检查仓库的插件身份、`package.json`、`.codex-plugin/plugin.json`、`cordis.patch.yml`、Web client 入口和当前 DSH 版本。不要假设不同 DSH 版本的 slot 契约相同。
2. 找到 DSH 的 `sidebar.panellist` 和 `main` slot；若仓库已有注册，先复用并修正，不要增加第二套侧栏实现。
3. 运行本 Skill 的静态检查：

   ```powershell
   node "$env:CODEX_HOME\skills\dsh-plugin-ui\scripts\check_dsh_ui_contract.mjs" <plugin-root>
   ```

   如果 `CODEX_HOME` 未设置，使用本 Skill 的实际绝对路径。脚本是辅助证据，不能代替真实 DSH 浏览器验收。

## 默认实现契约

### 身份和元数据

- 一个插件默认只有一个全局面板入口；插件内部的多个功能放在面板的 tabs 或 `details/summary` 中。
- `PANEL_ID` 同时用于 `sidebar.panellist.id` 和 `main.key`，使用稳定的 kebab-case。改显示名称不应修改 MCP server name、工具前缀、旧 profile 所依赖的技术 ID。
- `package.json`、Codex manifest、DSH locale 和 sidebar 使用同一个用户可见产品名。技术包名可以保留兼容别名，但必须在文档中说明。
- Web bundle 暴露 `locale/en.json` 和 `locale/zh.json`，并在 `package.json.files` 中列出实际文件路径；不要只写无法被自定义打包器展开的 glob。
- 图标是单色 currentColor SVG。图标函数只接收宿主传入的 `{ size, active }`，不包自己的 button、label、背景或折叠按钮。

### 规范注册顺序

优先使用仓库现有的 host API；下面代码是契约示意，具体 import 以目标 DSH 版本为准：

```js
const PANEL_ID = 'my-plugin'
const NS = 'myPlugin'

export const inject = ['slots', 'locale', 'layout']

export function apply(ctx) {
  ctx.effect(() => {
    ctx.locale.register(NS, {
      zh: { panel: '我的插件' },
      en: { panel: 'My plugin' },
    })
  }, `${PANEL_ID}: dictionaries`)

  const t = ctx.locale.bind(NS)

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main', key: PANEL_ID, locale: NS,
  }, Page))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: PANEL_ID, order: 40,
    locale: NS, label: () => t('panel'),
  }, Icon))
}
```

`main` 与 `sidebar.panellist` 必须由同一个生命周期 owner 注册并可被卸载。`label` 使用 locale thunk，使语言切换和收起后的 Tooltip 都能更新。若目标 DSH 版本没有上述 slot，降级为兼容的单入口面板并报告版本差异，不要读 DOM 或复制侧栏。

### 宿主负责、插件不重复实现

DSH 宿主负责侧栏 row 的按钮、点击、active 状态、`aria-current`、焦点 ring、收起后的 Tooltip、56px rail、宽度和约 150ms 的折叠转场。插件不得：

- 绘制 `position: fixed` 的自定义侧栏、iframe 或 body portal；
- 通过 DOM 查询、全局 CSS 或 z-index 改写其他插件/宿主侧栏；
- 自己创建第二个 sidebar button、折叠按钮或 tooltip；
- 硬编码宿主 row 的尺寸和颜色；
- import 未公开的宿主 Client primitives。

插件主面板使用自己的类名前缀，并优先使用 `--dsw-*` host tokens。窄屏和收起状态必须依靠宿主布局传入的可用空间完成适配。

### 面板内部交互

- 顶层使用统一的 panel shell：标题、状态/错误区域、内容区和 footer 操作区。
- 同一插件的子功能使用 tabs；tabs 必须有 `role=tablist`、`role=tab`、`role=tabpanel`、`aria-controls`/`aria-labelledby`，并支持 ArrowLeft/ArrowRight/Home/End。
- 可折叠区使用原生 `details/summary` 或 `button[aria-expanded][aria-controls]`，不要把每个区块再注册成侧栏入口。
- 所有异步请求有 loading、empty、error、retry 状态；刷新或 MCP 重连后尽量恢复用户当前 panel/tab，不丢失有意义的筛选条件。
- 状态更新必须可取消或可丢弃过期结果；卸载时清理订阅、定时器、事件监听和 slot disposer。

## 开发工作流

按以下顺序完成，除非仓库已有更严格的宿主约束：

1. **盘点契约**：记录 DSH UI API 版本、可用 slots、插件 manifest 字段和兼容范围。
2. **稳定身份**：确定 `PANEL_ID`、用户可见名称、技术兼容名、locale namespace、order 区间；避免与内置 manager/schedule 或其他插件冲突。
3. **接入宿主**：只注册配对的 `main`/`sidebar.panellist`，并让 disposer 与生命周期一致。
4. **实现面板**：使用模板中的 shell、tabs、details、host tokens 和明确的 loading/empty/error 状态。
5. **静态检查**：运行 `check_dsh_ui_contract.mjs`，修复身份漂移、缺 locale、slot 不成对和自绘侧栏等问题。
6. **真实验收**：在实际 DSH Web 中验证 1280px、390px、展开/收起、激活、刷新、重连、Tab/Enter/Space、Tooltip、ARIA、`prefers-reduced-motion`、卸载无残留和 console 无错误。
7. **发布**：把插件版本、DSH 兼容矩阵、升级/卸载行为、已验证范围和已知限制写进 README/CHANGELOG；发布前确认 bundle 中包含 icon 与 locale 文件。

## 资源按需读取

- 需要知道准确的 sidebar/main slot、host token 和 ARIA 约束时，读取 `references/sidebar-contract.md`。
- 需要兼容多个 DSH 版本或处理旧宿主降级时，读取 `references/compatibility.md`。
- 需要编写测试、做真实浏览器验收或准备 release 时，读取 `references/acceptance.md`。
- 需要复制最小插件骨架时，复制 `assets/dsh-global-panel-template/`，再替换身份、locale 和页面内容。

## 交付时必须说明

报告中明确区分：静态检查通过、fake-slot 单测通过、真实 DSH Web 验收通过、安装/升级/卸载验证通过，以及尚未验证的宿主版本、多机或远程场景。不能因为本地构建通过就声称所有 DSH 版本兼容。

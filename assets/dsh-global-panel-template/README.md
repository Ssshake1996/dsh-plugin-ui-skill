# DSH global panel template

复制此目录到插件仓库后，替换 `my-dsh-plugin`、locale、图标和 `Page` 内容。模板展示的是 UI contract，不绑定某个前端框架；请以目标 DSH 版本的 slot inspect 结果为准。

```text
package.json              # bundle metadata and explicit files
client.js                 # host registration entry
register-global-panel.mjs # paired main/sidebar helper
icon.svg                  # currentColor-compatible plugin icon
locale/en.json
locale/zh.json
ui/panel-shell.mjs
ui/styles.css
```

面板内部子功能放进 tabs/details，不要复制侧栏 row。

本模板的主工作区行由宿主负责对齐。若工具应保留主对话并打开右栏，改用 `SKILL.md` 中的官方 footer action 示例：展开时图标与文字左对齐，收起时图标居中并显示 Tooltip；不要复制本模板的 main 配对作为右栏入口。

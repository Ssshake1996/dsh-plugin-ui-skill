# DSH compatibility and upgrade

## Version matrix

把以下信息写进插件 README 或 `docs/compatibility.md`，并用真实宿主验证：

| DSH host | UI slot result | Locale/meta | Required behavior |
|---|---|---|---|
| 0.2.x | `sidebar.panellist` + `main` | `exports` + `locale/en.json` | full contract |
| older/unknown | inspect at install time | may fall back to package name | one panel entry or clear diagnostic |

版本号只是声明，不是实测证据。未知宿主必须优雅降级：保留 MCP 能力并报告缺失的 UI slot，不要复制侧栏或静默注册重复入口。

## Metadata packaging

DSH app boot 通常从 bundle 的 `icon`、`exports` 和 locale 文件读取插件清单。`package.json.files` 需要列出实际文件，例如：

```json
{
  "icon": "./icon.svg",
  "exports": {
    "./locale/*.json": "./locale/*.json"
  },
  "files": ["index.mjs", "client.js", "icon.svg", "locale/en.json", "locale/zh.json"]
}
```

不要只依赖自定义 stage 工具展开 `files` glob；发布前在 staging 目录检查 icon 和两个 locale 是否真的存在。

## Upgrade and lifecycle

- 使用可替换的安装目录或版本目录，先停止旧进程，再切换指针，避免 Windows 上运行中的 exe 被锁定。
- MCP client 重连时复用已有 bridge；升级过程中先 drain、关闭旧 bridge，再启动新版本。
- 用户明确强制停止服务后，记录 stop marker，阻止无定时任务时的自动重连；正常网络/进程故障使用指数退避。
- 更新后重新 inspect slot 和 manifest，确认没有重复 sidebar registration，再恢复服务。

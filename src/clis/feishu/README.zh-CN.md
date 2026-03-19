# 飞书 (Lark) 桌面端适配器

通过 AppleScript 在终端中控制**飞书桌面端**。

> **注意：** 飞书使用自研 `Lark Framework`（基于 Chromium 但非 Electron），不支持 CDP。

## 前置条件

1. 飞书必须正在运行且已登录
2. Terminal 需要辅助功能权限

## 命令

| 命令 | 说明 |
|------|------|
| `feishu status` | 检查飞书是否在运行 |
| `feishu send "消息"` | 发送消息（粘贴 + 回车） |
| `feishu read` | 读取当前聊天（Cmd+A → Cmd+C） |
| `feishu search "关键词"` | 全局搜索（Cmd+K） |
| `feishu new` | 新建消息/文档（Cmd+N） |

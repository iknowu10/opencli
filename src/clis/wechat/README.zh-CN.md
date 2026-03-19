# 微信桌面端适配器

通过 AppleScript + Accessibility API 在终端中控制**微信 Mac 桌面端**。

> **注意：** 微信是原生 macOS 应用（非 Electron），因此无法使用 CDP。此适配器使用 AppleScript 键盘模拟和剪贴板操作。

## 前置条件

1. 微信必须正在运行且已登录
2. Terminal 需要 **辅助功能权限**（系统设置 → 隐私与安全性 → 辅助功能）

## 命令

| 命令 | 说明 |
|------|------|
| `wechat status` | 检查微信是否在运行 |
| `wechat send "消息"` | 发送消息（剪贴板粘贴 + 回车） |
| `wechat read` | 读取当前聊天内容（Cmd+A → Cmd+C） |
| `wechat search "关键词"` | 打开搜索并输入关键词（Cmd+F） |
| `wechat chats` | 切换到聊天列表（Cmd+1） |
| `wechat contacts` | 切换到通讯录（Cmd+2） |

## 限制

- **不支持 CDP** — 微信是原生 Cocoa 应用
- `send` 需要先手动打开正确的会话
- `read` 通过全选+复制来获取可见内容
- `search` 可以输入关键词但无法自动点击结果

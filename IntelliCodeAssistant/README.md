# IntelliCodeAssistant

## 项目简介

该项目旨在基于 OpenAI Codex 创建一个多 Agent 智能代码助手，帮助开发者通过自然语言快速完成需求分析、代码生成、测试与调试。

## 项目目标

- 需求分析 -> 代码生成 -> 测试生成 -> 调试修复 -> 记忆沉淀。
- 通过 Agent 管理器调度各子 Agent 协同执行。
- 支持最小闭环：输入需求 -> 输出代码。

## 项目结构

```text
IntelliCodeAssistant/
├─ agent_manager.js
├─ agents/
│  ├─ requirement_agent.js
│  ├─ code_agent.js
│  ├─ test_agent.js
│  ├─ debug_agent.js
│  └─ memory_agent.js
├─ src/
│  ├─ agent.js
│  ├─ parser.js
│  └─ generator.js
├─ storage/
├─ tests/
│  ├─ test_parser.js
│  └─ test_agent_manager.js
├─ package.json
├─ README.md
├─ .gitignore
└─ tasks.md
```

## 快速开始

1. 运行需求解析与代码生成示例：

```powershell
node agent_manager.js "实现一个函数，对输入数字数组进行排序并返回结果。"
```

2. 运行解析模块测试：

```powershell
npm test
```

3. 启动本地网页预览服务（可直接在浏览器查看）：

```powershell
npm run web
```

启动后访问：

- http://127.0.0.1:3000/
- http://127.0.0.1:3000/api/result

可选：启动后自动打开浏览器。

```powershell
npm run web:open
```

可选：如果 3000 端口被旧进程占用，可一键重启预览服务。

```powershell
npm run web:restart
```

如果你在工作区根目录 `D:\新建文件夹`，也可以直接执行（无需先切换到 `IntelliCodeAssistant`）：

```powershell
npm run web
npm run web:open
npm run web:restart
npm test
```

预览页包含完整登录与 Agent 可视化工作台能力：

- Agent Control Plane 头部（步骤数、优化轮次、记忆复用）
- Agent Flow 时间线（展示各步骤来源：memory/generated）
- Agent Workspace 聊天区（类似 Claude 的对话流交互）
- Recent Runs 列表（查看最近运行摘要并一键回填输入）
- 输入需求后直接运行 Agent（支持 `Ctrl+Enter` 快捷提交）
- 后端真实认证链路（密码哈希校验 + 签名 Token + 会话校验）
- 登录状态提示（未登录/请求中/已登录/登录失败）
- 一键填充演示账号按钮（admin / 123456）
- 一键演示登录按钮（直接登录 admin / 123456）
- 一键重置演示账号按钮（恢复为 admin / 123456）
- 三按钮状态面板（实时显示填充/登录/重置成功或失败）
- 按钮防重复点击（执行中自动禁用并显示处理状态）
- Token 展示区（脱敏显示）
- 一键复制 Token
- 退出登录按钮（调用 `/api/logout`，使当前 Token 失效）
- Activity Feed（记录登录、复制、登出等操作事件）
- 前端异常捕获面板（自动展示脚本错误与 Promise 异常）
- 接口返回控制台（显示 `/api/login`、`/api/me`、`/api/logout`、`/api/agent/run` 返回值）

网页可调用接口：

- `POST /api/agent/run`：运行 Agent（需要 Bearer Token）
- `GET /api/agent/history`：获取最近运行记录（需要 Bearer Token）
- `POST /api/reset-demo-user`：重置演示账号（admin / 123456）

默认演示账号：

- 用户名：`admin`
- 密码：`123456`
- 用户数据文件：`storage/auth_users.json`

## 模块说明

- requirement_agent.js：需求解析 Agent。
- code_agent.js：代码生成 Agent。
- test_agent.js：测试生成 Agent。
- debug_agent.js：错误定位与修复建议 Agent。
- memory_agent.js：本地记忆存储 Agent。
- agent_manager.js：多 Agent 调度器。

## 待办与 Prompt 模板

详见 tasks.md，包含：

- 待办事项列表
- 模块级 Prompt 模板
- 调试与自动修复 Prompt 模板

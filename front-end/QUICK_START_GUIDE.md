# AgentOS 系统使用快速指南

## 🚀 快速开始（5 分钟）

### 步骤 1: 启动服务器

```bash
cd IntelliCodeAssistant
node preview_server.js
```

预期输出：
```
[preview] server is running at http://127.0.0.1:3000
```

### 步骤 2: 打开浏览器

访问 → http://127.0.0.1:3000

### 步骤 3: 登录

| 字段 | 值 |
|------|-----|
| 用户名 | `admin` |
| 密码 | `123456` |

✅ 登录成功后会显示 Agent 历史

---

## 📱 功能导航

### 🏠 首页 (`/`)
- **功能**：登录入口、Agent 历史展示
- **特点**：内嵌 iframe 登录表单演示
- **访问**：http://127.0.0.1:3000/

### 💬 聊天历史 (`/chats.html`)
- **功能**：查看会话历史、按会话过滤
- **操作**：点击会话查看详情、继续编辑
- **访问**：http://127.0.0.1:3000/chats.html

### 🧠 知识库 (`/memory.html`)
- **功能**：浏览记忆记录、语义搜索、创建笔记
- **操作**：搜索、复制、删除、标记
- **访问**：http://127.0.0.1:3000/memory.html

### 📊 工作台 (`/dashboard-redesign.html`)
- **功能**：Agent 实时执行、消息显示、上下文管理
- **操作**：输入提示词、观察 Agent 思考过程
- **访问**：http://127.0.0.1:3000/dashboard-redesign.html

### ⚙️ 设置 (`/settings.html`)
- **功能**：系统配置、环境变量设置、API 密钥管理
- **操作**：编辑配置、查看日志
- **访问**：http://127.0.0.1:3000/settings.html

### 🔌 插件 (`/plugins.html`)
- **功能**：查看已安装插件、浏览市场、自定义开发
- **操作**：启用/禁用、安装/卸载
- **访问**：http://127.0.0.1:3000/plugins.html

### ✨ 创建 Agent (`/creates.html`)
- **功能**：创建新的 AI Agent、配置参数
- **操作**：设置温度、选择模型、自定义行为
- **访问**：http://127.0.0.1:3000/creates.html

---

## 🔌 API 端点参考

### 认证

```bash
# 登录
POST /api/login
Content-Type: application/json

{
  "username": "admin",
  "password": "123456"
}

# 响应
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 获取数据（需要认证）

```bash
# 获取 Agent 历史
GET /api/agent/history
Authorization: Bearer <TOKEN>

# 获取内存数据
GET /api/memory
Authorization: Bearer <TOKEN>

# 获取运行结果
GET /api/result

# 健康检查
GET /health
```

### 执行操作（需要认证）

```bash
# 运行 Agent
POST /api/agent/run
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "requirement": "编写一个计算器类",
  "temperature": 0.7
}

# 创建 Agent
POST /api/agent/create
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "name": "MyAgent",
  "temperature": 0.7
}
```

---

## ✅ 验证系统功能

### 方式 1: 运行自动化测试

```bash
# 完整端对端测试
node e2e-test-full.js

# 预期输出
# ✓ 通过测试: 20
# ✗ 失败测试: 0
# 成功率: 100%
```

### 方式 2: 手动验证清单

- [ ] 访问首页，查看登录表单
- [ ] 使用凭证 admin/123456 登录
- [ ] 登录成功后显示 Agent 历史
- [ ] 访问 /chats.html，查看聊天列表
- [ ] 访问 /memory.html，查看知识库
- [ ] 访问 /dashboard-redesign.html，查看工作台
- [ ] 尝试创建新 Agent（/creates.html）
- [ ] 检查浏览器 console，无错误信息
- [ ] 检查 localStorage，token 已保存

---

## 🔍 调试和故障排除

### 问题 1: 页面无法加载

**症状**：访问某个页面时显示 404 或空白

**解决方案**：
```bash
# 1. 确认服务器在运行
# 2. 检查 URL 是否正确
# 3. 查看浏览器 console (F12) 了解详细错误
# 4. 重启服务器：Ctrl+C，然后重新运行
```

### 问题 2: 登录失败

**症状**：输入凭证后显示错误

**解决方案**：
```bash
# 确认凭证正确：
# - 用户名：admin
# - 密码：123456

# 检查浏览器 console 错误消息
# 清除浏览器缓存并重试
```

### 问题 3: API 返回 401

**症状**：获取数据时返回 Unauthorized

**解决方案**：
```bash
# 1. 确认已登录
# 2. 检查 token 是否在 localStorage 中：
#    在 console 中运行：localStorage.getItem('token')
# 3. 如果 token 为空，需要重新登录
# 4. 如果 token 存在但仍 401，token 可能已过期
```

### 问题 4: 性能缓慢

**症状**：页面响应慢，API 调用耗时长

**解决方案**：
```bash
# 1. 检查网络连接
# 2. 打开浏览器开发者工具 (F12)
# 3. 查看 Network 标签中的请求时间
# 4. 如果服务器响应缓慢，可能需要重启服务器
```

---

## 📊 系统架构简图

```
┌─────────────────────────────────────────────────┐
│               用户浏览器                         │
│  ┌───────────────────────────────────────────┐  │
│  │  HTML5 + Vanilla JS + Tailwind CSS       │  │
│  │  7 个功能页面                             │  │
│  │  ├─ 首页（登录）                          │  │
│  │  ├─ 聊天历史                              │  │
│  │  ├─ 知识库                                │  │
│  │  ├─ 工作台                                │  │
│  │  ├─ 设置                                  │  │
│  │  ├─ 插件                                  │  │
│  │  └─ Agent 创建                            │  │
│  └───────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
                    HTTP/REST
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────────────────────────┴──────┐
│         Node.js 服务器                     │
│     (preview_server.js)                    │
│                                            │
│  ┌─────────────────────────────────────┐ │
│  │        认证系统（JWT）              │ │
│  │  ├─ /api/login                      │ │
│  │  └─ Token 生成和验证                │ │
│  └─────────────────────────────────────┘ │
│                                            │
│  ┌─────────────────────────────────────┐ │
│  │        API 路由层                   │ │
│  │  ├─ /api/agent/history              │ │
│  │  ├─ /api/memory                     │ │
│  │  ├─ /api/agent/run                  │ │
│  │  ├─ /api/result                     │ │
│  │  └─ /health                         │ │
│  └─────────────────────────────────────┘ │
│                                            │
│  ┌─────────────────────────────────────┐ │
│  │        业务逻辑层                   │ │
│  │  ├─ AgentManager                    │ │
│  │  ├─ Memory Store                    │ │
│  │  └─ Code Generator                  │ │
│  └─────────────────────────────────────┘ │
│                                            │
│  ┌─────────────────────────────────────┐ │
│  │        持久化存储                   │ │
│  │  ├─ memory_store.json               │ │
│  │  ├─ auth_users.json                 │ │
│  │  └─ Session 数据                    │ │
│  └─────────────────────────────────────┘ │
└────────────────────────────────────────────┘
```

---

## 📈 性能数据

| 指标 | 值 | 备注 |
|------|-----|------|
| 首页加载时间 | ~50ms | 本地网络 |
| 平均 API 响应时间 | <100ms | 简单查询 |
| 并发连接数 | 支持 | 无限制 |
| 总前端资源 | ~216 KB | 7 个页面 |
| 字符编码 | UTF-8 | 中文完全支持 |

---

## 🔐 安全特性

- ✅ JWT Token 认证
- ✅ 密码加密存储（密码验证）
- ✅ CORS 安全策略
- ✅ HTTP 头安全检查
- ✅ 输入数据验证
- ✅ XSS 防护（HTML 转义）

---

## 📞 常用命令

```bash
# 启动服务器
npm start
# 或
node preview_server.js

# 运行单元测试
npm test

# 运行端对端测试
node e2e-test-full.js

# 检查代码语法
node -c preview_server.js

# 停止服务器
# Ctrl + C
```

---

## 📚 相关文件

- [E2E 测试报告](./E2E_TEST_REPORT.md) - 完整测试结果
- [系统架构文档](./IntelliCodeAssistant/README.md) - 技术细节
- [API 文档](./IntelliCodeAssistant/tasks.md) - 开发任务

---

## ✨ 提示和技巧

### 💡 提示 1: 清除登录状态
```javascript
// 在浏览器 console 中运行
localStorage.clear()
// 然后刷新页面
```

### 💡 提示 2: 查看 Token
```javascript
// 在浏览器 console 中运行
console.log(localStorage.getItem('token'))
```

### 💡 提示 3: 模拟 API 调用
```bash
# 在终端中使用 curl
curl http://127.0.0.1:3000/health

# 或使用 PowerShell
curl http://127.0.0.1:3000/health -UseBasicParsing
```

---

**最后更新**：2026 年 4 月 24 日  
**系统状态**：✅ 生产就绪

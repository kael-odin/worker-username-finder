# 🔍 Username Finder

[English](#english) | [中文](#中文)

---

<a name="english"></a>

## English

### 🚀 Find Usernames Across 400+ Social Networks

Check if a username is available or already taken on various social media platforms. Based on the popular [Sherlock](https://github.com/sherlock-project/sherlock) project.

### ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔍 **400+ Sites** | Check usernames across 400+ social networks |
| ⚡ **Fast** | Concurrent requests for quick results |
| 🎯 **Accurate** | Multiple detection methods (status code, message, response URL) |
| 🛡️ **WAF Detection** | Detect and handle Web Application Firewall blocks |
| 📊 **Detailed Results** | HTTP status, response time, and error information |

### 📋 Use Cases

- ✅ OSINT investigations
- ✅ Username availability checking
- ✅ Social media research
- ✅ Brand monitoring
- ✅ Personal brand management

### ⚙️ Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| **Username** | Usernames to search | Required |
| **Timeout** | Request timeout per site (seconds) | 30 |
| **Concurrency** | Maximum concurrent requests | 20 |
| **Include NSFW** | Include adult content sites | false |
| **Show All Results** | Show all results including not found | false |
| **Specific Sites** | Only check these sites (empty = all) | [] |

### 📝 Example Output

```json
{
  "username": "john_doe",
  "site": "GitHub",
  "status": "CLAIMED",
  "urlUser": "https://github.com/john_doe",
  "httpStatus": 200
}
```

### 🔧 Detection Methods

| Method | Description |
|--------|-------------|
| **Status Code** | Check HTTP status code (e.g., 404 = available) |
| **Message** | Check for error messages in response |
| **Response URL** | Check if redirected to error page |

---

<a name="中文"></a>

## 中文

### 🚀 在 400+ 社交网络中查找用户名

检查用户名在各种社交媒体平台上是否可用或已被占用。基于流行的 [Sherlock](https://github.com/sherlock-project/sherlock) 项目。

### ✨ 核心功能

| 功能 | 说明 |
|------|------|
| 🔍 **400+ 站点** | 在 400+ 社交网络中检查用户名 |
| ⚡ **快速** | 并发请求，快速获取结果 |
| 🎯 **准确** | 多种检测方法（状态码、消息、响应URL） |
| 🛡️ **WAF 检测** | 检测并处理 Web 应用防火墙拦截 |
| 📊 **详细结果** | HTTP 状态、响应时间和错误信息 |

### 📋 适用场景

- ✅ OSINT 调查
- ✅ 用户名可用性检查
- ✅ 社交媒体研究
- ✅ 品牌监控
- ✅ 个人品牌管理

### ⚙️ 配置参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| **用户名** | 要搜索的用户名 | 必填 |
| **超时时间** | 每个站点的请求超时（秒） | 30 |
| **并发数** | 最大并发请求数 | 20 |
| **包含 NSFW** | 是否包含成人内容站点 | false |
| **显示所有结果** | 显示所有结果包括未找到的 | false |
| **指定站点** | 只检查这些站点（空=所有） | [] |

### 📝 示例输出

```json
{
  "username": "john_doe",
  "site": "GitHub",
  "status": "CLAIMED",
  "urlUser": "https://github.com/john_doe",
  "httpStatus": 200
}
```

### 🔧 检测方法

| 方法 | 说明 |
|------|------|
| **状态码** | 检查 HTTP 状态码（如 404 = 可用） |
| **消息** | 检查响应中的错误消息 |
| **响应 URL** | 检查是否重定向到错误页面 |

---

## 🆚 与原版 Sherlock 的差异

| Feature | Sherlock (Python) | Username Finder (Node.js) |
|---------|------------------|---------------------------|
| **Language** | Python | Node.js |
| **Runtime** | CLI / Apify | CafeScraper Worker |
| **Browser** | No | No (pure HTTP) |
| **Output** | File / CLI | Platform result |
| **Site Data** | Local / Remote | Remote (GitHub) |

---

## 📊 Status Types

| Status | Description |
|--------|-------------|
| `CLAIMED` | Username exists on the site |
| `AVAILABLE` | Username is available |
| `ILLEGAL` | Username format not allowed |
| `UNKNOWN` | Could not determine |
| `WAF` | Blocked by Web Application Firewall |

---

## 📜 License

MIT License © 2024 kael-odin

## 🔗 Links

- [GitHub Repository](https://github.com/kael-odin/worker-username-finder)
- [Original Sherlock Project](https://github.com/sherlock-project/sherlock)
- [Report Issues](https://github.com/kael-odin/worker-username-finder/issues)

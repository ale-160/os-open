# nchat · 去中心化 P2P 聊天室

一个基于 WebRTC 的去中心化 P2P 聊天室参考实现。无中心服务器存储用户数据，消息端到端直传，身份基于 Ed25519 公钥。

![status](https://img.shields.io/badge/status-MVP-green) ![vue](https://img.shields.io/badge/Vue-3.5-brightgreen) ![webrtc](https://img.shields.io/badge/WebRTC-PeerJS-blue)

---

## 特性

- **去中心化**：信令服务器仅用于 WebRTC 握手，不参与数据传输与存储
- **身份持久化**：Ed25519 密钥对生成后存于本地，刷新页面 PeerID 不变
- **消息签名验证**：所有消息使用 Ed25519 私钥签名，对端用公钥校验，防伪造
- **房间系统**：支持开放/密码/审核/邀请四种准入模式
- **继承制管理**：创建者拥有 99 星标，下线后由星标最高的在线成员继承房间
- **审核与邀请**：创建者可设置星标阈值，达标成员可审核加入申请或邀请他人
- **多信令服务器**：支持配置多个信令服务器，自动回退
- **局域网可用**：开发模式下 vite 自动代理信令，手机访问电脑 IP 即可使用，无需开放额外端口
- **本地持久化**：房间列表、消息历史、密码缓存均存于 localStorage
- **文件传输**：支持图片/视频/音频/文本等文件传输，浏览器可预览的类型直接内联显示
- **放逐机制**：基于星标的屏蔽规则，个人可屏蔽低星标用户发言，房间所有者可设置房间默认屏蔽阈值
- **PWA 支持**：可安装到桌面，离线打开

---

## 技术栈

| 层面 | 选型 | 说明 |
|---|---|---|
| 构建工具 | Vite 5 | 零配置、HMR、PWA 友好 |
| 前端框架 | Vue 3 + Composition API | 轻量、响应式 |
| P2P 传输 | PeerJS（WebRTC DataChannel） | 一行 `peer.connect(id)` 建连 |
| 信令服务 | PeerJS Server（自建） | 仅握手，不负载数据 |
| 加密 | Ed25519（Web Crypto API + @noble/ed25519 回退） | 身份与消息签名 |
| 本地存储 | localStorage | 简单可靠，避免 IndexedDB 卡死 |
| 样式 | 纯 CSS | 无额外依赖 |

---

## 快速开始

### 一键启动（推荐）

```bash
npm run start
```

跨平台 Node.js 启动脚本（`scripts/start.js`），自动完成：
1. 检查端口 9000（信令）和 5173（前端）是否被占用
2. 杀死占用进程
3. 启动信令服务器和前端开发服务器
4. Ctrl+C 一次性停止所有服务

支持自定义端口：

```bash
node scripts/start.js --fe=5180 --sig=9001
```

### 手动分别启动

便于单独调试：

```bash
# 1. 安装依赖
npm install

# 2. 启动信令服务器（另开终端）
npx peerjs --port 9000 --allow_discovery true

# 3. 启动前端
npm run dev
```

默认在 http://localhost:5173/ 打开。`vite.config.js` 中已设置 `host: true`，手机访问 `http://电脑IP:5173/` 即可加入。

### 构建

```bash
npm run build
npm run preview --host
```

产物在 `dist/`，可直接部署到 Cloudflare Pages / GitHub Pages / 静态服务器。

---

## 局域网使用指南

### 电脑 + 手机同局域网

1. **电脑执行一键启动**

   ```bash
   npm run start
   ```

   脚本会同时启动信令服务器（9000）和前端（5173）。

2. **查看电脑局域网 IP**

   脚本启动后会输出 `LAN: http://192.168.x.x:5173/`

3. **手机浏览器打开** `http://电脑IP:5173/`

4. **信令连接说明**

   开发模式下，vite 会自动将 `/peerjs` 请求代理到信令服务器。手机只需访问前端端口（5173），**无需直连 9000 端口**，避免防火墙拦截问题。

5. **验证连接**：手机打开页面后，点击右上角「设置」→「诊断」，确认：
   - 安全上下文：HTTP 局域网访问会显示 `✗ 否`，应用自动回退到 `@noble/ed25519` 纯 JS 加密
   - 信令状态：应显示「信令已连接」

### 排查清单

- 确认手机与电脑在同一 WiFi
- 确认电脑防火墙放行 5173 端口（9000 不需要对外暴露）
- 确认手机浏览器支持 WebRTC（现代浏览器均支持）
- 企业网络可能开启 AP 隔离，导致设备间无法通信

---

## 核心概念

### PeerID 与 PeerJS ID

- **PeerJS ID**：信令服务器分配的传输地址，仅用于建连，可变
- **PeerID**：Ed25519 公钥的 Base58 编码，真正的身份标识，通过 `hello` 消息告知对端

二者解耦，身份与传输地址分离，为后续迁移 libp2p 等留出空间。

### 房间准入模式

| 模式 | 说明 |
|---|---|
| `OPEN` | 任何人可直接加入 |
| `PASSWORD` | 需密码；密码仅由已加入成员持有，向在线用户校验，无在线成员时房间销毁 |
| `APPROVE` | 需房间管理员审核通过；星标达阈值的成员也可审核 |
| `INVITE` | 仅凭邀请加入，无邀请不可进入 |

### 星标继承制

- 创建者默认 **99 星标**
- 普通成员默认 **1 星标**
- 创建者可调整任意成员的星标数量（1–99）
- 创建者下线后，由星标最高（≥1）的在线成员继承房间
- 无继承者时，房间销毁

### 审核与邀请权限

- 创建者拥有全部权限
- 星标 ≥ `approveThreshold`（默认 50）的成员可审核加入申请、邀请他人
- `approveThreshold` 可由创建者在创建房间时设置

### 放逐/屏蔽机制

- **个人屏蔽**：用户可设置屏蔽阈值，屏蔽星标低于该值的用户发言（自身及更高星标不受影响）
- **房间默认屏蔽**：房间所有者可设置房间级屏蔽阈值，所有成员都会屏蔽低于该星标的发言
- 屏蔽方自身星标必须 ≥ 阈值（不能屏蔽同级或更高）
- 0 表示关闭屏蔽

---

## 消息协议

所有消息为 JSON 格式，通过 WebRTC DataChannel 传输：

```json
{
  "type": "room_message",
  "from": "<sender_peerid>",
  "to": "<room_name>",
  "payload": { "room": "ale160", "text": "你好" },
  "timestamp": 1745880000000,
  "signature": "<base64_signature>",
  "extensions": { "name": "ale160" },
  "id": "<unique_msg_id>"
}
```

### 消息类型

| type | 用途 |
|---|---|
| `hello` | 打招呼，广播自身存在与所在房间 |
| `join_room` | 加入房间 |
| `leave_room` | 离开房间 |
| `room_message` | 聊天消息 |
| `room_list` | 回复房间列表查询 |
| `query_rooms` | 搜索房间 |
| `history_request` | 请求历史消息 |
| `history_response` | 回复历史消息 |
| `heartbeat` | 心跳保活 |
| `join_request` | 审核制房间的加入申请 |
| `join_approved` | 批准加入 |
| `join_rejected` | 拒绝加入 |
| `set_stars` | 调整成员星标 |
| `invite` | 邀请加入 |
| `ban_update` | 屏蔽规则更新 |
| `file_message` | 文件传输（base64 DataURL） |

---

## 项目结构

```
nchat/
├── src/
│   ├── components/           # Vue 组件
│   │   ├── ChatPanel.vue         # 聊天面板
│   │   ├── CreateRoomDialog.vue  # 创建房间对话框
│   │   ├── MemberList.vue        # 成员列表（含星标/审核UI）
│   │   ├── PeerInfo.vue          # 顶部身份与状态
│   │   ├── RoomList.vue          # 房间列表（分页）
│   │   ├── RoomManager.vue       # 房间与存储管理
│   │   ├── RoomSearch.vue        # 房间搜索
│   │   └── SettingsPanel.vue     # 设置与诊断面板
│   ├── composables/
│   │   └── useChat.js             # 全局状态管理（单例 composable）
│   ├── lib/
│   │   ├── crypto.js              # Ed25519 签名/验证（含回退）
│   │   ├── db.js                  # localStorage 持久化
│   │   ├── peer.js                # PeerJS 封装，P2P 网络层
│   │   └── protocol.js            # 消息类型与协议定义
│   ├── styles/
│   │   └── main.css               # 全局样式
│   ├── App.vue                    # 应用根组件
│   ├── config.js                  # 信令服务器与全局配置
│   └── main.js                    # 入口
├── public/
│   ├── favicon.png
│   ├── manifest.json              # PWA 配置
│   └── sw.js                      # Service Worker
├── scripts/
│   └── start.js                   # 跨平台一键启动脚本
├── index.html
├── vite.config.js
└── package.json
```

---

## 配置

### 信令服务器

- **开发模式**：默认跟随页面 host:port，vite 代理 `/peerjs` 到 `localhost:9000`，无需暴露 9000 端口
- **生产模式**：需在反向代理（nginx 等）中配置 `/peerjs` 转发，或在「设置」中指定信令服务器地址
- **自定义**：在「设置」→「信令服务器」中添加，支持 host/port/path/secure/key
- **多服务器回退**：连接时按候选列表逐个尝试，首个成功即用
- **存储位置**：`localStorage('nchat:signaling:servers')` 与 `('nchat:signaling:active')`

### 全局参数

在 [src/config.js](src/config.js) 的 `CONFIG` 对象中可调整：

| 参数 | 默认值 | 说明 |
|---|---|---|
| `HEARTBEAT_INTERVAL` | 3000ms | 心跳间隔 |
| `HEARTBEAT_UNSTABLE` | 5000ms | 超时标记为不稳定 |
| `HEARTBEAT_OFFLINE` | 15000ms | 超时判定离线并移除 |
| `DISCOVERY_INTERVAL` | 8000ms | 节点发现间隔 |
| `MAX_PEERS` | 30 | 单节点最大连接数 |
| `HISTORY_LIMIT` | 500 | 每房间本地消息缓存上限 |
| `ROOM_PAGE_SIZE` | 30 | 房间列表单页数量 |

---

## 部署

### 信令服务器（生产）

推荐自建 PeerJS Server：

- **Docker**：`docker run -p 9000:9000 -d peerjs/peerjs-server`
- **源码部署**：[peers/peerjs-server](https://github.com/peers/peerjs-server)
- **资源消耗**：极低，单实例可支持数千并发连接

### 前端静态页面

- **Cloudflare Pages**（推荐）：免费套餐足够
- **GitHub Pages**
- **本地 `dist/`**：直接用静态服务器托管

部署后，在「设置」→「信令服务器」中添加你的公网信令服务器即可。

---

## 浏览器兼容性

- Chrome / Edge 90+
- Firefox 90+
- Safari 15+
- 移动端 Chrome / Safari

**注意**：
- 非安全上下文（HTTP 非 localhost）下 `crypto.subtle` 不可用，应用会自动回退到 `@noble/ed25519` 纯 JS 实现
- iOS Safari 对 WebRTC 支持较新版本才完善

---

## 验收标准

- [x] 不同设备（PC/手机）均可互相发现
- [x] 创建房间后，其他节点能搜索到该房间
- [x] 同一房间内消息实时同步
- [x] 退出后重新加入，能看到最近历史消息
- [x] 节点离线后，其他节点在 15s 内感知并从成员列表移除
- [x] 页面刷新后 PeerID 不变
- [x] PWA 可安装到桌面

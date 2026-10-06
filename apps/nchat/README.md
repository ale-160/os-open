# nchat · 去中心化 P2P 聊天室

一个基于 WebRTC 的去中心化 P2P 聊天室参考实现。无中心服务器存储用户数据，消息端到端直传，身份基于 Ed25519 公钥。

![status](https://img.shields.io/badge/status-Beta-green) ![vue](https://img.shields.io/badge/Vue-3.5-brightgreen) ![webrtc](https://img.shields.io/badge/WebRTC-PeerJS-blue)

---

## 特性

**网络与可靠性**
- **去中心化**：信令服务器仅用于 WebRTC 握手，不参与数据传输与存储
- **多信令域并行（蛛网核心）**：同时连接多个信令服务器（域），任一域可用即在线，断线自动重连
- **LCAN 多副本存储**：公告/Pin/文档/文件元信息写入分布式责任集，发送者离线后仍可读取
- **离线消息补拉**：重连/刷新后自动拉取离线期间错过的消息
- **消息送达确认**：接收方批量回执（ACK），发送方显示 ⏳发送中 / ✓已送达 / ⚠️失败可重发

**身份与安全**
- **身份持久化**：Ed25519 密钥对存于本地，刷新页面 PeerID 不变
- **消息签名验证**：所有消息 Ed25519 签名，对端公钥校验，防伪造
- **身份跨设备备份**：口令加密导出/恢复（换设备/清缓存不丢身份）
- **密码哈希传输**：密码房间只广播密码哈希，不泄露明文

**房间与管理**
- **房间系统**：开放/密码/审核/邀请四种准入模式，支持别名（一房最多 5 个别名）
- **继承制管理**：创建者 99 星标，下线后由星标最高在线成员继承；已保存的房间保留在列表，无人也可再加入（加入自动接管房主）
- **星标管理**：创建者可调整成员星标，达标成员可审核加入申请
- **收藏/已加入/发现**：房间三分类 tab（收藏优先排序），已加入房间持久化
- **存储管理**：每房间消息条数上限（默认 5000 可调，超出自动清理最旧）、删除并退出、存储统计

**消息体验**
- **消息编辑/撤回/表情回应**：全节点同步（含乱序补丁缓冲）
- **@提及 + 已读回执**：Phase 3.2 协议
- **话题/私聊 E2E**：Phase 3.3/3.4 协议（AES-GCM 私聊）
- **群公告**：标题栏按钮发布，公告栏显示/编辑，广播 + LCAN 持久化
- **Pin 置顶 / 云文档 / 全网消息搜索**
- **文件传输**：图片/视频/音频内联预览，大文件分片 + 多源拉取
- **打字状态**：标题栏显示"XX 正在输入…"
- **浏览器通知 + 免打扰**：非当前房间/页面隐藏时提醒，房间可静音
- **屏蔽体系**：用户级屏蔽（某人）+ 星级屏蔽（低于 X 星），仅前端过滤、数据保留
- **聊天记录导出**：JSON 下载（房间设置面板）
- **邀请链接/二维码**：`?room=xxx` 链接扫码即入，打开自动加入

**其他**
- **多信令服务器**：可配置多个，自动回退；局域网可用（vite 代理信令，免开放额外端口）
- **PWA 支持**：可安装到桌面，离线打开
- **聊天室级设置面板**：标题栏齿轮在房间内打开房间专属设置（免打扰/屏蔽/导出/邀请）

---

## 技术栈

| 层面 | 选型 | 说明 |
|---|---|---|
| 构建工具 | Vite 5 | 零配置、HMR、PWA 友好 |
| 前端框架 | Vue 3 + Composition API | 轻量、响应式 |
| P2P 传输 | PeerJS（WebRTC DataChannel） | 双通道：JSON 控制 + Binary 大数据 |
| 信令服务 | PeerJS Server（自建，可多域并行） | 仅握手，不负载数据 |
| 加密 | Ed25519（Web Crypto + @noble 回退）、AES-GCM | 身份/签名、备份加密与私聊 |
| 本地存储 | IndexedDB 优先 + localStorage 回退 | 消息/文件/LCAN/文档走 IDB |
| 样式 | 纯 CSS | 无 UI 框架依赖 |
| 其他依赖 | qrcode | 邀请二维码 |

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

1. **电脑执行一键启动**（`npm run start`），脚本输出 `LAN: http://192.168.x.x:5173/`
2. **手机浏览器打开** `http://电脑IP:5173/`
3. **信令连接**：开发模式下 vite 自动将 `/peerjs` 代理到信令服务器，手机只需访问 5173，无需直连 9000 端口
4. **验证连接**：设置 → 诊断，确认信令已连接；HTTP 局域网非安全上下文时自动回退 `@noble/ed25519` 纯 JS 加密

**排查**：同 WiFi、防火墙放行 5173、企业网络 AP 隔离会阻断设备互连。

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
| `PASSWORD` | 需密码；密码只以哈希广播，本地明文仅创建者/已验证成员持有 |
| `APPROVE` | 需房间管理员审核通过；星标达阈值的成员也可审核 |
| `INVITE` | 仅凭邀请加入，无邀请不可进入 |

### 房间生命周期

- 创建者默认 **99 星标**，普通成员默认 **1 星标**，创建者可调整（1–99）
- 创建者下线后由星标最高的在线成员继承；无高星继承者时第一个在线成员接管
- **已加入（未退出）的房间不会销毁**：空房间保留在列表（"暂无成员"），可再次加入并自动接管房主；主动"退出/删除并退出"才会清数据

### 屏蔽体系（个人过滤，数据保留）

- **用户级屏蔽**：屏蔽某人，其消息不再显示（成员列表操作，人人可用）
- **星级屏蔽**：屏蔽星标低于阈值的成员发言（房间设置面板设置，0 = 不屏蔽）
- 均为**前端过滤**：消息数据完整保留（P2P 下删除易冲突），自己消息永不过滤

### 消息送达语义

- 发送后状态：⏳ 发送中 → ✓ 已送达（任一在线节点回执）/ ⚠️ 失败（10s 超时）
- 失败可点击重发：用原 msgId/timestamp 重建（接收方幂等去重）
- 离线节点靠**补拉**（重连/刷新时 `requestHistory(room, lastTs)`）追赶消息

---

## 消息协议

所有消息为 JSON，通过 WebRTC DataChannel 传输，Ed25519 签名：

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

| 分类 | type | 用途 |
|---|---|---|
| 基础 | `hello` `join_room` `leave_room` `room_message` `room_list` `query_rooms` `heartbeat` | 连接/入房/聊天/发现 |
| 历史 | `history_request` `history_response` | 历史拉取（since 增量） |
| 准入 | `join_request` `join_approved` `join_rejected` `speak_request` `speak_approved` | 审核/发言审核 |
| 管理 | `set_stars` `invite` `kick_member` `ban_update` | 星标/邀请/踢出/屏蔽规则 |
| 文件 | `file_message` `file_meta` `file_request` `file_unavailable` | 文件（bin 通道分片） |
| LCAN | `lcan_store` `lcan_ack` `lcan_get` `lcan_found` `lcan_not_found` `lcan_holders` `lcan_update` | 多副本存储（蛛网） |
| 公告/Pin | `announcement` `pin_update` | 群公告/置顶 |
| 消息扩展 | `edit` `delete` `react` `mention` `read_receipt` | 编辑/撤回/回应/提及/已读 |
| 话题/私聊 | `thread_create` `thread_reply` `dm_create` `dm_message` `dm_key` | 话题/E2E 私聊 |
| 云文档 | `doc_update` `doc_list` | 文档 LWW 同步 |
| 搜索 | `msg_search` `msg_search_result` | 全网消息搜索 |
| 可靠性 | `msg_ack` | 送达回执（批量） |
| 状态 | `typing` | 打字状态（节流） |

完整定义见 [src/lib/protocol.js](src/lib/protocol.js)。

---

## 项目结构

```
nchat/
├── src/
│   ├── components/           # Vue 组件
│   │   ├── chat/                 # 聊天核心（ChatHeader/MessageList/MessageItem/
│   │   │                         #   MessageInput/AnnouncementBar/PinBar/...）
│   │   ├── ChatPanel.vue         # 聊天面板
│   │   ├── ListBar.vue           # 侧边栏（房间列表/搜索）
│   │   ├── RoomList.vue          # 房间列表（收藏/已加入/发现）
│   │   ├── MemberList.vue        # 成员列表（星标/禁言/踢出/屏蔽）
│   │   ├── CreateRoomDialog.vue  # 创建房间（别名/准入/规则）
│   │   ├── RoomManager.vue       # 存储管理（删除并退出/统计）
│   │   ├── RoomSettingsDialog.vue# 聊天室级设置（免打扰/屏蔽/导出/邀请）
│   │   ├── InviteDialog.vue      # 邀请二维码/链接
│   │   ├── SettingsPanel.vue     # 平台设置（诊断/信令/网络/角色/身份）
│   │   ├── TopologyView.vue      # 拓扑视图（多域状态）
│   │   ├── DocPanel.vue          # 云文档
│   │   ├── MessageSearch.vue     # 消息搜索
│   │   └── ...                   # 其余辅助组件
│   ├── composables/
│   │   └── useChat.js             # 全局状态（模块级单例）
│   ├── lib/
│   │   ├── crypto.js              # Ed25519/AES-GCM/身份备份
│   │   ├── db.js                  # IndexedDB + localStorage 回退
│   │   ├── peer.js                # PeerJS 封装（多域/LCAN/协议处理）
│   │   ├── protocol.js            # 消息类型与协议定义
│   │   ├── lcan.js                # LCAN 多副本存储
│   │   ├── fileTransfer.js        # 大文件分片传输
│   │   └── config.js              # 信令服务器与全局配置
│   ├── styles/
│   │   ├── tokens.css             # 设计变量
│   │   └── main.css               # 全局样式
│   ├── App.vue                    # 应用根组件
│   └── main.js                    # 入口
├── public/
│   ├── manifest.json              # PWA 配置
│   └── sw.js                      # Service Worker
├── scripts/
│   └── start.js                   # 跨平台一键启动脚本
├── vite.config.js
└── package.json
```

---

## 配置

### 信令服务器（多域）

- **开发模式**：默认跟随页面 host:port，vite 代理 `/peerjs` 到 `localhost:9000`
- **生产模式**：反向代理 `/peerjs`，或「设置 → 信令服务器」中指定
- **多域并行**：同时连接全部候选域，任一在线即正常；断线域自动重连
- **存储位置**：`localStorage('nchat:signaling:servers')` 与 `('nchat:signaling:active')`

### 本地存储 Key 一览

| Key | 用途 |
|---|---|
| `nchat:ed25519:jwk` | 身份密钥（Ed25519 JWK） |
| `nchat:joined` | 已加入房间（持久化） |
| `nchat:favorites` | 收藏房间 |
| `nchat:msg-limit` | 每房间消息条数上限（默认 5000） |
| `nchat:blocked` / `nchat:block-min-stars` | 屏蔽列表 / 星级屏蔽阈值 |
| `nchat:muted` | 免打扰房间 |
| `nchat:notifications:enabled` | 浏览器通知开关 |
| `nchat:signaling:servers` / `:active` | 信令服务器配置 |

消息/文件/LCAN/文档存 IndexedDB（`messages`/`lcan`/`docs` store）。

### 全局参数

在 [src/config.js](src/config.js) 的 `CONFIG` 中可调整（心跳/发现/分页等）；`MSG_ACK_TIMEOUT`（送达超时，默认 10s）在 peer.js 中使用。

---

## 部署

### 信令服务器（生产）

- **Docker**：`docker run -p 9000:9000 -d peerjs/peerjs-server`
- **源码**：[peers/peerjs-server](https://github.com/peers/peerjs-server)
- 多域部署：可运行多个信令实例，在设置中添加全部地址

### 前端静态页面

Cloudflare Pages / GitHub Pages / 任意静态服务器均可。部署后在「设置 → 信令服务器」添加你的公网信令地址。

---

## 浏览器兼容性

- Chrome / Edge 90+、Firefox 90+、Safari 15+、移动端现代浏览器
- 非安全上下文（HTTP 非 localhost）自动回退 `@noble/ed25519` 纯 JS 加密

---

## 验收标准

- [x] 不同设备（PC/手机）互相发现、实时同步消息
- [x] 创建房间后其他节点可搜索到；四种准入模式可用
- [x] 刷新/重连后补拉离线消息；发送失败可重发并显示送达状态
- [x] 节点离线 15s 内从成员列表移除；创建者离线星标继承/接管
- [x] 已加入房间持久化，空房间保留可再加入
- [x] 身份跨设备备份恢复；密码房间不明文传密码
- [x] 公告/Pin/云文档/搜索/编辑撤回回应/话题/私聊协议完整
- [x] 邀请链接/二维码自动加入；打字状态/通知/免打扰/屏蔽/导出
- [x] 消息存 IndexedDB，条数上限自动清理；PWA 可安装

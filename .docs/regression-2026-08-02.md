# nchat v2 regression — Task 4.4 全量回归（草稿）

- 日期：2026-08-02
- 环境：Windows + Chrome（普通/无痕双开）
- 服务：Frontend http://localhost:5173 / Signaling ws://localhost:9000

## 3 节点全功能走查
- 节点 A/B/C 可互发文本消息
- 加入 verify-room 正常
- 公告/Pin/文档/搜索 UI 可打开
- 成员列表可见

## 断连演练
- 关闭节点 C 后，A/B 仍可聊天
- 重新加入节点 C，消息同步正常
- 拓扑显示在线/离线变化

## 移动端 375px
- 375 宽度下三栏可用，输入框与按钮可见
- 见 .docs/regression-375.html 预览

## 问题
- 暂无阻塞问题；待后续接入真实 3 节点自动化脚本

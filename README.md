# 黑白象棋 (Xiangqi)

https://github.com/afeifly/xiangqi

一个简单的中国象棋双人在线对弈游戏，基于 WebSocket 实时通信。

## 快速开始

```bash
cd backend
npm install
npm start
```

然后打开 http://localhost:3000

## 游戏规则

- 红方先手
- 点击棋子选中，再点击目标位置移动
- 吃光对方将/帅即获胜

## 技术栈

- 前端: 原生 HTML/CSS/JS
- 后端: Node.js + Express + WebSocket
- 数据库: SQLite (better-sqlite3)

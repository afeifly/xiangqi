# 黑白象棋 (Xiangqi)

https://github.com/afeifly/xiangqi




## 游戏预览

### 实机效果 (Real Device)
<p align="center">
  <img src="pics/p4.jpg" width="600" />
</p>

### 界面截图 (Screenshots)
| 列表与对局 | 游戏棋盘 | 结算界面 |
| :---: | :---: | :---: |
| ![Lobby](pics/p1.jpg) | ![Board](pics/p2.jpg) | ![Game Over](pics/p3.jpg) |

一个简单的中国象棋双人在线对弈游戏，基于 WebSocket 实时通信。


## 快速开始

```bash
cd backend
npm install
npm start
```

然后打开 http://localhost:3000

## Docker 部署

如果你想使用 Docker 部署，只需在根目录下执行：

```bash
docker-compose up -d --build
```

- **端口**: 3000
- **数据持久化**: `xiangqi.db` 会被自动保存在名为 `xiangqi_data` 的 Docker 卷中，即使容器删除数据也不会丢失。

### 常用命令

- **查看日志**: `docker-compose logs -f`
- **停止服务**: `docker-compose down`
- **重新构建**: `docker-compose build --no-cache`


## 游戏规则

- 红方先手
- 点击棋子选中，再点击目标位置移动
- 吃光对方将/帅即获胜

## 技术栈

- 前端: 原生 HTML/CSS/JS
- 后端: Node.js + Express + WebSocket
- 数据库: SQLite (better-sqlite3)

# 黑白象棋 (Xiangqi)

一个简洁现代的中国象棋在线对弈游戏，支持人人对战、人机对战。

**在线试玩**: https://xq.exmm.top

---

## ✨ 功能特性

### 🎮 对战模式
- **人人對戰**: 雙人同屏，通過房間碼邀請好友
- **人機對戰**: 5 級 AI 難度可選 (Lv.1 新手 → Lv.5 大師)
- **房間系統**: 生成 6 位房間碼，快速分享對戰

### 🤖 AI 智能
- **Minimax + Alpha-Beta 剪枝** 算法
- **5 級難度**: 深度 1-4 層搜索
- 位置評估 + 物質力量綜合判斷

### 🎨 界面設計
- **雙主題**: 明亮模式 / 深色模式
- **護眼特優**: 
  - 純色背景，無繁雜動畫
  - E-ink 墨水屏完美適配 (300ms 延遲無壓力)
  - OLED 屏幕友好 (降低視覺疲勞)
- **移動優先**: 手機/平板自適應布局
- **大棋盤**: 優化觸控區域，提升落子體驗

### 📱 實機效果

<p align="center">
  <img src="pics/p4.jpg" width="600" alt="E-ink device demo" />
</p>

| 列表與對局 | 遊戲棋盤 | 結算界面 |
| :---: | :---: | :---: |
| ![Lobby](pics/p1.jpg) | ![Board](pics/p2.jpg) | ![Game Over](pics/p3.jpg) |

### 🔧 技術棧
- 前端: 原生 HTML/CSS/JS (無框架，依賴極簡)
- 後端: Node.js + Express + WebSocket
- 數據庫: SQLite (better-sqlite3)
- 部署: Docker / Docker Compose

---

## 🚀 快速開始

### 本地運行

```bash
# 克隆項目
git clone https://github.com/afeifly/xiangqi.git
cd xiangqi/backend

# 安裝依賴
npm install

# 啟動服務
npm start
```

訪問 http://localhost:3000

### Docker 部署

```bash
cd xiangqi
docker-compose up -d --build
```

常用命令：
```bash
docker-compose logs -f    # 查看日誌
docker-compose down       # 停止服務
docker-compose build      # 重新構建
```

---

## 📖 遊戲規則

1. 紅方先手
2. 點擊棋子選中，點擊目標位置移動
3. 吃掉對方將/帥即獲勝
4. 棋子規則與傳統中國象棋一致

---

## 🎯 AI 難度說明

| 等級 | 搜索深度 | 適合玩家 |
|:---:|:---:|:---|
| Lv.1 | 1層 | 第一次玩象棋 |
| Lv.2 | 2層 | 業餘愛好者 |
| Lv.3 | 3層 | 中等水平 |
| Lv.4 | 3層+ | 較強對手 |
| Lv.5 | 4層 | 高手挑戰 |

---

## 🖥️ 適配說明

### 墨水屏 (E-ink)
- ✅ 無動畫殘影
- ✅ 高對比度顯示
- ✅ 刷新延遲 300ms 內可接受
- 建議：開啟深色模式效果更佳

### OLED 屏幕
- ✅ 深色模式減少OLED發光
- ✅ 無刺眼動畫
- ✅ 省電護眼

### 老年機/低端設備
- ✅ 輕量級前端，加載快速
- ✅ 離線可用 (刷新後)

---

## 📁 項目結構

```
xiangqi/
├── backend/
│   ├── server.js      # 主服務器
│   ├── ai.js          # AI 引擎
│   ├── schema.sql     # 數據庫結構
│   └── package.json
├── static/
│   ├── index.html     # 遊戲主頁面
│   ├── ai.js          # 前端 AI 邏輯
│   └── rules.js       # 規則判斷
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 📄 License

MIT License

---

**在線試玩**: https://xq.exmm.top
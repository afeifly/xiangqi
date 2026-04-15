# Xiangqi (Chinese Chess)

A modern, minimalist Chinese Chess (Xiangqi) online game supporting PvP and PvAI matches.

**Play Online**: https://xq.exmm.top

---

## 🌍 Language / 语言

- [English](README.md) (Current)
- [中文](README.zh-CN.md)

Click the 🌐 icon in the top-right corner of the game to switch languages.

---

## ✨ Features

### 🎮 Game Modes
- **PvP**: Two players on one device, invite friends via room code
- **PvAI**: Play against AI with 5 difficulty levels (Lv.1 Beginner → Lv.5 Master)
- **Room System**: Generate 6-character room codes for quick sharing

### 🏰 Special Features
- **🕰️ History & Replay**: Save and replay any game, step back/forward through moves
- **💀 Health Bars**: Real-time battle status showing material strength of both sides
- **🎭 Character Profiles**: Unique names generated with personality traits for each player

### 🤖 AI Engine
- **Minimax + Alpha-Beta Pruning** algorithm
- **5 difficulty levels**: Depth 1-4 search
- Position evaluation + material balance

### 🎨 UI Design
- **Dual Theme**: Light mode / Dark mode
- **Eye-Friendly**:
  - Solid background, no complex animations
  - Perfect for E-ink displays (300ms refresh delay)
  - OLED friendly (reduces visual fatigue)
- **Mobile-First**: Responsive design for phone/tablet
- **Large Board**: Optimized touch areas for better experience

### 📱 Screenshots

<p align="center">
  <img src="pics/p4.jpg" width="600" alt="Device demo" />
</p>

| Lobby | Game Board | Game Over |
| :---: | :---: | :---: |
| ![Lobby](pics/p1.jpg) | ![Board](pics/p2.jpg) | ![Game Over](pics/p3.jpg) |

### 🔧 Tech Stack
- Frontend: Vanilla HTML/CSS/JS
- Backend: Node.js + Express + WebSocket
- Database: SQLite (better-sqlite3)
- Deployment: Docker / Docker Compose

---

## 🚀 Quick Start

### Local Run

```bash
# Clone repo
git clone https://github.com/afeifly/xiangqi.git
cd xiangqi/backend

# Install dependencies
npm install

# Start server
npm start
```

Visit http://localhost:3000

### Docker Deployment

```bash
cd xiangqi
docker-compose up -d --build
```

Common commands:
```bash
docker-compose logs -f    # View logs
docker-compose down       # Stop service
docker-compose build      # Rebuild
```

---

## 📖 Rules

1. Red side moves first
2. Click piece to select, click destination to move
3. Capture opponent's King/General to win

---

## 🎯 AI Difficulty

| Level | Depth | For |
|:---:|:---:|:---|
| Lv.1 | 1 | First time players |
| Lv.2 | 2 | Amateur |
| Lv.3 | 3 | Intermediate |
| Lv.4 | 3+ | Advanced |
| Lv.5 | 4 | Expert |

---

## 🖥️ Device Compatibility

### E-ink Displays
- ✅ No animation ghosting
- ✅ High contrast
- ✅ 300ms refresh delay acceptable
- Tip: Dark mode works best

### OLED Screens
- ✅ Dark mode reduces OLED emission
- ✅ No harsh animations
- ✅ Battery saving

### Low-end Devices
- ✅ Lightweight frontend, fast loading
- ✅ Works offline (after load)

---

## 📁 Project Structure

```
xiangqi/
├── backend/
│   ├── server.js      # Main server
│   ├── ai.js          # AI engine
│   ├── schema.sql     # Database schema
│   └── package.json
├── static/
│   ├── index.html     # Main game page
│   ├── ai.js          # Frontend AI logic
│   └── rules.js       # Game rules
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## 🌐 Language

- [English](README.md)
- [中文](README.zh-CN.md)

---

## 📄 License

MIT License

---

**Play Online**: https://xq.exmm.top
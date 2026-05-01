# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Xiangqi (Chinese Chess) online game supporting PvP and PvAI matches. Monochrome/minimalist design optimized for E-ink and OLED displays.

## Architecture

```
xiangqi/
├── backend/
│   ├── server.js       # Express + WebSocket server (port 3000)
│   ├── ai.js           # Legacy server-side AI (DISABLED — kept for reference)
│   └── schema.sql      # SQLite schema (rooms + moves tables)
├── static/
│   ├── index.html      # Single-page app: UI, WebSocket client, game logic
│   ├── rules.js        # Move validation, check detection, material evaluation
│   └── ai.js           # AI engine (Minimax + Alpha-Beta + iterative deepening)
├── Dockerfile
└── docker-compose.yml  # Persists SQLite via volume
```

## Key Technical Details

- **No build tools or frameworks** — vanilla HTML/CSS/JS. Frontend is served statically by Express.
- **AI runs client-side in a Web Worker** (`static/ai.js` loaded as a Worker). The server-side AI (`backend/ai.js`) is legacy/commented-out — do not re-enable it.
- **AI levels**: Level values 1/4/7/10/13 map to UI options "菜就多练" through "独孤求败". These are linear depth controls, not 1-5.
- **Identity**: `sessionStorage`-based session IDs (no auth). Reconnection via exponential backoff WebSocket.
- **WebSocket** (`ws` library) for real-time moves. HTTP REST for room CRUD, undo, history.
- **Piece encoding**: Lowercase = red, uppercase = black. First char = type (k/K=king, a/A=advisor, b/B=bishop, n/N=knight, r/R=rook, c/C=cannon, p/P=pawn).
- **Board**: 10 rows × 9 cols. `board[y][x]` indexed with y=0 at top (black's back rank), y=9 at bottom (red's back rank).
- **Dark mode is default** — `localStorage` key `xiangqi_theme`.

## Key Server API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/create` | Create PvP room |
| POST | `/api/create-ai` | Create AI room (body: `{level}`) |
| POST | `/api/join` | Join room by 4-digit code |
| POST | `/api/move` | Make a move |
| GET | `/api/sync/:code` | Full board state for reconnection |
| POST | `/api/save-game` | Persist game to history |
| GET | `/api/history/:roomCode` | Full move list for replay |
| POST | `/api/undo-request` | Request undo (auto-accepts in AI rooms) |

## Commands

```bash
# Run locally (backend/)
cd backend && npm start          # Start on http://localhost:3000

# Docker deployment (project root)
docker-compose up -d --build     # Build and start
docker-compose logs -f           # View server logs
docker-compose down              # Stop services
docker-compose build             # Rebuild
```

const express = require('express');
const { Server } = require('ws');
const Database = require('better-sqlite3');
const http = require('http');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new Server({ server });

// 数据库
const db = new Database(path.join(__dirname, 'xiangqi.db'));
const schema = require('fs').readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema.replace(/CREATE TABLE/g, 'CREATE TABLE IF NOT EXISTS'));

// WebSocket 连接池
const clients = new Map(); // sessionId -> { ws, roomCode, color }

function generateRoomCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// 生成初始棋盘
function getInitialBoard() {
    return [
        ['r1','n1','b1','a1','k','a2','b2','n2','r2'],  // 红方底线 0
        [null,null,null,null,null,null,null,null,null],  // 1
        [null,'c1',null,null,null,null,null,'c2',null], // 2 炮
        ['p1',null,'p2',null,'p3',null,'p4',null,'p5'], // 3 兵
        [null,null,null,null,null,null,null,null,null],  // 4
        [null,null,null,null,null,null,null,null,null],  // 5
        ['P1',null,'P2',null,'P3',null,'P4',null,'P5'], // 6 黑兵
        [null,'C1',null,null,null,null,null,'C2',null],  // 7 黑炮
        [null,null,null,null,null,null,null,null,null],  // 8
        ['R1','N1','B1','A1','K','A2','B2','N2','R2'],  // 9 黑方底线
    ];
}

// 验证走法
function validateMove(board, piece, fromX, fromY, toX, toY, color) {
    // 颜色检测
    const isRed = piece === piece.toLowerCase();
    if ((color === 'red' && !isRed) || (color === 'black' && isRed)) {
        return false;
    }

    // 越界
    if (toX < 0 || toX > 8 || toY < 0 || toY > 9) return false;

    // 目标位置有己方棋子
    const target = board[toY][toX];
    if (target) {
        const targetIsRed = target === target.toLowerCase();
        if (targetIsRed === isRed) return false;
    }

    const dx = toX - fromX;
    const dy = toY - fromY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // 将/帅 - 直线一格
    if (piece.toLowerCase() === 'k') {
        if (absDx + absDy !== 1) return false;
        // 不能出九宫
        if (color === 'red' && (toX < 3 || toX > 5 || toY > 2)) return false;
        if (color === 'black' && (toX < 3 || toX > 5 || toY < 7)) return false;
        return true;
    }

    // 士 - 斜线一格
    if (piece.toLowerCase() === 'a') {
        if (absDx !== 1 || absDy !== 1) return false;
        if (color === 'red' && (toX < 3 || toX > 5 || toY > 2)) return false;
        if (color === 'black' && (toX < 3 || toX > 5 || toY < 7)) return false;
        return true;
    }

    // 相/象 - 田字
    if (piece.toLowerCase() === 'b') {
        if (absDx !== 2 || absDy !== 2) return false;
        // 塞象眼
        if (board[(fromY + toY)/2][(fromX + toX)/2]) return false;
        // 不能过河
        if (color === 'red' && toY > 4) return false;
        if (color === 'black' && toY < 5) return false;
        return true;
    }

    // 马 - 日
    if (piece.toLowerCase() === 'n') {
        if ((absDx === 1 && absDy === 2) || (absDx === 2 && absDy === 1)) {
            // 蹩马腿
            const jumpX = dx > 0 ? fromX + 1 : (dx < 0 ? fromX - 1 : fromX);
            const jumpY = dy > 0 ? fromY + 1 : (dy < 0 ? fromY - 1 : fromY);
            if (board[jumpY] && board[jumpY][jumpX]) return false;
            return true;
        }
        return false;
    }

    // 车 - 直线
    if (piece.toLowerCase() === 'r') {
        if (dx !== 0 && dy !== 0) return false;
        // 检查路径
        const stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
        const stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
        let cx = fromX + stepX, cy = fromY + stepY;
        while (cx !== toX || cy !== toY) {
            if (board[cy] && board[cy][cx]) return false;
            cx += stepX;
            cy += stepY;
        }
        return true;
    }

    // 炮 - 直线，吃子需隔一子
    if (piece.toLowerCase() === 'c') {
        if (dx !== 0 && dy !== 0) return false;
        let count = 0;
        const stepX = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
        const stepY = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
        let cx = fromX + stepX, cy = fromY + stepY;
        while (cx !== toX || cy !== toY) {
            if (board[cy] && board[cy][cx]) count++;
            cx += stepX;
            cy += stepY;
        }
        if (target && count !== 1) return false;
        if (!target && count !== 0) return false;
        return true;
    }

    // 兵/卒 - 过河前后走法不同
    if (piece.toLowerCase() === 'p') {
        if (isRed) {
            if (fromY > 4) { // 未过河，只能前进
                if (dy !== -1 || dx !== 0) return false;
            } else { // 过河后可以左右
                if (!(dy === -1 && dx === 0) && absDx + absDy !== 1) return false;
            }
        } else {
            if (fromY < 5) { // 未过河，只能前进
                if (dy !== 1 || dx !== 0) return false;
            } else { // 过河后可以左右
                if (!(dy === 1 && dx === 0) && absDx + absDy !== 1) return false;
            }
        }
        return true;
    }

    return false;
}

// 广播到房间内所有客户端
function broadcastToRoom(roomCode, data) {
    for (const [sid, client] of clients) {
        if (client.roomCode === roomCode && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify(data));
        }
    }
}

// API路由
app.use(express.json());
app.use(express.static(path.join(__dirname, '../static')));

// 创建房间
app.post('/api/create', (req, res) => {
    const roomCode = generateRoomCode();
    const sessionId = req.headers['x-session-id'] || crypto.randomBytes(16).toString('hex');
    
    db.prepare('INSERT INTO rooms (room_code, red_player) VALUES (?, ?)').run(roomCode, sessionId);
    
    res.json({ roomCode, sessionId });
});

// 加入房间
app.post('/api/join', (req, res) => {
    const { roomCode } = req.body;
    const sessionId = req.headers['x-session-id'] || crypto.randomBytes(16).toString('hex');
    
    const room = db.prepare('SELECT * FROM rooms WHERE room_code = ?').get(roomCode);
    if (!room) return res.status(404).json({ error: '房间不存在' });
    if (room.status !== 'waiting') return res.status(400).json({ error: '房间已开始或已结束' });
    
    db.prepare('UPDATE rooms SET black_player = ?, status = "playing" WHERE id = ?').run(sessionId, room.id);
    
    res.json({ sessionId, success: true });
});

// 获取房间状态
app.get('/api/room/:code', (req, res) => {
    const room = db.prepare('SELECT * FROM rooms WHERE room_code = ?').get(req.params.code);
    if (!room) return res.status(404).json({ error: '房间不存在' });
    res.json({
        status: room.status,
        currentTurn: room.current_turn,
        winner: room.winner
    });
});

// 走棋
app.post('/api/move', (req, res) => {
    const { roomCode, sessionId, fromX, fromY, toX, toY, piece } = req.body;
    
    const room = db.prepare('SELECT * FROM rooms WHERE room_code = ?').get(roomCode);
    if (!room || room.status !== 'playing') {
        return res.status(400).json({ error: '游戏未开始' });
    }
    
    const currentColor = room.current_turn;
    const playerField = currentColor === 'red' ? 'red_player' : 'black_player';
    if (room[playerField] !== sessionId) {
        return res.status(403).json({ error: '还没轮到你' });
    }
    
    const board = getInitialBoard(); // 简化：应该从数据库恢复棋盘状态
    
    if (!validateMove(board, piece, fromX, fromY, toX, toY, currentColor)) {
        return res.status(400).json({ error: '非法走法' });
    }
    
    // 记录走棋
    const moveNum = db.prepare('SELECT COUNT(*) as c FROM moves WHERE game_id = ?').get(room.id).c + 1;
    db.prepare('INSERT INTO moves (game_id, move_number, piece, from_x, from_y, to_x, to_y) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(room.id, moveNum, piece, fromX, fromY, toX, toY);
    
    // 切换回合
    const nextTurn = currentColor === 'red' ? 'black' : 'red';
    db.prepare('UPDATE rooms SET current_turn = ? WHERE id = ?').run(nextTurn, room.id);
    
    // 广播
    broadcastToRoom(roomCode, {
        type: 'move',
        move: { fromX, fromY, toX, toY, piece },
        nextTurn
    });
    
    res.json({ success: true });
});

// WebSocket
wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const sessionId = url.searchParams.get('sessionId');
    const roomCode = url.searchParams.get('roomCode');
    
    if (sessionId && roomCode) {
        clients.set(sessionId, { ws, roomCode });
        
        // 通知对方有人来了
        broadcastToRoom(roomCode, { type: 'playerJoined', who: sessionId });
    }
    
    ws.on('close', () => {
        clients.delete(sessionId);
    });
});

const PORT = 3000;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
    console.log(`象棋服务启动: http://localhost:${PORT}`);
    console.log(`局域网访问: http://192.168.2.14:${PORT}`);
});

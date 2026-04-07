const express = require('express');
const { Server } = require('ws');
const Database = require('better-sqlite3');
const http = require('http');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const wss = new Server({ server });

// 数据库 - DB_PATH env allows Docker volume persistence
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'xiangqi.db');
const db = new Database(DB_PATH);
const schema = require('fs').readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema.replace(/CREATE TABLE/g, 'CREATE TABLE IF NOT EXISTS'));

try {
    db.prepare("ALTER TABLE rooms ADD COLUMN last_board TEXT").run();
} catch (e) { }
try {
    db.prepare("ALTER TABLE rooms ADD COLUMN prev_board TEXT").run();
} catch (e) { }
try {
    db.prepare("ALTER TABLE rooms ADD COLUMN last_mover TEXT").run();
} catch (e) { }
try {
    db.prepare("ALTER TABLE rooms ADD COLUMN red_name TEXT").run();
} catch (e) { }
try {
    db.prepare("ALTER TABLE rooms ADD COLUMN black_name TEXT").run();
} catch (e) { }
try {
    db.prepare("ALTER TABLE rooms ADD COLUMN room_name TEXT").run();
} catch (e) { }

const ROOM_NAMES = [
    // 金庸 / 武侠
    "白虎节堂", "绿竹巷", "快活林", "聚贤庄", "恶人谷", "燕子坞", "曼陀山庄", "缥缈峰", "灵鹫宫", "少林寺", "黑木崖", "光明顶", "桃花岛", "侠客岛", "断天涯", "归云庄", "铁掌峰", "翠屏山", "鸳鸯楼", "聚和殿",
    "襄阳城", "绝情谷", "白驼山", "全真教", "活死人墓", "剑魔谷", "思过崖", "梅庄", "燕子矶", "天宁寺", "石梁派", "金蛇营", "药王谷", "星宿海", "昆仑派", "武当山", "峨嵋金顶", "燕子楼",
    // 三国
    "赤壁", "长坂坡", "华容道", "五丈原", "祁山", "街亭", "麦城", "白帝城", "官渡", "虎牢关",
    // 水浒
    "梁山泊", "景阳冈", "浔阳楼", "祝家庄", "曾头市", "十字坡", "江州城", "大名府", "野猪林", "二龙山", "乌龙岭", "石碣村",
    // 西游
    "花果山", "五行山", "高老庄", "流沙河", "火焰山", "盘丝洞", "狮驼岭", "女儿国", "通天河", "车迟国", "平顶山", "雷音寺", "南天门", "凌霄殿"
];

const VICTORY_FLAVORS = [
    "侥幸到令人发指", "绝对碾压式", "堪称载入族谱", "教科书般朴实", "棋坛做梦级", "场面一度十分尴尬",
    "堪比瞎猫碰上死耗子", "玄学加持", "火锅底料般辛辣", "泡面级神速", "让替补席集体沉默", "卧底般深藏不露",
    "荡气回肠", "朴实无华且枯燥", "令人猝不及防", "难忘到可以写进作文"
];

function colorHasKing(board, color) {
    const k = color === 'red' ? 'k' : 'K';
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (p && p[0] === k) return true;
        }
    }
    return false;
}

function buildVictoryLine(winnerColor, redName, blackName) {
    const r = redName || '红方';
    const b = blackName || '黑方';
    const winnerName = winnerColor === 'red' ? r : b;
    const loserName = winnerColor === 'red' ? b : r;
    const flavor = VICTORY_FLAVORS[Math.floor(Math.random() * VICTORY_FLAVORS.length)];
    return `${winnerName} 战胜了 ${loserName}，收获一场「${flavor}」的胜利！`;
}

// 定时清理（每天 02:00 AM）
let lastCleanupHour = -1;
setInterval(function () {
    var now = new Date();
    var h = now.getHours();
    if (h === 2 && lastCleanupHour !== 2) {
        lastCleanupHour = 2;
        console.log('执行 02:00 系统自动清理');
        db.prepare("DELETE FROM moves").run();
        db.prepare("DELETE FROM rooms").run();
    } else if (h !== 2) {
        lastCleanupHour = h;
    }
}, 60000);

// WebSocket 连接池
const clients = new Map(); // sessionId -> { ws, roomCode, color }

function generateRoomCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// 生成初始棋盘
function getInitialBoard() {
    return [
        ['R1', 'N1', 'B1', 'A1', 'K', 'A2', 'B2', 'N2', 'R2'],  // 黑方底线 0
        [null, null, null, null, null, null, null, null, null],  // 1
        [null, 'C1', null, null, null, null, null, 'C2', null], // 2 黑炮
        ['P1', null, 'P2', null, 'P3', null, 'P4', null, 'P5'], // 3 黑卒
        [null, null, null, null, null, null, null, null, null],  // 4
        [null, null, null, null, null, null, null, null, null],  // 5
        ['p1', null, 'p2', null, 'p3', null, 'p4', null, 'p5'], // 6 红兵
        [null, 'c1', null, null, null, null, null, 'c2', null],  // 7 红炮
        [null, null, null, null, null, null, null, null, null],  // 8
        ['r1', 'n1', 'b1', 'a1', 'k', 'a2', 'b2', 'n2', 'r2'],  // 9 红方底线
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
    const pieceType = piece.toLowerCase()[0]; // get the first char for type

    // 将/帅 - 直线一格
    if (pieceType === 'k') {
        if (absDx + absDy !== 1) return false;
        // 不能出九宫
        if (color === 'red' && (toX < 3 || toX > 5 || toY < 7)) return false;
        if (color === 'black' && (toX < 3 || toX > 5 || toY > 2)) return false;
        return true;
    }

    // 士 - 斜线一格
    if (pieceType === 'a') {
        if (absDx !== 1 || absDy !== 1) return false;
        if (color === 'red' && (toX < 3 || toX > 5 || toY < 7)) return false;
        if (color === 'black' && (toX < 3 || toX > 5 || toY > 2)) return false;
        return true;
    }

    // 相/象 - 田字
    if (pieceType === 'b') {
        if (absDx !== 2 || absDy !== 2) return false;
        // 塞象眼
        if (board[(fromY + toY) / 2][(fromX + toX) / 2]) return false;
        // 不能过河
        if (color === 'red' && toY < 5) return false;
        if (color === 'black' && toY > 4) return false;
        return true;
    }

    if (pieceType === 'n') {
        if (absDx === 1 && absDy === 2) {
            if (board[fromY + dy / 2] && board[fromY + dy / 2][fromX]) return false;
            return true;
        }
        if (absDx === 2 && absDy === 1) {
            if (board[fromY] && board[fromY][fromX + dx / 2]) return false;
            return true;
        }
        return false;
    }

    // 车 - 直线
    if (pieceType === 'r') {
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
    if (pieceType === 'c') {
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
    if (pieceType === 'p') {
        if (isRed) {
            if (fromY > 4) { // 未过河，只能前进 (y 减少)
                if (dy !== -1 || dx !== 0) return false;
            } else { // 过河后可以左右
                if (!(dy === -1 && dx === 0) && absDx + absDy !== 1) return false;
                if (dy === 1) return false; // 不能后退
            }
        } else {
            if (fromY < 5) { // 未过河，只能前进 (y 增加)
                if (dy !== 1 || dx !== 0) return false;
            } else { // 过河后可以左右
                if (!(dy === 1 && dx === 0) && absDx + absDy !== 1) return false;
                if (dy === -1) return false; // 不能后退
            }
        }
        return true;
    }

    return false;
}
function findKing(board, color) {
    var k = color === 'red' ? 'k' : 'K';
    for (var y = 0; y < 10; y++) {
        for (var x = 0; x < 9; x++) {
            if (board[y][x] && board[y][x][0] === k) return { x: x, y: y };
        }
    }
    return null;
}

function isCheck(board, color) {
    var king = findKing(board, color);
    if (!king) return false;
    var opponent = color === 'red' ? 'black' : 'red';
    for (var y = 0; y < 10; y++) {
        for (var x = 0; x < 9; x++) {
            var piece = board[y][x];
            if (!piece) continue;
            var isOp = (opponent === 'red' ? piece === piece.toLowerCase() : piece === piece.toUpperCase());
            if (isOp) {
                if (validateMove(board, piece, x, y, king.x, king.y, opponent)) return true;
            }
        }
    }
    return false;
}


// 广播到房间内所有客户端
function broadcastToRoom(roomCode, data) {
    let count = 0;
    for (const [sid, client] of clients) {
        if (client.roomCode === roomCode && client.ws.readyState === 1) {
            client.ws.send(JSON.stringify(data));
            count++;
        }
    }
    console.log(`Broadcasted to room ${roomCode}: ${data.type}, clients notified: ${count}`);
}

// API路由
app.use(express.json());
app.use(express.static(path.join(__dirname, '../static')));

// 首页大厅：列出等待中的房间
app.get('/api/lobby', (req, res) => {
    // Deliberately exclude room_code to keep it confidential
    const rooms = db.prepare("SELECT room_name, red_name FROM rooms WHERE status = 'waiting' AND room_name IS NOT NULL ORDER BY created_at DESC LIMIT 10").all();
    res.json({ rooms });
});

// 创建房间
app.post('/api/create', (req, res) => {
    const { nickname } = req.body;
    const roomCode = generateRoomCode();
    const sessionId = req.headers['x-session-id'] || crypto.randomBytes(16).toString('hex');

    // 随机一个没被占用的名字
    const roomName = ROOM_NAMES[Math.floor(Math.random() * ROOM_NAMES.length)];
    const initialBoard = JSON.stringify(getInitialBoard());
    db.prepare('INSERT INTO rooms (room_code, room_name, red_player, red_name, last_board) VALUES (?, ?, ?, ?, ?)').run(roomCode, roomName, sessionId, nickname || '红方', initialBoard);

    res.json({ roomCode, roomName, sessionId });
});

// 加入房间
app.post('/api/join', (req, res) => {
    const { roomCode, nickname } = req.body;
    const sessionId = req.headers['x-session-id'] || crypto.randomBytes(16).toString('hex');

    const room = db.prepare('SELECT * FROM rooms WHERE room_code = ?').get(roomCode);
    if (!room) return res.status(404).json({ error: '房间不存在' });
    if (room.status !== 'waiting') return res.status(400).json({ error: '房间已开始或已结束' });

    db.prepare("UPDATE rooms SET black_player = ?, black_name = ?, status = 'playing' WHERE room_code = ?").run(sessionId, nickname || '黑方', roomCode);

    res.json({ sessionId, success: true });
});

// 获取房间当前全量状态 (用于刷新页面恢复)
app.get('/api/sync/:code', (req, res) => {
    const roomCode = req.params.code;
    const sessionId = req.headers['x-session-id'];
    const room = db.prepare('SELECT * FROM rooms WHERE room_code = ?').get(roomCode);

    if (!room) return res.status(404).json({ error: '房间不存在' });

    const isRed = room.red_player === sessionId;
    const isBlack = room.black_player === sessionId;

    if (!isRed && !isBlack) {
        return res.status(403).json({ error: '您不在此房间内' });
    }

    const lastMoveRow = db.prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY id DESC LIMIT 1').get(room.id);
    const lastMove = lastMoveRow ? {
        fromX: lastMoveRow.from_x,
        fromY: lastMoveRow.from_y,
        toX: lastMoveRow.to_x,
        toY: lastMoveRow.to_y,
        piece: lastMoveRow.piece
    } : null;

    const st = room.status;
    const win = room.winner;
    res.json({
        roomName: room.room_name,
        board: JSON.parse(room.last_board),
        redName: room.red_name,
        blackName: room.black_name,
        currentTurn: room.current_turn,
        myColor: isRed ? 'red' : 'black',
        status: st,
        winner: win,
        victoryLine: st === 'finished' && win ? buildVictoryLine(win, room.red_name, room.black_name) : null,
        lastMove: lastMove
    });
});

// 离开房间
app.post('/api/leave', (req, res) => {
    const { roomCode } = req.body;
    const sessionId = req.headers['x-session-id'];
    const room = db.prepare('SELECT * FROM rooms WHERE room_code = ?').get(roomCode);
    if (!room) return res.json({ success: true });

    if (room.red_player === sessionId) {
        db.prepare("UPDATE rooms SET red_player = NULL, red_name = NULL WHERE id = ?").run(room.id);
    } else if (room.black_player === sessionId) {
        db.prepare("UPDATE rooms SET black_player = NULL, black_name = NULL WHERE id = ?").run(room.id);
    }

    const updated = db.prepare("SELECT * FROM rooms WHERE id = ?").get(room.id);
    if (!updated.red_player && !updated.black_player) {
        db.prepare("DELETE FROM moves WHERE game_id = ?").run(room.id);
        db.prepare("DELETE FROM rooms WHERE id = ?").run(room.id);
    } else {
        broadcastToRoom(roomCode, { type: 'playerLeft', who: sessionId });
    }
    res.json({ success: true });
});

// 获取房间基础状态
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

    // 从数据库中的 board 获取最新状态
    const board = JSON.parse(room.last_board);
    const actualPiece = board[fromY][fromX];

    if (!actualPiece || actualPiece !== piece) {
        return res.status(400).json({ error: '棋子位置不匹配' });
    }

    if (!validateMove(board, actualPiece, fromX, fromY, toX, toY, currentColor)) {
        return res.status(400).json({ error: '非法走法' });
    }

    // Save pre-move state for undo
    const prevBoard = JSON.stringify(board);

    // Executing the move
    const captured = board[toY][toX];
    board[toY][toX] = piece;
    board[fromY][fromX] = null;

    // 将/帅被吃：以吃子判定 + 棋盘上是否还有将/帅（双保险）
    let winner = null;
    if (captured && captured.toLowerCase()[0] === 'k') {
        winner = currentColor;
    }
    if (!colorHasKing(board, 'red')) winner = 'black';
    else if (!colorHasKing(board, 'black')) winner = 'red';

    const victoryLine = winner ? buildVictoryLine(winner, room.red_name, room.black_name) : null;

    // Records the move
    const moveNum = db.prepare('SELECT COUNT(*) as c FROM moves WHERE game_id = ?').get(room.id).c + 1;
    db.prepare('INSERT INTO moves (game_id, move_number, piece, from_x, from_y, to_x, to_y) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(room.id, moveNum, piece, fromX, fromY, toX, toY);

    // Save state
    const nextTurn = currentColor === 'red' ? 'black' : 'red';
    const gameStatus = winner ? 'finished' : 'playing';
    db.prepare('UPDATE rooms SET current_turn = ?, last_board = ?, prev_board = ?, last_mover = ?, status = ?, winner = ? WHERE id = ?')
        .run(nextTurn, JSON.stringify(board), prevBoard, sessionId, gameStatus, winner, room.id);

    const inCheck = winner ? false : isCheck(board, nextTurn);

    // Broadcast
    broadcastToRoom(roomCode, {
        type: 'move',
        move: { fromX, fromY, toX, toY, piece },
        nextTurn,
        status: gameStatus,
        winner,
        victoryLine,
        isCheck: inCheck
    });

    // HTTP 同步返回：走棋方即使未收到 WS 也能立刻结算并刷新棋盘
    res.json({
        success: true,
        board,
        nextTurn,
        status: gameStatus,
        winner,
        victoryLine,
        isCheck: inCheck
    });
});

// 悔棋 (Undo) — called internally after opponent accepts
function performUndo(roomCode, sessionId, res) {
    const room = db.prepare('SELECT * FROM rooms WHERE room_code = ?').get(roomCode);
    if (!room || room.status !== 'playing') {
        if (res) return res.status(400).json({ error: '游戏未开始' });
        return;
    }
    if (!room.prev_board) {
        if (res) return res.status(400).json({ error: '没有可悔的棋' });
        return;
    }
    const myColor = room.red_player === sessionId ? 'red' : 'black';
    db.prepare('UPDATE rooms SET last_board = ?, prev_board = NULL, last_mover = NULL, current_turn = ? WHERE id = ?')
        .run(room.prev_board, myColor, room.id);
    const lastMoveRow = db.prepare('SELECT id FROM moves WHERE game_id = ? ORDER BY move_number DESC LIMIT 1').get(room.id);
    if (lastMoveRow) db.prepare('DELETE FROM moves WHERE id = ?').run(lastMoveRow.id);
    broadcastToRoom(roomCode, { type: 'undo', board: JSON.parse(room.prev_board), currentTurn: myColor });
    if (res) res.json({ success: true });
}

// 悔棋请求 — via HTTP (initiates the WS flow)
app.post('/api/undo-request', (req, res) => {
    const { roomCode } = req.body;
    const sessionId = req.headers['x-session-id'];
    const room = db.prepare('SELECT * FROM rooms WHERE room_code = ?').get(roomCode);
    if (!room || room.status !== 'playing') return res.status(400).json({ error: '游戏未开始' });
    if (room.last_mover !== sessionId) return res.status(403).json({ error: '只能悔自己的棋' });
    if (!room.prev_board) return res.status(400).json({ error: '没有可悔的棋' });
    const requesterName = room.red_player === sessionId ? room.red_name : room.black_name;
    broadcastToRoom(roomCode, { type: 'undoRequest', from: sessionId, fromName: requesterName });
    res.json({ success: true });
});

// 悔棋接受 — opponent accepts
app.post('/api/undo-accept', (req, res) => {
    const { roomCode, requesterSession } = req.body;
    performUndo(roomCode, requesterSession, res);
});

// 悔棋拒绝 — opponent declines
app.post('/api/undo-decline', (req, res) => {
    const { roomCode } = req.body;
    const sessionId = req.headers['x-session-id'];
    const room = db.prepare('SELECT * FROM rooms WHERE room_code = ?').get(roomCode);
    if (!room) return res.json({ success: true });
    // Notify the last mover that their request was declined
    broadcastToRoom(roomCode, { type: 'undoDeclined', to: room.last_mover });
    res.json({ success: true });
});

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const sessionId = url.searchParams.get('sessionId');
    const roomCode = url.searchParams.get('roomCode');

    if (sessionId && roomCode) {
        clients.set(sessionId, { ws, roomCode });

        // 通知对方有人来了，带上名字
        const room = db.prepare('SELECT red_name, black_name FROM rooms WHERE room_code = ?').get(roomCode);
        if (room) {
            broadcastToRoom(roomCode, {
                type: 'playerJoined',
                redName: room.red_name,
                blackName: room.black_name,
                who: sessionId
            });
        }
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

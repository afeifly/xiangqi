/**
 * Professional Upgrade (v3): Iterative Deepening + Piece Tracking
 */

const PIECE_VALUES = {
    'k': 10000, 'r': 600, 'c': 285, 'n': 270, 'a': 120, 'b': 120, 'p': 30,
    'K': 10000, 'R': 600, 'C': 285, 'N': 270, 'A': 120, 'B': 120, 'P': 30
};

const Zobrist = {
    keys: new Uint32Array(10 * 9 * 14 * 2),
    turn: [Math.random() * 0xFFFFFFFF >>> 0, Math.random() * 0xFFFFFFFF >>> 0],
    init() { for (let i = 0; i < this.keys.length; i++) this.keys[i] = Math.random() * 0xFFFFFFFF >>> 0; },
    getPieceIndex(p) { return "rkcnabpRKCNABP".indexOf(p); },
    getHash(board, turnColor) {
        let h1 = 0, h2 = 0;
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 9; x++) {
                const p = board[y][x];
                if (p) {
                    const idx = (y * 9 + x) * 14 + this.getPieceIndex(p);
                    h1 ^= this.keys[idx * 2]; h2 ^= this.keys[idx * 2 + 1];
                }
            }
        }
        if (turnColor === 'black') { h1 ^= this.turn[0]; h2 ^= this.turn[1]; }
        return { h1, h2 };
    }
};
Zobrist.init();

const TT_SIZE = 1 << 19;
const TT_MASK = TT_SIZE - 1;
const TT = {
    keys: new Uint32Array(TT_SIZE), values: new Int32Array(TT_SIZE),
    depths: new Int8Array(TT_SIZE), flags: new Int8Array(TT_SIZE),
    get(h) {
        const idx = (h.h1 ^ h.h2) & TT_MASK;
        if (this.keys[idx] === h.h1) return { val: this.values[idx], depth: this.depths[idx], flag: this.flags[idx] };
        return null;
    },
    set(h, val, depth, flag) {
        const idx = (h.h1 ^ h.h2) & TT_MASK;
        if (depth >= this.depths[idx] || this.keys[idx] === 0) {
            this.keys[idx] = h.h1; this.values[idx] = val; this.depths[idx] = depth; this.flags[idx] = flag;
        }
    }
};

const PST = {
    'n': [[-10,-5,-5,-5,-5,-5,-5,-5,-10],[-10,0,5,5,5,5,5,0,-10],[-10,5,10,10,10,10,10,5,-10],[-10,5,10,15,15,15,10,5,-10],[-10,5,10,15,20,15,10,5,-10],[-10,5,10,15,20,15,10,5,-10],[-10,5,10,15,15,15,10,5,-10],[-10,5,10,10,10,10,10,5,-10],[-10,0,5,5,5,5,5,0,-10],[-10,-5,-5,-5,-5,-5,-5,-5,-10]],
    'c': [[0,0,0,0,0,0,0,0,0],[0,5,5,5,5,5,5,5,0],[0,5,10,10,10,10,10,5,0],[0,0,5,5,5,5,5,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,5,5,5,5,5,5,5,0],[0,10,10,10,10,10,10,10,0],[0,5,5,5,5,5,5,5,0],[0,0,0,0,0,0,0,0,0]],
    'p': [[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[0,0,0,0,0,0,0,0,0],[2,0,2,0,2,0,2,0,2],[3,0,4,0,5,0,4,0,3],[10,15,20,25,25,25,20,15,10],[20,30,40,50,55,50,40,30,20],[30,40,50,60,65,60,50,40,30],[40,50,60,70,75,70,60,50,40],[20,20,20,20,20,20,20,20,20]],
    'r': [[0,0,5,10,10,10,5,0,0],[5,10,10,15,15,15,10,10,5],[5,10,10,15,15,15,10,10,5],[5,10,10,15,15,15,10,10,5],[5,10,10,15,15,15,10,10,5],[5,10,10,15,15,15,10,10,5],[5,10,10,15,15,15,10,10,5],[5,10,10,15,15,15,10,10,5],[5,10,10,15,15,15,10,10,5],[0,5,10,10,10,10,10,5,0]]
};

function copyBoard(board) {
    const b = new Array(10);
    for (let i = 0; i < 10; i++) b[i] = board[i].slice();
    return b;
}

function generateAllMoves(board, color, validateMoveFunc) {
    const moves = [];
    const isRed = color === 'red';
    // Simplified piece list tracking
    const pieces = [];
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (p && (isRed === (p === p.toLowerCase()))) pieces.push({ p, x, y });
        }
    }

    for (const item of pieces) {
        // Narrow the search area based on piece type to speed up
        const type = item.p.toLowerCase();
        let targets = [];
        if (type === 'k' || type === 'a') {
            // King/Advisor only check nearby squares
            for(let dy=-1; dy<=1; dy++) for(let dx=-1; dx<=1; dx++) {
                if(dx===0 && dy===0) continue;
                targets.push({tx: item.x+dx, ty: item.y+dy});
            }
        } else if (type === 'b') {
            // Elephant 
            const ds = [[-2,-2],[-2,2],[2,-2],[2,2]];
            ds.forEach(d => targets.push({tx: item.x+d[0], ty: item.y+d[1]}));
        } else if (type === 'n') {
            // Knight
            const ds = [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]];
            ds.forEach(d => targets.push({tx: item.x+d[0], ty: item.y+d[1]}));
        } else if (type === 'p') {
            // Pawn
            targets.push({tx: item.x, ty: item.y + (isRed ? -1 : 1)});
            targets.push({tx: item.x - 1, ty: item.y});
            targets.push({tx: item.x + 1, ty: item.y});
        } else {
            // Rook/Cannon still need full scan (or complex scan)
            for(let i=0; i<10; i++) targets.push({tx: item.x, ty: i});
            for(let i=0; i<9; i++) targets.push({tx: i, ty: item.y});
        }

        for (const t of targets) {
            if (t.tx < 0 || t.tx > 8 || t.ty < 0 || t.ty > 9) continue;
            if (validateMoveFunc(board, item.p, item.x, item.y, t.tx, t.ty, color)) {
                const target = board[t.ty][t.tx];
                let score = target ? (100 * (PIECE_VALUES[target.toLowerCase()[0]] || 0) - (PIECE_VALUES[type[0]] || 0)) : 0;
                moves.push({ fromX: item.x, fromY: item.y, toX: t.tx, toY: t.ty, piece: item.p, capture: target, score });
            }
        }
    }
    return moves.sort((a,b) => b.score - a.score);
}

function evaluateBoard(board) {
    let score = 0;
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x]; if (!p) continue;
            const r = p === p.toLowerCase(); const t = p.toLowerCase()[0];
            let v = (PIECE_VALUES[t] || 0) + ((PST[t] && PST[t][r ? 9-y : y] && PST[t][r ? 9-y : y][x]) || 0);
            score += r ? v : -v;
        }
    }
    return score;
}

function quiescence(board, alpha, beta, isMax, validateMoveFunc, qdepth, startTime, timeLimit) {
    const standPat = evaluateBoard(board);
    if (isMax) {
        if (standPat >= beta) return beta;
        if (alpha < standPat) alpha = standPat;
        if (qdepth <= 0 || (Date.now() - startTime > timeLimit)) return alpha;
        const moves = generateAllMoves(board, 'red', validateMoveFunc).filter(m => m.capture);
        for (const m of moves) {
            const nb = copyBoard(board); nb[m.toY][m.toX] = m.piece; nb[m.fromY][m.fromX] = null;
            const s = quiescence(nb, alpha, beta, false, validateMoveFunc, qdepth - 1, startTime, timeLimit);
            if (s >= beta) return beta; if (s > alpha) alpha = s;
        }
    } else {
        if (standPat <= alpha) return alpha;
        if (beta > standPat) beta = standPat;
        if (qdepth <= 0 || (Date.now() - startTime > timeLimit)) return beta;
        const moves = generateAllMoves(board, 'black', validateMoveFunc).filter(m => m.capture);
        for (const m of moves) {
            const nb = copyBoard(board); nb[m.toY][m.toX] = m.piece; nb[m.fromY][m.fromX] = null;
            const s = quiescence(nb, alpha, beta, true, validateMoveFunc, qdepth - 1, startTime, timeLimit);
            if (s <= alpha) return alpha; if (s < beta) beta = s;
        }
    }
    return isMax ? alpha : beta;
}

function minimax(board, depth, alpha, beta, isMax, validateMoveFunc, startTime, timeLimit) {
    if (Date.now() - startTime > timeLimit) return isMax ? -30000 : 30000;
    const h = Zobrist.getHash(board, isMax ? 'red' : 'black');
    const tt = TT.get(h);
    if (tt && tt.depth >= depth) {
        if (tt.flag === 0) return tt.val;
        if (tt.flag === 1 && tt.val > alpha) alpha = tt.val;
        if (tt.flag === 2 && tt.val < beta) beta = tt.val;
        if (alpha >= beta) return tt.val;
    }
    if (depth === 0) return quiescence(board, alpha, beta, isMax, validateMoveFunc, 2, startTime, timeLimit);
    const color = isMax ? 'red' : 'black';
    const moves = generateAllMoves(board, color, validateMoveFunc);
    if (moves.length === 0) return isMax ? -20000 : 20000;
    let bVal = isMax ? -Infinity : Infinity;
    let oAlpha = alpha;
    for (const m of moves) {
        const nb = copyBoard(board); nb[m.toY][m.toX] = m.piece; nb[m.fromY][m.fromX] = null;
        const v = minimax(nb, depth - 1, alpha, beta, !isMax, validateMoveFunc, startTime, timeLimit);
        if (isMax) { bVal = Math.max(bVal, v); alpha = Math.max(alpha, v); }
        else { bVal = Math.min(bVal, v); beta = Math.min(beta, v); }
        if (beta <= alpha) break;
    }
    TT.set(h, bVal, depth, bVal <= oAlpha ? 2 : (bVal >= beta ? 1 : 0));
    return bVal;
}

function getBestMove(board, color, level, validateMoveFunc) {
    const isMax = color === 'red';
    const startTime = Date.now();
    const timeLimit = 2000; // 2 second limit
    let finalBestMove = null;
    let maxDepth = level >= 9 ? 6 : (level >= 7 ? 5 : (level >= 5 ? 4 : (level >= 3 ? 3 : 2)));

    for (let d = 1; d <= maxDepth; d++) {
        let bestMove = null; let bestValue = isMax ? -Infinity : Infinity;
        const moves = generateAllMoves(board, color, validateMoveFunc);
        if (moves.length === 0) break;
        for (const m of moves) {
            const nb = copyBoard(board); nb[m.toY][m.toX] = m.piece; nb[m.fromY][m.fromX] = null;
            const v = minimax(nb, d - 1, -Infinity, Infinity, !isMax, validateMoveFunc, startTime, timeLimit);
            if (isMax) { if (v > bestValue) { bestValue = v; bestMove = m; } }
            else { if (v < bestValue) { bestValue = v; bestMove = m; } }
            if (Date.now() - startTime > timeLimit) break;
        }
        if (bestMove && (Date.now() - startTime <= timeLimit || !finalBestMove)) {
            finalBestMove = bestMove;
        } else if (d > 1) break;
    }
    return finalBestMove || generateAllMoves(board, color, validateMoveFunc)[0];
}

if (typeof window !== 'undefined') window.getBestMove = getBestMove;
if (typeof module !== 'undefined') module.exports = { getBestMove };


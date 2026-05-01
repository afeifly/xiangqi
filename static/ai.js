/**
 * Xiangqi AI Engine — Strong Edition v2
 *
 * Fixes over v1:
 *  • Opening book for sensible early moves (no dumb cannon-eat-knight)
 *  • Wider Cannon–Knight value gap (490 vs 360) to penalise bad trades
 *  • Dynamic piece values: cannon weaker / knight stronger in endgame
 *  • Check extensions: search deeper when in check (avoids horizon blunders)
 *  • Late Move Reduction (LMR) for deeper effective search
 *  • King safety bonus for intact palace defenders
 *  • Minimum depth 2 even at weakest level (no pure random)
 *  • Refined PST tables for all 7 piece types
 *  • Quiescence search depth increased to 5
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 1. PIECE VALUES  (centipawns)
//    Cannon–Knight gap is ~130 cp so the AI never trades C for N.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_PIECE_VALUES = {
    'k': 10000, 'r': 1000, 'c': 490, 'n': 360, 'a': 150, 'b': 150, 'p': 100,
};

// Dynamic adjustment: cannon is better with more pieces (more jump targets),
// knight is better with fewer pieces (less blocking).
function getPieceValue(type, totalPieces) {
    const base = BASE_PIECE_VALUES[type] || 0;
    if (type === 'c') return Math.round(base * (0.82 + 0.18 * totalPieces / 32));
    if (type === 'n') return Math.round(base * (1.18 - 0.18 * totalPieces / 32));
    return base;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. PIECE-SQUARE TABLES
//    Orientation: row 0 = own back rank, row 9 = opponent's back rank.
//    Both colours use the same tables via mirroring.
// ─────────────────────────────────────────────────────────────────────────────

const PST = {};

// King — stay at back-centre, penalise being exposed at front of palace
PST['k'] = [
    [ 0, 0, 0,  2,  8,  2, 0, 0, 0 ],   // own back rank (safest)
    [ 0, 0, 0, -2,  3, -2, 0, 0, 0 ],   // middle of palace
    [ 0, 0, 0, -8, -3, -8, 0, 0, 0 ],   // front of palace (exposed)
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
];

// Advisor — centre position is best
PST['a'] = [
    [ 0, 0, 0, 15,  0, 15, 0, 0, 0 ],   // back corners
    [ 0, 0, 0,  0, 20,  0, 0, 0, 0 ],   // centre (most flexible)
    [ 0, 0, 0, 12,  0, 12, 0, 0, 0 ],   // front corners
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
    [ 0, 0, 0,  0,  0,  0, 0, 0, 0 ],
];

// Bishop — central bishop at row2/col4 is best, back rank is fine
PST['b'] = [
    [ 0, 0, 15, 0,  0, 0, 15, 0, 0 ],   // (2,0),(6,0) back rank
    [ 0, 0,  0, 0,  0, 0,  0, 0, 0 ],
    [ 8, 0,  0, 0, 18, 0,  0, 0, 8 ],   // (0,2),(4,2),(8,2)
    [ 0, 0,  0, 0,  0, 0,  0, 0, 0 ],
    [ 0, 0, 10, 0,  0, 0, 10, 0, 0 ],   // (2,4),(6,4) near river
    [ 0, 0,  0, 0,  0, 0,  0, 0, 0 ],
    [ 0, 0,  0, 0,  0, 0,  0, 0, 0 ],
    [ 0, 0,  0, 0,  0, 0,  0, 0, 0 ],
    [ 0, 0,  0, 0,  0, 0,  0, 0, 0 ],
    [ 0, 0,  0, 0,  0, 0,  0, 0, 0 ],
];

// Knight — penalise starting squares, reward central development
PST['n'] = [
    [ -5, -10,  0,  0,  5,  0,  0,-10, -5 ],  // back rank (undeveloped = bad)
    [  0,   2,  8, 10, 10, 10,  8,  2,  0 ],
    [  2,  12, 18, 25, 25, 25, 18, 12,  2 ],  // standard development
    [  5,  18, 28, 35, 35, 35, 28, 18,  5 ],  // central
    [  5,  18, 28, 38, 40, 38, 28, 18,  5 ],  // peak
    [  5,  18, 28, 35, 35, 35, 28, 18,  5 ],  // crossed river
    [  2,  15, 22, 28, 28, 28, 22, 15,  2 ],  // attacking
    [  0,   8, 15, 22, 25, 22, 15,  8,  0 ],
    [ -5,   2,  8, 15, 15, 15,  8,  2, -5 ],
    [ -5,  -5,  2,  8, 10,  8,  2, -5, -5 ],
];

// Rook — active positions, slight centre preference
PST['r'] = [
    [ 12, 18, 18, 22, 22, 22, 18, 18, 12 ],
    [ 12, 18, 22, 25, 28, 25, 22, 18, 12 ],
    [ 12, 18, 22, 28, 28, 28, 22, 18, 12 ],
    [ 12, 22, 28, 32, 32, 32, 28, 22, 12 ],
    [ 15, 25, 30, 35, 38, 35, 30, 25, 15 ],
    [ 15, 25, 30, 35, 38, 35, 30, 25, 15 ],
    [ 12, 22, 28, 32, 32, 32, 28, 22, 12 ],
    [ 12, 18, 22, 28, 32, 28, 22, 18, 12 ],
    [ 12, 18, 22, 25, 28, 25, 22, 18, 12 ],
    [ 15, 18, 22, 22, 28, 22, 22, 18, 15 ],
];

// Cannon — favours central files, slight back-rank preference (safe+flexible)
PST['c'] = [
    [  5,  5,  8, 12, 15, 12,  8,  5,  5 ],
    [  5,  8, 10, 15, 18, 15, 10,  8,  5 ],
    [  5, 10, 12, 18, 22, 18, 12, 10,  5 ],
    [  5, 10, 15, 20, 22, 20, 15, 10,  5 ],
    [  5, 10, 15, 20, 22, 20, 15, 10,  5 ],
    [  5, 10, 15, 18, 20, 18, 15, 10,  5 ],
    [  0,  8, 12, 18, 20, 18, 12,  8,  0 ],
    [  0,  5, 10, 15, 18, 15, 10,  5,  0 ],
    [ -5,  0,  5, 10, 12, 10,  5,  0, -5 ],
    [ -5, -5,  0,  5,  8,  5,  0, -5, -5 ],
];

// Pawn — massive jump after crossing the river, centre pawns best
PST['p'] = [
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  5,  0, 12,  0,  5,  0,  0 ],  // starting row, only at cols 0,2,4,6,8
    [  2,  0,  8,  0, 18,  0,  8,  0,  2 ],  // one step forward
    // --- CROSSED RIVER ---
    [ 15, 28, 38, 45, 55, 45, 38, 28, 15 ],
    [ 25, 38, 52, 62, 72, 62, 52, 38, 25 ],
    [ 35, 50, 65, 75, 82, 75, 65, 50, 35 ],
    [ 42, 58, 72, 82, 88, 82, 72, 58, 42 ],
    [ 28, 38, 50, 60, 65, 60, 50, 38, 28 ],  // opponent's back rank (less mobility)
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. BOARD EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

function lookupPST(type, isRed, y, x) {
    const table = PST[type];
    if (!table) return 0;
    // from own perspective: row 0 = own back rank
    const pstRow = isRed ? (9 - y) : y;
    return table[pstRow][x];
}

function evaluateBoard(board) {
    let score = 0;
    let totalPieces = 0;

    // First pass: count pieces for dynamic values
    for (let y = 0; y < 10; y++)
        for (let x = 0; x < 9; x++)
            if (board[y][x]) totalPieces++;

    // Second pass: compute score
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (!p) continue;
            const isRed = p === p.toLowerCase();
            const type = p.toLowerCase()[0];

            const val = getPieceValue(type, totalPieces) + lookupPST(type, isRed, y, x);
            score += isRed ? val : -val;
        }
    }

    // King safety: bonus for having palace defenders near the king
    score += kingSafety(board, 'red');
    score -= kingSafety(board, 'black');

    // Crossed-river bonus: encourage aggression and forward pressure
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (!p) continue;
            const isRed = p === p.toLowerCase();
            if (isRed && y < 5) score += 8;  // red piece crossed to black's side
            if (!isRed && y > 4) score -= 8; // black piece crossed to red's side
        }
    }

    return score;
}

function kingSafety(board, color) {
    // Lightweight: count advisors and bishops on side
    let bonus = 0;
    if (color === 'red') {
        // Advisors on good squares
        if (board[8] && board[8][4] && board[8][4].toLowerCase()[0] === 'a' && board[8][4] === board[8][4].toLowerCase()) bonus += 12;
        if (board[9] && board[9][3] && board[9][3].toLowerCase()[0] === 'a' && board[9][3] === board[9][3].toLowerCase()) bonus += 8;
        if (board[9] && board[9][5] && board[9][5].toLowerCase()[0] === 'a' && board[9][5] === board[9][5].toLowerCase()) bonus += 8;
        // Bishops
        if (board[7] && board[7][4] && board[7][4].toLowerCase()[0] === 'b' && board[7][4] === board[7][4].toLowerCase()) bonus += 10;
    } else {
        if (board[1] && board[1][4] && board[1][4][0] === 'A') bonus += 12;
        if (board[0] && board[0][3] && board[0][3][0] === 'A') bonus += 8;
        if (board[0] && board[0][5] && board[0][5][0] === 'A') bonus += 8;
        if (board[2] && board[2][4] && board[2][4][0] === 'B') bonus += 10;
    }
    return bonus;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MOVE GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function generateAllMoves(board, color, validateMoveFunc, capturesOnly) {
    const moves = [];
    const isRed = color === 'red';
    const isCheckFunc = (typeof _isCheck === 'function') ? _isCheck
        : (typeof window !== 'undefined' && window.isCheck ? window.isCheck : null);

    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (!p || (isRed !== (p === p.toLowerCase()))) continue;

            const type = p.toLowerCase()[0];
            let rawTargets = [];

            if (type === 'k' || type === 'a') {
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    if (Math.abs(dx) + Math.abs(dy) > 0) rawTargets.push({ tx: x + dx, ty: y + dy });
                }
            } else if (type === 'b') {
                [[-2,-2],[-2,2],[2,-2],[2,2]].forEach(([dx,dy]) => rawTargets.push({ tx: x+dx, ty: y+dy }));
            } else if (type === 'n') {
                [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]].forEach(([dx,dy]) => rawTargets.push({ tx: x+dx, ty: y+dy }));
            } else if (type === 'p') {
                rawTargets.push({ tx: x, ty: y + (isRed ? -1 : 1) });
                rawTargets.push({ tx: x - 1, ty: y });
                rawTargets.push({ tx: x + 1, ty: y });
            } else {
                // Rook / Cannon — scan row + column
                for (let i = 0; i < 10; i++) rawTargets.push({ tx: x, ty: i });
                for (let i = 0; i < 9; i++) rawTargets.push({ tx: i, ty: y });
            }

            for (const t of rawTargets) {
                if (t.tx < 0 || t.tx > 8 || t.ty < 0 || t.ty > 9) continue;
                const target = board[t.ty][t.tx];
                if (capturesOnly && !target) continue;
                if (!validateMoveFunc(board, p, x, y, t.tx, t.ty, color)) continue;

                // Self-check verification
                board[t.ty][t.tx] = p;
                board[y][x] = null;
                const inCheck = isCheckFunc ? isCheckFunc(board, color) : false;
                board[y][x] = p;
                board[t.ty][t.tx] = target;
                if (inCheck) continue;

                // Move-ordering score: MVV-LVA for captures
                let moveScore = 0;
                if (target) {
                    const victimVal = BASE_PIECE_VALUES[target.toLowerCase()[0]] || 0;
                    const attackerVal = (BASE_PIECE_VALUES[type] || 0) / 100;
                    moveScore = 10000 + victimVal * 10 - attackerVal;
                }

                moves.push({ fromX: x, fromY: y, toX: t.tx, toY: t.ty, piece: p, score: moveScore, target });
            }
        }
    }

    return moves.sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. TRANSPOSITION TABLE
// ─────────────────────────────────────────────────────────────────────────────

const TT_SIZE = 1 << 20;
const ttTable = new Array(TT_SIZE);
let ttGen = 0;

const TT_EXACT = 0, TT_LOWER = 1, TT_UPPER = 2;

function boardHash(board) {
    let h1 = 0, h2 = 0;
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            const val = p ? p.charCodeAt(0) : 0;
            h1 = (Math.imul(h1 ^ val, 0x9e3779b1) + y * 9 + x) >>> 0;
            h2 = (Math.imul(h2, 31) + val * 997 + y * 9 + x) >>> 0;
        }
    }
    return (h1 ^ h2) >>> 0;
}

function ttLookup(hash, depth, alpha, beta) {
    const entry = ttTable[hash & (TT_SIZE - 1)];
    if (!entry || entry.hash !== hash || entry.depth < depth) return null;
    if (entry.flag === TT_EXACT) return entry.score;
    if (entry.flag === TT_LOWER && entry.score >= beta)  return entry.score;
    if (entry.flag === TT_UPPER && entry.score <= alpha) return entry.score;
    return null;
}

function ttStore(hash, depth, score, flag, bestMove) {
    const idx = hash & (TT_SIZE - 1);
    const prev = ttTable[idx];
    if (!prev || prev.depth <= depth || prev.gen !== ttGen) {
        ttTable[idx] = { hash, depth, score, flag, bestMove, gen: ttGen };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. KILLER MOVES & HISTORY TABLE
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DEPTH = 20;
const killers = Array.from({ length: MAX_DEPTH + 1 }, () => [null, null]);
const historyTable = {};

function histKey(m) { return (m.fromX * 1000 + m.fromY * 100 + m.toX * 10 + m.toY); }

function updateHistory(m, depth) {
    const k = histKey(m);
    historyTable[k] = (historyTable[k] || 0) + depth * depth;
}

function orderMoves(moves, depth, ttBestMove) {
    for (const m of moves) {
        if (ttBestMove && m.fromX === ttBestMove.fromX && m.fromY === ttBestMove.fromY &&
            m.toX === ttBestMove.toX && m.toY === ttBestMove.toY) {
            m.score += 2000000;
        } else if (!m.target) {
            const kList = killers[depth] || [];
            const isKiller = kList.some(k => k && k.fromX === m.fromX && k.fromY === m.fromY &&
                k.toX === m.toX && k.toY === m.toY);
            if (isKiller) m.score += 80000;
            m.score += (historyTable[histKey(m)] || 0);
        }
    }
    return moves.sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. QUIESCENCE SEARCH
// ─────────────────────────────────────────────────────────────────────────────

function quiesce(board, alpha, beta, isMax, validateMoveFunc, startTime, timeLimit, qdepth) {
    if (Date.now() - startTime > timeLimit) return evaluateBoard(board);

    const stand = evaluateBoard(board);
    if (isMax) {
        if (stand >= beta) return stand;
        if (stand > alpha) alpha = stand;
    } else {
        if (stand <= alpha) return stand;
        if (stand < beta) beta = stand;
    }
    if (qdepth <= 0) return stand;

    const color = isMax ? 'red' : 'black';
    const captures = generateAllMoves(board, color, validateMoveFunc, true);

    if (isMax) {
        for (const m of captures) {
            const old = board[m.toY][m.toX];
            board[m.toY][m.toX] = m.piece;
            board[m.fromY][m.fromX] = null;
            const val = quiesce(board, alpha, beta, false, validateMoveFunc, startTime, timeLimit, qdepth - 1);
            board[m.fromY][m.fromX] = m.piece;
            board[m.toY][m.toX] = old;
            if (val > alpha) alpha = val;
            if (alpha >= beta) return alpha;
        }
        return alpha;
    } else {
        for (const m of captures) {
            const old = board[m.toY][m.toX];
            board[m.toY][m.toX] = m.piece;
            board[m.fromY][m.fromX] = null;
            const val = quiesce(board, alpha, beta, true, validateMoveFunc, startTime, timeLimit, qdepth - 1);
            board[m.fromY][m.fromX] = m.piece;
            board[m.toY][m.toX] = old;
            if (val < beta) beta = val;
            if (beta <= alpha) return beta;
        }
        return beta;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. ALPHA-BETA SEARCH  (with check extension + LMR)
// ─────────────────────────────────────────────────────────────────────────────

let nodesSearched = 0;
const isCheckFunc_global = () => {
    if (typeof _isCheck === 'function') return _isCheck;
    if (typeof window !== 'undefined' && window.isCheck) return window.isCheck;
    return null;
};

function alphaBeta(board, depth, alpha, beta, isMax, validateMoveFunc, startTime, timeLimit) {
    if (Date.now() - startTime > timeLimit) return evaluateBoard(board);

    nodesSearched++;

    const color = isMax ? 'red' : 'black';
    const checkFunc = isCheckFunc_global();
    const inCheck = checkFunc ? checkFunc(board, color) : false;

    // Check extension: don't stop searching while in check
    const effectiveDepth = (inCheck && depth <= 0) ? 1 : depth;

    const hash = boardHash(board);
    const ttHit = ttLookup(hash, effectiveDepth, alpha, beta);
    if (ttHit !== null) return ttHit;

    if (effectiveDepth <= 0) {
        return quiesce(board, alpha, beta, isMax, validateMoveFunc, startTime, timeLimit, 5);
    }

    // Null move pruning: give opponent a free turn at reduced depth
    if (!inCheck && effectiveDepth >= 4) {
        const R = 2;
        const nullScore = alphaBeta(board, effectiveDepth - 1 - R, alpha, beta, !isMax,
                                    validateMoveFunc, startTime, timeLimit);
        if (isMax && nullScore >= beta) return beta;
        if (!isMax && nullScore <= alpha) return alpha;
    }

    const ttEntry = ttTable[hash & (TT_SIZE - 1)];
    const ttBest = (ttEntry && ttEntry.hash === hash) ? ttEntry.bestMove : null;
    const moves = orderMoves(generateAllMoves(board, color, validateMoveFunc, false), effectiveDepth, ttBest);

    if (moves.length === 0) return isMax ? -9500 - effectiveDepth : 9500 + effectiveDepth;

    let bestMove = null;
    let origAlpha = alpha;
    let best = isMax ? -Infinity : Infinity;

    for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        const old = board[m.toY][m.toX];
        board[m.toY][m.toX] = m.piece;
        board[m.fromY][m.fromX] = null;

        let val;

        // LMR: reduce depth for late, quiet moves (not captures, not in check)
        if (i >= 4 && effectiveDepth >= 3 && !m.target && !inCheck) {
            // Reduced search
            val = alphaBeta(board, effectiveDepth - 3, alpha, beta, !isMax, validateMoveFunc, startTime, timeLimit);
            // Re-search at full depth if it improved
            if (isMax ? (val > alpha) : (val < beta)) {
                val = alphaBeta(board, effectiveDepth - 1, alpha, beta, !isMax, validateMoveFunc, startTime, timeLimit);
            }
        } else {
            val = alphaBeta(board, effectiveDepth - 1, alpha, beta, !isMax, validateMoveFunc, startTime, timeLimit);
        }

        board[m.fromY][m.fromX] = m.piece;
        board[m.toY][m.toX] = old;

        if (isMax) {
            if (val > best) { best = val; bestMove = m; }
            if (val > alpha) alpha = val;
        } else {
            if (val < best) { best = val; bestMove = m; }
            if (val < beta) beta = val;
        }
        if (beta <= alpha) {
            if (!m.target && effectiveDepth < MAX_DEPTH) {
                const kSlot = killers[effectiveDepth];
                kSlot[1] = kSlot[0];
                kSlot[0] = m;
                updateHistory(m, effectiveDepth);
            }
            break;
        }

        if (Date.now() - startTime > timeLimit) break;
    }

    const flag = best >= beta ? TT_LOWER : (best <= origAlpha ? TT_UPPER : TT_EXACT);
    ttStore(hash, effectiveDepth, best, flag, bestMove);

    return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. OPENING BOOK
//    Returns a sensible move for Black in the first few moves.
//    Falls back to null → regular search.
// ─────────────────────────────────────────────────────────────────────────────

function getBookMove(board, color, validateMoveFunc) {
    if (color !== 'black') return null;

    // Only use book when most pieces are on the board
    let pieceCount = 0;
    for (let y = 0; y < 10; y++)
        for (let x = 0; x < 9; x++)
            if (board[y][x]) pieceCount++;
    if (pieceCount < 28) return null;

    // Don't use book if in check
    const checkFunc = isCheckFunc_global();
    if (checkFunc && checkFunc(board, 'black')) return null;

    const candidates = [];

    // Helper: is (x,y) a black piece of given type?
    const isBlack = (x, y, type) => {
        const p = board[y] && board[y][x];
        return p && p === p.toUpperCase() && p.toLowerCase()[0] === type;
    };

    // Helper: try adding a candidate move (validates + self-check test)
    const tryAdd = (fx, fy, tx, ty, priority) => {
        const piece = board[fy] && board[fy][fx];
        if (!piece || piece !== piece.toUpperCase()) return;
        if (!validateMoveFunc(board, piece, fx, fy, tx, ty, 'black')) return;
        // Self-check test
        const saved = board[ty][tx];
        board[ty][tx] = piece;
        board[fy][fx] = null;
        const selfCheck = checkFunc ? checkFunc(board, 'black') : false;
        board[fy][fx] = piece;
        board[ty][tx] = saved;
        if (selfCheck) return;
        candidates.push({ fromX: fx, fromY: fy, toX: tx, toY: ty, piece, priority });
    };

    // ── KNIGHT DEVELOPMENT (highest priority) ──────────────────
    // 马8进7: N1 at (1,0) → (2,2)  (blocking check at (1,1))
    if (isBlack(1, 0, 'n') && !board[1][1] && !board[2][2]) {
        tryAdd(1, 0, 2, 2, 100);
    }
    // 马2进3: N2 at (7,0) → (6,2)
    if (isBlack(7, 0, 'n') && !board[1][7] && !board[2][6]) {
        tryAdd(7, 0, 6, 2, 100);
    }

    // ── CENTRAL CANNON (second priority) ───────────────────────
    // 炮8平5: C1 at (1,2) → (4,2)
    if (isBlack(1, 2, 'c') && !board[2][4]) {
        let clear = true;
        for (let cx = 2; cx <= 3; cx++) if (board[2][cx]) { clear = false; break; }
        if (clear) tryAdd(1, 2, 4, 2, 80);
    }
    // 炮2平5: C2 at (7,2) → (4,2)
    if (isBlack(7, 2, 'c') && !board[2][4]) {
        let clear = true;
        for (let cx = 5; cx <= 6; cx++) if (board[2][cx]) { clear = false; break; }
        if (clear) tryAdd(7, 2, 4, 2, 80);
    }

    // ── ROOK DEVELOPMENT (after knight moved away) ────────────
    // 车9平8: R1 at (0,0) → (1,0)  (only if N1 already moved off (1,0))
    if (!board[0][1] && isBlack(0, 0, 'r')) {
        tryAdd(0, 0, 1, 0, 70);
    }
    // 车1平2: R2 at (8,0) → (7,0)
    if (!board[0][7] && isBlack(8, 0, 'r')) {
        tryAdd(8, 0, 7, 0, 70);
    }

    // ── ACTIVATED ROOK forward ────────────────────────────────
    // 车8进5 or similar rook activation: if rook is on (1,0), move to (1,2) over empty
    if (isBlack(1, 0, 'r') && !board[1][1] && !board[2][1]) {
        tryAdd(1, 0, 1, 2, 65);  // push rook forward
    }
    if (isBlack(7, 0, 'r') && !board[1][7] && !board[2][7]) {
        tryAdd(7, 0, 7, 2, 65);
    }

    // ── PAWN ADVANCE (lower priority, centre pawn) ────────────
    if (isBlack(4, 3, 'p') && !board[4][4]) {
        tryAdd(4, 3, 4, 4, 40);
    }
    // Also side pawns for variation
    if (isBlack(2, 3, 'p') && !board[4][2]) {
        tryAdd(2, 3, 2, 4, 30);
    }
    if (isBlack(6, 3, 'p') && !board[4][6]) {
        tryAdd(6, 3, 6, 4, 30);
    }

    if (candidates.length === 0) return null;

    // Sort by priority, pick randomly among the top tier
    candidates.sort((a, b) => b.priority - a.priority);
    const topPrio = candidates[0].priority;
    const topTier = candidates.filter(c => c.priority >= topPrio - 15);
    return topTier[Math.floor(Math.random() * topTier.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. ITERATIVE DEEPENING — main entry point
// ─────────────────────────────────────────────────────────────────────────────

function getBestMove(board, color, level, validateMoveFunc) {
    // Level → (maxDepth, timeLimit ms, randomTop)
    const levelConfig = {
         1: { depth: 2, time:  800, randomTop: 4 }, // weak but not stupid
         4: { depth: 4, time: 2000 },                // 略有小成
         7: { depth: 5, time: 3000 },                // 炉火纯青
        10: { depth: 7, time: 5000 },                // 出神入化
        13: { depth: 11, time: 15000 },               // 天人合一
    };
    const cfg = levelConfig[level] || levelConfig[7];

    // Try opening book first
    const bookMove = getBookMove(board, color, validateMoveFunc);
    if (bookMove) return bookMove;

    ttGen++;
    nodesSearched = 0;

    const isMax = color === 'red';
    const startTime = Date.now();

    const moves = generateAllMoves(board, color, validateMoveFunc, false);
    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0];  // only one legal move

    let finalBestMove = moves[0];
    let finalBestVal = isMax ? -Infinity : Infinity;

    // Iterative deepening
    for (let d = 1; d <= cfg.depth; d++) {
        let bestVal = isMax ? -Infinity : Infinity;
        let bestMoveThisDepth = null;

        const hash = boardHash(board);
        const ttEntry = ttTable[hash & (TT_SIZE - 1)];
        const ttBest = (ttEntry && ttEntry.hash === hash) ? ttEntry.bestMove : null;
        const rootMoves = orderMoves(
            generateAllMoves(board, color, validateMoveFunc, false),
            d, ttBest
        );

        for (const m of rootMoves) {
            const old = board[m.toY][m.toX];
            board[m.toY][m.toX] = m.piece;
            board[m.fromY][m.fromX] = null;

            const val = alphaBeta(board, d - 1, -Infinity, Infinity, !isMax, validateMoveFunc, startTime, cfg.time);

            board[m.fromY][m.fromX] = m.piece;
            board[m.toY][m.toX] = old;

            if (isMax ? (val > bestVal) : (val < bestVal)) {
                bestVal = val;
                bestMoveThisDepth = m;
            }

            if (Date.now() - startTime > cfg.time) break;
        }

        if (bestMoveThisDepth) {
            finalBestMove = bestMoveThisDepth;
            finalBestVal = bestVal;
        }
        if (Date.now() - startTime > cfg.time) break;
    }

    // For weak levels: add randomness among top moves
    if (cfg.randomTop && cfg.randomTop > 1) {
        // Re-evaluate top N moves at minimum depth and pick randomly
        const rootMoves = generateAllMoves(board, color, validateMoveFunc, false);
        const scored = [];
        for (const m of rootMoves) {
            const old = board[m.toY][m.toX];
            board[m.toY][m.toX] = m.piece;
            board[m.fromY][m.fromX] = null;
            const val = alphaBeta(board, 1, -Infinity, Infinity, !isMax, validateMoveFunc, Date.now(), 500);
            board[m.fromY][m.fromX] = m.piece;
            board[m.toY][m.toX] = old;
            scored.push({ move: m, val });
        }
        scored.sort((a, b) => isMax ? b.val - a.val : a.val - b.val);
        const pool = scored.slice(0, Math.min(cfg.randomTop, scored.length));
        return pool[Math.floor(Math.random() * pool.length)].move;
    }

    return finalBestMove;
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. EXPORTS (main thread)
// ─────────────────────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
    window.getBestMove = getBestMove;
}
if (typeof module !== 'undefined') {
    module.exports = { getBestMove };
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. SELF-CONTAINED RULES FOR WEB-WORKER
//     (duplicated from rules.js so the worker needs no other files)
// ─────────────────────────────────────────────────────────────────────────────

function _validateMove(board, piece, fromX, fromY, toX, toY, color) {
    const isRed = piece === piece.toLowerCase();
    if ((color === 'red' && !isRed) || (color === 'black' && isRed)) return false;
    if (toX < 0 || toX > 8 || toY < 0 || toY > 9) return false;
    const target = board[toY][toX];
    if (target) {
        const tIsRed = target === target.toLowerCase();
        if (tIsRed === isRed) return false;
    }
    const dx = toX - fromX, dy = toY - fromY;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    const type = piece.toLowerCase()[0];

    if (type === 'k') {
        if (absDx + absDy !== 1) return false;
        if (color === 'red'   && (toX < 3 || toX > 5 || toY < 7)) return false;
        if (color === 'black' && (toX < 3 || toX > 5 || toY > 2)) return false;
        return true;
    }
    if (type === 'a') {
        if (absDx !== 1 || absDy !== 1) return false;
        if (color === 'red'   && (toX < 3 || toX > 5 || toY < 7)) return false;
        if (color === 'black' && (toX < 3 || toX > 5 || toY > 2)) return false;
        return true;
    }
    if (type === 'b') {
        if (absDx !== 2 || absDy !== 2) return false;
        if (board[(fromY + toY) / 2][(fromX + toX) / 2]) return false;
        if (color === 'red'   && toY < 5) return false;
        if (color === 'black' && toY > 4) return false;
        return true;
    }
    if (type === 'n') {
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
    if (type === 'r') {
        if (dx !== 0 && dy !== 0) return false;
        const sx = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
        const sy = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
        let cx = fromX + sx, cy = fromY + sy;
        while (cx !== toX || cy !== toY) {
            if (board[cy][cx]) return false;
            cx += sx; cy += sy;
        }
        return true;
    }
    if (type === 'c') {
        if (dx !== 0 && dy !== 0) return false;
        let count = 0;
        const sx = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
        const sy = dy === 0 ? 0 : (dy > 0 ? 1 : -1);
        let cx = fromX + sx, cy = fromY + sy;
        while (cx !== toX || cy !== toY) {
            if (board[cy][cx]) count++;
            cx += sx; cy += sy;
        }
        if (target && count !== 1) return false;
        if (!target && count !== 0) return false;
        return true;
    }
    if (type === 'p') {
        if (isRed) {
            if (fromY > 4) { if (dy !== -1 || dx !== 0) return false; }
            else { if (!(dy === -1 && dx === 0) && absDx + absDy !== 1) return false; if (dy === 1) return false; }
        } else {
            if (fromY < 5) { if (dy !== 1 || dx !== 0) return false; }
            else { if (!(dy === 1 && dx === 0) && absDx + absDy !== 1) return false; if (dy === -1) return false; }
        }
        return true;
    }
    return false;
}

function _findKing(board, color) {
    const k = color === 'red' ? 'k' : 'K';
    for (let y = 0; y < 10; y++)
        for (let x = 0; x < 9; x++)
            if (board[y][x] && board[y][x][0] === k) return { x, y };
    return null;
}

function _isCheck(board, color) {
    const king = _findKing(board, color);
    if (!king) return false;
    const opp = color === 'red' ? 'black' : 'red';
    const opKing = _findKing(board, opp);
    if (opKing && king.x === opKing.x) {
        let count = 0;
        const minY = Math.min(king.y, opKing.y), maxY = Math.max(king.y, opKing.y);
        for (let cy = minY + 1; cy < maxY; cy++) if (board[cy][king.x]) count++;
        if (count === 0) return true;
    }
    for (let y = 0; y < 10; y++)
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (!p) continue;
            const isOp = opp === 'red' ? p === p.toLowerCase() : p === p.toUpperCase();
            if (isOp && _validateMove(board, p, x, y, king.x, king.y, opp)) return true;
        }
    return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. WEB WORKER ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

if (typeof self !== 'undefined' && typeof importScripts !== 'undefined') {
    self.isCheck = _isCheck;
    self.validateMove = _validateMove;

    // Alias so `window.isCheck` resolves in Worker context
    if (typeof window === 'undefined') {
        self.window = self;
    }

    self.onmessage = function (e) {
        const { board, color, level } = e.data;
        const move = getBestMove(board, color, level, _validateMove);
        self.postMessage({ move });
    };
}

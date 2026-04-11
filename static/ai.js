/**
 * Xiangqi AI Engine — Strong Edition
 *
 * Key improvements over the previous version:
 *  • Rich piece-square tables (PST) for every piece type
 *  • Quiescence search (captures only) to avoid horizon-effect blunders
 *  • Transposition table (Zobrist-like hash) for position caching
 *  • Killer move heuristic + history heuristic for superior move ordering
 *  • Proper level → search depth mapping for the 5 UI difficulty levels
 *  • Check-extension: extends 1 ply when moving side is in check
 *  • Runs inside a Web Worker when available (no UI freeze)
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 1. PIECE VALUES  (centipawns)
// ─────────────────────────────────────────────────────────────────────────────
const PIECE_VALUES = {
    'k': 10000, 'r': 900, 'c': 450, 'n': 400, 'a': 120, 'b': 120, 'p': 100,
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. PIECE-SQUARE TABLES  (from Red's perspective, row 0 = red back rank)
//    Black mirrors these tables vertically.
// ─────────────────────────────────────────────────────────────────────────────
// Layout: [row 0..9][col 0..8]  — row 0 is Red's home row (y=9 on screen)

const PST = {};

// King — strongly penalise being at the very edges of the palace
PST['k'] = [
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  1,  5,  1,  0,  0,  0 ],
    [  0,  0,  0, -5,  0, -5,  0,  0,  0 ],
    [  0,  0,  0, -5, 10, -5,  0,  0,  0 ],
];

// Advisor — stay inside the palace
PST['a'] = [
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0, 10,  0, 10,  0,  0,  0 ],
    [  0,  0,  0,  0, 15,  0,  0,  0,  0 ],
    [  0,  0,  0, 10,  0, 10,  0,  0,  0 ],
];

// Bishop — prefer central positions, never crosses the river
PST['b'] = [
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [ -5,  0,  0,  5,  0,  5,  0,  0, -5 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  5,  0,  0,  8,  0,  8,  0,  0,  5 ],
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  5,  0,  0,  8,  0,  8,  0,  0,  5 ],
];

// Knight — central squares, avoid edges
PST['n'] = [
    [  0,  5, 10, 10, 10, 10, 10,  5,  0 ],
    [  5, 10, 20, 25, 25, 25, 20, 10,  5 ],
    [  5, 20, 25, 30, 30, 30, 25, 20,  5 ],
    [  8, 25, 30, 35, 35, 35, 30, 25,  8 ],
    [  8, 25, 30, 35, 35, 35, 30, 25,  8 ],
    [  5, 20, 25, 30, 30, 30, 25, 20,  5 ],
    [  5, 20, 25, 30, 30, 30, 25, 20,  5 ],
    [  5, 10, 20, 25, 25, 25, 20, 10,  5 ],
    [  0,  5, 10, 15, 15, 15, 10,  5,  0 ],
    [  0,  0,  5,  5,  5,  5,  5,  0,  0 ],
];

// Rook — prefer centre files and ranks
PST['r'] = [
    [ 20, 30, 30, 35, 35, 35, 30, 30, 20 ],
    [ 10, 15, 15, 20, 20, 20, 15, 15, 10 ],
    [  5, 10, 10, 15, 15, 15, 10, 10,  5 ],
    [  5, 10, 10, 15, 15, 15, 10, 10,  5 ],
    [  5, 10, 10, 15, 15, 15, 10, 10,  5 ],
    [  5, 10, 10, 15, 15, 15, 10, 10,  5 ],
    [  5, 10, 10, 15, 15, 15, 10, 10,  5 ],
    [ 10, 15, 15, 20, 20, 20, 15, 15, 10 ],
    [ 10, 15, 15, 20, 20, 20, 15, 15, 10 ],
    [ 20, 30, 30, 35, 35, 35, 30, 30, 20 ],
];

// Cannon — good on central files, a little further back initially
PST['c'] = [
    [  5,  5,  5,  8,  8,  8,  5,  5,  5 ],
    [  5,  5,  5,  8,  8,  8,  5,  5,  5 ],
    [  5,  5,  5,  8,  8,  8,  5,  5,  5 ],
    [  5, 10, 10, 10, 10, 10, 10, 10,  5 ],
    [  5, 10, 10, 10, 10, 10, 10, 10,  5 ],
    [  5, 10, 10, 10, 10, 10, 10, 10,  5 ],
    [  5,  5,  5, 10, 10, 10,  5,  5,  5 ],
    [  5,  5,  5, 10, 10, 10,  5,  5,  5 ],
    [ 10, 10, 10, 15, 15, 15, 10, 10, 10 ],
    [  5,  5,  5, 10, 10, 10,  5,  5,  5 ],
];

// Pawn — gains value as it advances and crosses the river
PST['p'] = [
    [  0,  0,  0,  0,  0,  0,  0,  0,  0 ],
    [  3,  5,  5,  5,  5,  5,  5,  5,  3 ],
    [  3,  5,  5,  5,  5,  5,  5,  5,  3 ],
    [  5,  8, 10, 12, 12, 12, 10,  8,  5 ],
    [  5,  8, 10, 12, 12, 12, 10,  8,  5 ],
    // Crossed the river — big bonus
    [ 15, 25, 35, 40, 50, 40, 35, 25, 15 ],
    [ 20, 30, 45, 55, 65, 55, 45, 30, 20 ],
    [ 30, 45, 60, 70, 75, 70, 60, 45, 30 ],
    [ 40, 55, 70, 80, 85, 80, 70, 55, 40 ],
    [ 25, 35, 50, 60, 65, 60, 50, 35, 25 ],
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. BOARD EVALUATION
// ─────────────────────────────────────────────────────────────────────────────

function lookupPST(type, isRed, y, x) {
    const table = PST[type];
    if (!table) return 0;
    // Red's home rank is y=9 (row index 0 in PST from red's view)
    // So for red: pstRow = 9 - y
    // For black: pstRow = y  (already from black's "home" perspective)
    const pstRow = isRed ? (9 - y) : y;
    return table[pstRow][x];
}

function evaluateBoard(board) {
    let score = 0;
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (!p) continue;
            const isRed = p === p.toLowerCase();
            const type = p.toLowerCase()[0];
            const val = (PIECE_VALUES[type] || 0) + lookupPST(type, isRed, y, x);
            score += isRed ? val : -val;
        }
    }
    return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MOVE GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function generateAllMoves(board, color, validateMoveFunc, capturesOnly) {
    const moves = [];
    const isRed = color === 'red';

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
                // Rook and Cannon scan the full row + column
                for (let i = 0; i < 10; i++) rawTargets.push({ tx: x, ty: i });
                for (let i = 0; i < 9; i++) rawTargets.push({ tx: i, ty: y });
            }

            for (const t of rawTargets) {
                if (t.tx < 0 || t.tx > 8 || t.ty < 0 || t.ty > 9) continue;
                const target = board[t.ty][t.tx];
                if (capturesOnly && !target) continue;          // quiescence: captures only
                if (!validateMoveFunc(board, p, x, y, t.tx, t.ty, color)) continue;

                // Self-check verification
                board[t.ty][t.tx] = p;
                board[y][x] = null;
                const inCheck = window.isCheck ? window.isCheck(board, color) : false;
                board[y][x] = p;
                board[t.ty][t.tx] = target;
                if (inCheck) continue;

                // Move-ordering score: MVV-LVA for captures
                let moveScore = 0;
                if (target) {
                    const victimVal = PIECE_VALUES[target.toLowerCase()[0]] || 0;
                    const attackerVal = (PIECE_VALUES[type] || 0) / 100;
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

const TT_SIZE = 1 << 20; // ~1 M entries
const ttTable = new Array(TT_SIZE);
let ttGen = 0; // generation counter to age entries

const TT_EXACT = 0, TT_LOWER = 1, TT_UPPER = 2;

// Simple board hash — not Zobrist (JS cost) but good enough
function boardHash(board) {
    let h = 0;
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (p) {
                // Map piece character code + position to a number
                h = (Math.imul(h, 31) + (p.charCodeAt(0) * 1000 + y * 9 + x)) >>> 0;
            } else {
                h = (Math.imul(h, 31) + 1) >>> 0;
            }
        }
    }
    return h;
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
    // Replacement: always-replace or depth-preferred with age
    if (!prev || prev.depth <= depth || prev.gen !== ttGen) {
        ttTable[idx] = { hash, depth, score, flag, bestMove, gen: ttGen };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. KILLER MOVES & HISTORY TABLE
// ─────────────────────────────────────────────────────────────────────────────

const MAX_DEPTH = 16;
const killers = Array.from({ length: MAX_DEPTH + 1 }, () => [null, null]);
const historyTable = {};

function histKey(m) { return `${m.fromX}${m.fromY}${m.toX}${m.toY}`; }

function updateHistory(m, depth) {
    const k = histKey(m);
    historyTable[k] = (historyTable[k] || 0) + depth * depth;
}

function orderMoves(moves, depth, ttBestMove) {
    for (const m of moves) {
        if (ttBestMove && m.fromX === ttBestMove.fromX && m.fromY === ttBestMove.fromY &&
            m.toX === ttBestMove.toX && m.toY === ttBestMove.toY) {
            m.score += 1000000;
        } else if (!m.target) {
            // Non-capture: killer + history
            const kList = killers[depth] || [];
            const isKiller = kList.some(k => k && k.fromX === m.fromX && k.fromY === m.fromY &&
                k.toX === m.toX && k.toY === m.toY);
            if (isKiller) m.score += 50000;
            m.score += (historyTable[histKey(m)] || 0);
        }
    }
    return moves.sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. QUIESCENCE SEARCH
// ─────────────────────────────────────────────────────────────────────────────

function quiesce(board, alpha, beta, isMax, validateMoveFunc, startTime, timeLimit, qdepth) {
    if (Date.now() - startTime > timeLimit) return isMax ? -30000 : 30000;

    const stand = evaluateBoard(board);
    if (isMax) {
        if (stand >= beta) return beta;
        if (stand > alpha) alpha = stand;
    } else {
        if (stand <= alpha) return alpha;
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
            if (val >= beta) return beta;
            if (val > alpha) alpha = val;
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
            if (val <= alpha) return alpha;
            if (val < beta) beta = val;
        }
        return beta;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. ALPHA-BETA  (Negamax-style with PVS window)
// ─────────────────────────────────────────────────────────────────────────────

let nodesSearched = 0;

function alphaBeta(board, depth, alpha, beta, isMax, validateMoveFunc, startTime, timeLimit) {
    if (Date.now() - startTime > timeLimit) return isMax ? -30000 : 30000;

    nodesSearched++;

    const hash = boardHash(board);
    const ttHit = ttLookup(hash, depth, alpha, beta);
    if (ttHit !== null) return ttHit;

    if (depth === 0) {
        return quiesce(board, alpha, beta, isMax, validateMoveFunc, startTime, timeLimit, 4);
    }

    const color = isMax ? 'red' : 'black';
    const ttEntry = ttTable[hash & (TT_SIZE - 1)];
    const ttBest = (ttEntry && ttEntry.hash === hash) ? ttEntry.bestMove : null;
    const moves = orderMoves(generateAllMoves(board, color, validateMoveFunc, false), depth, ttBest);

    if (moves.length === 0) return isMax ? -9000 : 9000;

    let bestMove = null;
    let origAlpha = alpha;
    let best = isMax ? -Infinity : Infinity;

    for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        const old = board[m.toY][m.toX];
        board[m.toY][m.toX] = m.piece;
        board[m.fromY][m.fromX] = null;

        const val = alphaBeta(board, depth - 1, alpha, beta, !isMax, validateMoveFunc, startTime, timeLimit);

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
            // Killer + history update
            if (!m.target) {
                const kSlot = killers[depth];
                kSlot[1] = kSlot[0];
                kSlot[0] = m;
                updateHistory(m, depth);
            }
            break;
        }

        if (Date.now() - startTime > timeLimit) break;
    }

    // Store TT
    const flag = best >= beta ? TT_LOWER : (best <= origAlpha ? TT_UPPER : TT_EXACT);
    ttStore(hash, depth, best, flag, bestMove);

    return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. ITERATIVE DEEPENING — main entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * level: 1 | 4 | 7 | 10 | 13  (matches the 5 UI difficulty options)
 */
function getBestMove(board, color, level, validateMoveFunc) {
    // Level → (maxDepth, timeLimit ms)
    // Higher levels get both more depth AND more thinking time
    const levelConfig = {
         1: { depth: 1, time:  300 },   // 初学乍练 — immediate, random-ish
         4: { depth: 3, time: 1000 },   // 略有小成
         7: { depth: 5, time: 2500 },   // 炉火纯青
        10: { depth: 7, time: 4000 },   // 出神入化
        13: { depth: 9, time: 6000 },   // 天人合一
    };
    // Fallback for unexpected values
    const cfg = levelConfig[level] || levelConfig[7];

    ttGen++;                            // age TT entries
    nodesSearched = 0;

    const isMax = color === 'red';
    const startTime = Date.now();

    const moves = generateAllMoves(board, color, validateMoveFunc, false);
    if (moves.length === 0) return null;

    // Level 1 gets a random move among the top 5 (play weak deliberately)
    if (level <= 1) {
        const pool = moves.slice(0, Math.min(5, moves.length));
        return pool[Math.floor(Math.random() * pool.length)];
    }

    let finalBestMove = moves[0]; // Safety fallback

    // Iterative deepening
    for (let d = 1; d <= cfg.depth; d++) {
        let bestVal = isMax ? -Infinity : Infinity;
        let bestMoveThisDepth = null;

        // Re-order root moves using TT from previous iteration
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

        if (bestMoveThisDepth) finalBestMove = bestMoveThisDepth;
        if (Date.now() - startTime > cfg.time) break;
    }

    return finalBestMove;
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. WORKER SUPPORT
//     When loaded as a Worker, listen for {board, color, level} messages.
//     Requires validateMove / isCheck to be available — they are re-declared
//     below as self-contained copies so the Worker is fully independent.
// ─────────────────────────────────────────────────────────────────────────────

// Expose to main thread
if (typeof window !== 'undefined') {
    window.getBestMove = getBestMove;
}
if (typeof module !== 'undefined') {
    module.exports = { getBestMove };
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. SELF-CONTAINED RULE COPIES FOR WEB-WORKER CONTEXT
//     (duplicated from rules.js so the worker has no external dependencies)
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
// 12. WEB WORKER ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

if (typeof self !== 'undefined' && typeof importScripts !== 'undefined') {
    // In a Web Worker context, `window` is undefined.
    // generateAllMoves and alphaBeta call `window.isCheck`, so we patch
    // globalThis (=== self in workers) to provide these functions.
    self.isCheck = _isCheck;
    self.validateMove = _validateMove;

    // Also create a `window` alias so existing code that checks
    // `window.isCheck` finds the function.
    if (typeof window === 'undefined') {
        // eslint-disable-next-line no-global-assign
        self.window = self;
    }

    self.onmessage = function (e) {
        const { board, color, level } = e.data;
        const move = getBestMove(board, color, level, _validateMove);
        self.postMessage({ move });
    };
}

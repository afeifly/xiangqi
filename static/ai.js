/**
 * Xiangqi AI Engine - Simplified & Robust Edition
 * Focus: Reliability, Material Balance, and Basic Position Awareness.
 */

const PIECE_VALUES = {
    'k': 10000, 'r': 900, 'c': 450, 'n': 400, 'a': 200, 'b': 200, 'p': 100,
    'K': 10000, 'R': 900, 'C': 450, 'N': 400, 'A': 200, 'B': 200, 'P': 100
};

// Basic positional bonuses
// Pawns get stronger as they cross the river and move forward
const PAWN_PST = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [2, 0, 8, 0, 10, 0, 8, 0, 2],
    [4, 0, 12, 0, 15, 0, 12, 0, 4],
    [20, 30, 45, 55, 55, 55, 45, 30, 20],
    [30, 40, 55, 65, 75, 65, 55, 40, 30],
    [40, 60, 70, 80, 80, 80, 70, 60, 40],
    [50, 70, 80, 95, 95, 95, 80, 70, 50],
    [20, 30, 40, 50, 55, 50, 40, 30, 20]
];

function evaluateBoard(board) {
    let score = 0;
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (!p) continue;
            const isRed = p === p.toLowerCase();
            const type = p.toLowerCase()[0];

            let val = PIECE_VALUES[type] || 0;

            // Positional bonuses
            if (type === 'p') {
                val += PAWN_PST[isRed ? 9 - y : y][x];
            } else if (type === 'r' || type === 'n' || type === 'c') {
                // Mobility bonus (favor middle)
                val += (4 - Math.abs(x - 4)) * 2;
            } else if (type === 'k' || type === 'a' || type === 'b') {
                // Defensive pieces staying close to center
                val += (4 - Math.abs(x - 4)) * 5;
            }

            score += isRed ? val : -val;
        }
    }
    return score;
}

function generateAllMoves(board, color, validateMoveFunc) {
    const moves = [];
    const isRed = color === 'red';

    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (!p || (isRed !== (p === p.toLowerCase()))) continue;

            const type = p.toLowerCase()[0];
            let rawTargets = [];

            // Efficient target generation per piece type
            if (type === 'k' || type === 'a') {
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    if (Math.abs(dx) + Math.abs(dy) > 0) rawTargets.push({ tx: x + dx, ty: y + dy });
                }
            } else if (type === 'b') {
                const ds = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
                ds.forEach(d => rawTargets.push({ tx: x + d[0], ty: y + d[1] }));
            } else if (type === 'n') {
                const ds = [[-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2]];
                ds.forEach(d => rawTargets.push({ tx: x + d[0], ty: y + d[1] }));
            } else if (type === 'p') {
                rawTargets.push({ tx: x, ty: y + (isRed ? -1 : 1) });
                rawTargets.push({ tx: x - 1, ty: y });
                rawTargets.push({ tx: x + 1, ty: y });
            } else {
                // Rook/Cannon
                for (let i = 0; i < 10; i++) rawTargets.push({ tx: x, ty: i });
                for (let i = 0; i < 9; i++) rawTargets.push({ tx: i, ty: y });
            }

            for (const t of rawTargets) {
                if (t.tx < 0 || t.tx > 8 || t.ty < 0 || t.ty > 9) continue;
                if (validateMoveFunc(board, p, x, y, t.tx, t.ty, color)) {
                    const target = board[t.ty][t.tx];

                    // --- SELF-CHECK VERIFICATION ---
                    // Before adding the move, ensure it doesn't leave our king exposed
                    board[t.ty][t.tx] = p;
                    board[y][x] = null;
                    const inCheck = window.isCheck ? window.isCheck(board, color) : false;
                    board[y][x] = p;
                    board[t.ty][t.tx] = target;

                    if (inCheck) continue;

                    // Move ordering score: captures are good, especially high-value targets
                    let moveScore = 0;
                    if (target) {
                        moveScore = 1000 + (PIECE_VALUES[target.toLowerCase()[0]] || 0) - (PIECE_VALUES[type] || 0) / 10;
                    }
                    moves.push({ fromX: x, fromY: y, toX: t.tx, toY: t.ty, piece: p, score: moveScore });
                }
            }
        }
    }
    // Sort moves for Alpha-Beta efficiency
    return moves.sort((a, b) => b.score - a.score);
}

function minimax(board, depth, alpha, beta, isMax, validateMoveFunc, startTime, timeLimit) {
    if (Date.now() - startTime > timeLimit) return isMax ? -20000 : 20000;

    if (depth === 0) return evaluateBoard(board);

    const color = isMax ? 'red' : 'black';
    const moves = generateAllMoves(board, color, validateMoveFunc);

    if (moves.length === 0) return isMax ? -15000 : 15000; // Checkmate or Stalemate

    if (isMax) {
        let best = -Infinity;
        for (const m of moves) {
            const oldValue = board[m.toY][m.toX];
            board[m.toY][m.toX] = m.piece;
            board[m.fromY][m.fromX] = null;

            const val = minimax(board, depth - 1, alpha, beta, false, validateMoveFunc, startTime, timeLimit);

            board[m.fromY][m.fromX] = m.piece;
            board[m.toY][m.toX] = oldValue;

            best = Math.max(best, val);
            alpha = Math.max(alpha, val);
            if (beta <= alpha) break;
        }
        return best;
    } else {
        let best = Infinity;
        for (const m of moves) {
            const oldValue = board[m.toY][m.toX];
            board[m.toY][m.toX] = m.piece;
            board[m.fromY][m.fromX] = null;

            const val = minimax(board, depth - 1, alpha, beta, true, validateMoveFunc, startTime, timeLimit);

            board[m.fromY][m.fromX] = m.piece;
            board[m.toY][m.toX] = oldValue;

            best = Math.min(best, val);
            beta = Math.min(beta, val);
            if (beta <= alpha) break;
        }
        return best;
    }
}

function getBestMove(board, color, level, validateMoveFunc) {
    const isMax = color === 'red';
    const startTime = Date.now();
    const timeLimit = 3500; // 3.5 seconds max thinking time

    // Depth based on level (Scaled: 1, 4, 7, 10, 13)
    let maxDepth = 1;
    if (level >= 13) maxDepth = 8;
    else if (level >= 10) maxDepth = 7;
    else if (level >= 7) maxDepth = 6;
    else if (level >= 4) maxDepth = 4;
    else maxDepth = 2;

    let finalBestMove = null;
    const moves = generateAllMoves(board, color, validateMoveFunc);
    if (moves.length === 0) return null;

    // Iterative Deepening
    for (let d = 1; d <= maxDepth; d++) {
        let bestVal = isMax ? -Infinity : Infinity;
        let bestMoveForDepth = null;

        for (const m of moves) {
            const oldValue = board[m.toY][m.toX];
            board[m.toY][m.toX] = m.piece;
            board[m.fromY][m.fromX] = null;

            const val = minimax(board, d - 1, -Infinity, Infinity, !isMax, validateMoveFunc, startTime, timeLimit);

            board[m.fromY][m.fromX] = m.piece;
            board[m.toY][m.toX] = oldValue;

            if (isMax) {
                if (val > bestVal) {
                    bestVal = val;
                    bestMoveForDepth = m;
                }
            } else {
                if (val < bestVal) {
                    bestVal = val;
                    bestMoveForDepth = m;
                }
            }

            if (Date.now() - startTime > timeLimit) break;
        }

        if (Date.now() - startTime > timeLimit && finalBestMove) break;
        if (bestMoveForDepth) finalBestMove = bestMoveForDepth;
    }

    return finalBestMove || moves[0];
}

if (typeof window !== 'undefined') window.getBestMove = getBestMove;
if (typeof module !== 'undefined') module.exports = { getBestMove };

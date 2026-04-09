/**
 * Xiangqi AI Engine (Browser Compatible)
 * Implementation: Minimax with Alpha-Beta Pruning
 */

const PIECE_VALUES = {
    'k': 10000, 'r': 100, 'c': 45, 'n': 40, 'a': 20, 'b': 20, 'p': 10,
    'K': 10000, 'R': 100, 'C': 45, 'N': 40, 'A': 20, 'B': 20, 'P': 10
};

/**
 * Returns all possible moves for a given color
 */
function generateAllMoves(board, color, validateMoveFunc) {
    const moves = [];
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const piece = board[y][x];
            if (!piece) continue;
            const isRed = piece === piece.toLowerCase();
            if ((color === 'red' && isRed) || (color === 'black' && !isRed)) {
                // Try moving this piece to every possible square
                for (let ty = 0; ty < 10; ty++) {
                    for (let tx = 0; tx < 9; tx++) {
                        if (validateMoveFunc(board, piece, x, y, tx, ty, color)) {
                            moves.push({ fromX: x, fromY: y, toX: tx, toY: ty, piece });
                        }
                    }
                }
            }
        }
    }
    return moves;
}

/**
 * Evaluates the board state. Positive = Red advantage, Negative = Black advantage.
 */
function evaluateBoard(board) {
    let score = 0;
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const piece = board[y][x];
            if (!piece) continue;
            const type = piece.toLowerCase()[0];
            const val = PIECE_VALUES[type] || 0;
            if (piece === piece.toLowerCase()) {
                score += val;
                if (type === 'p' && y < 5) score += 5; 
            } else {
                score -= val;
                if (type === 'p' && y > 4) score -= 5;
            }
        }
    }
    return score;
}

/**
 * Minimax with Alpha-Beta Pruning
 */
function minimax(board, depth, alpha, beta, isMaximizing, validateMoveFunc) {
    if (depth === 0) return evaluateBoard(board);

    const color = isMaximizing ? 'red' : 'black';
    const moves = generateAllMoves(board, color, validateMoveFunc);

    if (moves.length === 0) return isMaximizing ? -9999 : 9999; 

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const nextBoard = board.map(row => [...row]);
            nextBoard[move.toY][move.toX] = move.piece;
            nextBoard[move.fromY][move.fromX] = null;
            
            const evaluation = minimax(nextBoard, depth - 1, alpha, beta, false, validateMoveFunc);
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const nextBoard = board.map(row => [...row]);
            nextBoard[move.toY][move.toX] = move.piece;
            nextBoard[move.fromY][move.fromX] = null;

            const evaluation = minimax(nextBoard, depth - 1, alpha, beta, true, validateMoveFunc);
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function getBestMove(board, color, level, validateMoveFunc) {
    const isMaximizing = color === 'red';
    const moves = generateAllMoves(board, color, validateMoveFunc);
    
    moves.sort(() => Math.random() - 0.5);

    let bestMove = null;
    let bestValue = isMaximizing ? -Infinity : Infinity;

    // Use the actual values passed from UI (1, 3, 5, 7, 9) or legacy (1..5)
    let depth = 1;
    if (level >= 3) depth = 2;
    if (level >= 5) depth = 3;
    if (level >= 9) depth = 4;

    for (const move of moves) {
        const nextBoard = board.map(row => [...row]);
        nextBoard[move.toY][move.toX] = move.piece;
        nextBoard[move.fromY][move.fromX] = null;

        const val = minimax(nextBoard, depth - 1, -Infinity, Infinity, !isMaximizing, validateMoveFunc);

        if (isMaximizing) {
            if (val > bestValue) {
                bestValue = val;
                bestMove = move;
            }
        } else {
            if (val < bestValue) {
                bestValue = val;
                bestMove = move;
            }
        }
    }
    return bestMove;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getBestMove };
} else {
    window.getBestMove = getBestMove;
}

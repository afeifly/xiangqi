
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
    var opKing = findKing(board, opponent);

    // --- 王不见王规则校验 (Flying General Rule) ---
    if (opKing && king.x === opKing.x) {
        let count = 0;
        const startY = Math.min(king.y, opKing.y);
        const endY = Math.max(king.y, opKing.y);
        for (let checkY = startY + 1; checkY < endY; checkY++) {
            if (board[checkY][king.x]) count++;
        }
        if (count === 0) return true; // 中间无子，被对方将领“狙杀”
    }

    // 传统子力将军判定
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

function hasAnyLegalMoves(board, color) {
    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const piece = board[y][x];
            if (!piece) continue;
            const isRed = piece === piece.toLowerCase();
            if ((color === 'red' && isRed) || (color === 'black' && !isRed)) {
                // 扫描 10x9 棋盘看是否有任意落点合法且不导致自杀
                for (let ty = 0; ty < 10; ty++) {
                    for (let tx = 0; tx < 9; tx++) {
                        if (validateMove(board, piece, x, y, tx, ty, color)) {
                            // 模拟走棋，确保护主 (包含王不见王判定)
                            const nextBoard = JSON.parse(JSON.stringify(board));
                            nextBoard[ty][tx] = piece;
                            nextBoard[y][x] = null;
                            if (!isCheck(nextBoard, color)) return true;
                        }
                    }
                }
            }
        }
    }
    return false;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validateMove, isCheck, evaluateBoardDetailed, hasAnyLegalMoves };
}

// 已合并至 findKing

// 详细评估引擎 (独立血条机制：越扣越少)
function evaluateBoardDetailed(board) {
    const PIECE_VALS = {
        'k': 1000, 'r': 900, 'c': 450, 'n': 400, 'a': 200, 'b': 200, 'p': 100
    };

    // Total material for one side: 900*2 + 450*2 + 400*2 + 200*2 + 200*2 + 100*5 + 1000 = 5800
    const FULL_SIDE_VAL = 5800;

    let red = 0, black = 0;

    for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 9; x++) {
            const p = board[y][x];
            if (!p) continue;

            const isRed = p === p.toLowerCase();
            const type = p.toLowerCase()[0];
            let val = PIECE_VALS[type] || 0;

            if (isRed) red += val;
            else black += val;
        }
    }

    return {
        red: Math.max(0, Math.min(100, Math.round((red / FULL_SIDE_VAL) * 100))),
        black: Math.max(0, Math.min(100, Math.round((black / FULL_SIDE_VAL) * 100)))
    };
}

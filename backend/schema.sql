-- 简化版：不用登录

-- 房间表
CREATE TABLE rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code VARCHAR(6) UNIQUE NOT NULL,
    room_name VARCHAR(100),       -- 房间名称 (如: 白虎节堂)
    red_player VARCHAR(100),      -- 红方session/id
    black_player VARCHAR(100),   -- 黑方session/id
    red_name VARCHAR(100),       -- 红方昵称
    black_name VARCHAR(100),     -- 黑方昵称
    status VARCHAR(20) DEFAULT 'waiting',  -- waiting, picking, playing, finished
    current_turn VARCHAR(10) DEFAULT 'red',
    winner VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 棋谱表
CREATE TABLE moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER REFERENCES rooms(id),
    move_number INTEGER NOT NULL,
    piece VARCHAR(10) NOT NULL,   -- 如 "r1", "n2", "k", "p1" 等
    from_x INTEGER,
    from_y INTEGER,
    to_x INTEGER,
    to_y INTEGER,
    captured VARCHAR(10),
    move_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

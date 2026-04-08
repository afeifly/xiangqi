FROM node:20-bullseye

WORKDIR /app

# Copy package files and install dependencies
# We use node:20-bullseye which already includes build tools (python, g++, make)
# necessary for compiling native modules like better-sqlite3.
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy backend source and static frontend files
COPY backend/*.js ./backend/
COPY backend/*.sql ./backend/
COPY static/ ./static/

# The SQLite database is stored in a volume for persistence.
# DB_PATH env allows the app to locate the db in the mounted volume.
ENV DB_PATH=/data/xiangqi.db

EXPOSE 3000

CMD ["node", "backend/server.js"]

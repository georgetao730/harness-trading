#!/bin/bash
set -e

# ────────────────────────────────────────────
#  Harness Trading — 一键启动脚本
#  One command to rule them all
# ────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

banner() {
  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║       Harness Trading · 一键启动              ║${NC}"
  echo -e "${CYAN}║       AI 操盘手 + 安全护栏                     ║${NC}"
  echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
  echo ""
}

check_cmd() {
  if ! command -v "$1" &> /dev/null; then
    echo -e "${RED}✗ 缺少依赖: $1 — 请先安装${NC}"
    MISSING=true
  else
    echo -e "${GREEN}✓${NC} $1 $($1 --version 2>&1 | head -1 | cut -d' ' -f2-)"
  fi
}

banner

# ── 1. 环境检测 ──
echo -e "${YELLOW}[1/4] 环境检测...${NC}"
MISSING=false

echo -n "  "
check_cmd python3

echo -n "  "
check_cmd node

echo -n "  "
check_cmd npm

if [ "$MISSING" = true ]; then
  echo ""
  echo -e "${RED}环境检测未通过，请安装缺失依赖后重新运行。${NC}"
  echo "  macOS:  brew install python@3.12 node"
  echo "  Ubuntu: sudo apt install python3.12 nodejs npm"
  exit 1
fi

# Python 版本检查
PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
if [ "$PY_MAJOR" -lt 3 ] || ([ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 11 ]); then
  echo -e "${RED}需要 Python 3.12+，当前版本: $PY_VER${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Python $PY_VER"

# Node 版本检查
NODE_VER=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo -e "${RED}需要 Node 18+，当前版本: $NODE_VER${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Node $NODE_VER"

echo ""

# ── 2. .env 检测 ──
echo -e "${YELLOW}[2/4] 配置检查...${NC}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo -e "  ${YELLOW}已创建 .env，请编辑填入 LLM API Key${NC}"
  echo ""
  echo -e "  推荐 DeepSeek（便宜好用）："
  echo -e "  ${CYAN}  echo 'DEEPSEEK_API_KEY=sk-your-key' >> .env${NC}"
  echo ""
  echo -e "  或者按 Ctrl+C 退出，手动编辑 .env 后再运行"
  echo ""
  read -p "  按 Enter 继续（跳过 LLM 配置，对话功能不可用）... " -r
else
  echo -e "  ${GREEN}✓${NC} .env 已存在"
fi

# Auto-seed demo trading data (on startup)
AUTO_SEED="${AUTO_SEED:-1}"
echo ""

# ── 3. 安装依赖 ──
echo -e "${YELLOW}[3/4] 安装依赖...${NC}"

echo -n "  Python 依赖..."
pip install -r backend/requirements.txt -q 2>/dev/null
echo -e " ${GREEN}✓${NC}"

echo -n "  Node 依赖..."
cd frontend && npm install --silent 2>/dev/null && cd ..
echo -e " ${GREEN}✓${NC}"

echo ""

# ── 4. 启动服务 ──
echo -e "${YELLOW}[4/4] 启动服务...${NC}"

# 清理旧进程
lsof -ti :18766 | xargs kill 2>/dev/null || true
lsof -ti :3000  | xargs kill 2>/dev/null || true
sleep 1

# 启动后端
echo -n "  启动后端 (port 18766)..."
cd backend
nohup python3 -m uvicorn app.main:app --host 0.0.0.0 --port 18766 --reload > /tmp/harness-backend.log 2>&1 &
BACKEND_PID=$!
cd ..
sleep 3

# 等待后端就绪
for i in $(seq 1 10); do
  if curl -s http://127.0.0.1:18766/api/agent/mode > /dev/null 2>&1; then
    echo -e " ${GREEN}✓${NC} (PID: $BACKEND_PID)"
    break
  fi
  sleep 1
done

# 启动前端
echo -n "  启动前端 (port 3000)..."
cd frontend
nohup npx next dev --webpack -p 3000 > /tmp/harness-frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..
sleep 4

# 等待前端就绪
for i in $(seq 1 15); do
  if curl -s http://127.0.0.1:3000 > /dev/null 2>&1; then
    echo -e " ${GREEN}✓${NC} (PID: $FRONTEND_PID)"
    break
  fi
  sleep 1
done

# Auto-seed demo data
if [ "$AUTO_SEED" = "1" ]; then
  sleep 2
  curl -s -X POST http://127.0.0.1:18766/api/trading/seed > /dev/null 2>&1 || true
fi

echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✓ Harness Trading 启动成功！${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo -e "  前端:  ${CYAN}http://localhost:3000${NC}"
echo -e "  后端:  ${CYAN}http://localhost:18766${NC}"
echo -e "  API文档: ${CYAN}http://localhost:18766/docs${NC}"
echo ""
echo -e "  ${YELLOW}停止服务: kill $BACKEND_PID $FRONTEND_PID${NC}"
echo -e "  ${YELLOW}查看后端日志: tail -f /tmp/harness-backend.log${NC}"
echo ""

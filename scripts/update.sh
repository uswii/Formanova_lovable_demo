#!/bin/bash

# =============================================================================
# FormaNova Frontend - Update Script (Pull & Rebuild)
# =============================================================================
# Run this to pull latest code and rebuild:
#   ./scripts/update.sh
# =============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get absolute path to project
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$PROJECT_DIR/scripts"

echo ""
echo -e "${BLUE}=============================================="
echo "  FormaNova Frontend - Update & Rebuild"
echo -e "==============================================${NC}"
echo ""
echo "Project directory: $PROJECT_DIR"
echo ""

cd "$PROJECT_DIR" || exit 1

# =============================================================================
# Step 1: Stop the service
# =============================================================================
echo -e "${YELLOW}[1/6] Stopping service...${NC}"

if [ -f "$SCRIPTS_DIR/stop.sh" ]; then
    "$SCRIPTS_DIR/stop.sh" 2>/dev/null || true
else
    sudo systemctl stop formanova.service 2>/dev/null || true
    pm2 stop formanova 2>/dev/null || true
fi
echo -e "${GREEN}✓ Service stopped${NC}"

# =============================================================================
# Step 2: Stash local changes (if any)
# =============================================================================
echo -e "${YELLOW}[2/6] Checking for local changes...${NC}"

if git diff --quiet 2>/dev/null; then
    echo -e "${GREEN}✓ No local changes${NC}"
else
    echo "  Stashing local changes..."
    git stash push -m "Auto-stash before update $(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✓ Local changes stashed${NC}"
fi

# =============================================================================
# Step 3: Pull latest code
# =============================================================================
echo -e "${YELLOW}[3/6] Pulling latest code...${NC}"

git fetch origin
CURRENT_BRANCH=$(git branch --show-current)
git checkout "$CURRENT_BRANCH"
git pull origin "$CURRENT_BRANCH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Code updated from origin/$CURRENT_BRANCH${NC}"
else
    echo -e "${RED}✗ Git pull failed${NC}"
    exit 1
fi

# =============================================================================
# Step 4: Install dependencies
# =============================================================================
echo -e "${YELLOW}[4/6] Installing dependencies...${NC}"

if command -v bun &> /dev/null; then
    bun install
elif command -v npm &> /dev/null; then
    npm install --legacy-peer-deps
else
    echo -e "${RED}✗ Neither bun nor npm found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Dependencies installed${NC}"

# =============================================================================
# Step 5: Build the project
# =============================================================================
echo -e "${YELLOW}[5/6] Building project...${NC}"

if command -v bun &> /dev/null; then
    bun run build
elif command -v npm &> /dev/null; then
    npm run build
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build completed${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# =============================================================================
# Step 6: Start the service
# =============================================================================
echo -e "${YELLOW}[6/6] Starting service...${NC}"

if [ -f "$SCRIPTS_DIR/start.sh" ]; then
    "$SCRIPTS_DIR/start.sh"
else
    sudo systemctl start formanova.service 2>/dev/null || pm2 start formanova 2>/dev/null
fi

echo ""
echo -e "${GREEN}=============================================="
echo "  Update Complete!"
echo -e "==============================================${NC}"
echo ""
echo "  Run './scripts/status.sh' to verify"
echo ""

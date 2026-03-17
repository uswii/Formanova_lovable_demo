#!/bin/bash

# =============================================================================
# FormaNova Frontend - Restart Script (Build + Restart Service)
# =============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="$PROJECT_DIR/scripts"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}=============================================="
echo "  FormaNova Frontend - Restart"
echo -e "==============================================${NC}"
echo ""

cd "$PROJECT_DIR" || exit 1

# =============================================================================
# Step 1: Stop the service
# =============================================================================
echo -e "${YELLOW}[1/3] Stopping service...${NC}"
"$SCRIPTS_DIR/stop.sh"
echo ""

# =============================================================================
# Step 2: Build
# =============================================================================
echo -e "${YELLOW}[2/3] Building project...${NC}"

if command -v bun &> /dev/null; then
    bun run build
elif command -v npm &> /dev/null; then
    npm run build
else
    echo -e "${RED}✗ Neither bun nor npm found${NC}"
    exit 1
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# =============================================================================
# Step 3: Start the service
# =============================================================================
echo -e "${YELLOW}[3/3] Starting service...${NC}"
"$SCRIPTS_DIR/start.sh"

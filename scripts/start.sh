#!/bin/bash

# =============================================================================
# FormaNova Frontend - Start Script (with Fallbacks)
# =============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$PROJECT_DIR/.formanova-config"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Load config
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
    # Defaults
    SERVICE_NAME="formanova"
    PORT=8010
    LOG_DIR="$PROJECT_DIR/logs"
    USE_SYSTEMD=false
    USE_PM2=false
fi

echo ""
echo -e "${YELLOW}Starting FormaNova...${NC}"

# Try systemd first
if [ "$USE_SYSTEMD" = true ] || command -v systemctl &> /dev/null; then
    if sudo systemctl list-unit-files 2>/dev/null | grep -q "${SERVICE_NAME}.service"; then
        sudo systemctl start ${SERVICE_NAME}.service
        sleep 2
        if sudo systemctl is-active --quiet ${SERVICE_NAME}.service; then
            echo -e "${GREEN}✓ Started via systemd${NC}"
            echo ""
            echo -e "URL: ${GREEN}http://0.0.0.0:$PORT${NC}"
            echo -e "     ${GREEN}http://$(hostname -I 2>/dev/null | awk '{print $1}'):$PORT${NC}"
            echo ""
            echo -e "Logs: ${YELLOW}tail -f $LOG_DIR/formanova.log${NC}"
            exit 0
        fi
    fi
fi

# Try PM2
if command -v pm2 &> /dev/null || [ -f "$PROJECT_DIR/node_modules/.bin/pm2" ]; then
    PM2_CMD="pm2"
    if ! command -v pm2 &> /dev/null; then
        PM2_CMD="$PROJECT_DIR/node_modules/.bin/pm2"
    fi
    
    if [ -f "$PROJECT_DIR/ecosystem.config.js" ]; then
        cd "$PROJECT_DIR"
        $PM2_CMD start ecosystem.config.js 2>/dev/null
        $PM2_CMD save 2>/dev/null || true
        echo -e "${GREEN}✓ Started via PM2${NC}"
        echo ""
        echo -e "URL: ${GREEN}http://0.0.0.0:$PORT${NC}"
        echo ""
        echo -e "Logs: ${YELLOW}$PM2_CMD logs $SERVICE_NAME${NC}"
        exit 0
    fi
fi

# Fallback: Direct serve
SERVE_PATH=$(which serve 2>/dev/null || echo "$PROJECT_DIR/node_modules/.bin/serve")
if [ -f "$SERVE_PATH" ] || command -v serve &> /dev/null; then
    echo -e "${YELLOW}Starting in foreground mode...${NC}"
    echo -e "Press Ctrl+C to stop"
    echo ""
    cd "$PROJECT_DIR"
    $SERVE_PATH -s dist -l tcp://0.0.0.0:$PORT
else
    echo -e "${RED}Error: No way to start the server.${NC}"
    echo "Run setup.sh first: ./scripts/setup.sh"
    exit 1
fi

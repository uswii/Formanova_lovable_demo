#!/bin/bash

# =============================================================================
# FormaNova Frontend - View Logs
# =============================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="$PROJECT_DIR/.formanova-config"

# Load config
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
else
    LOG_DIR="$PROJECT_DIR/logs"
    SERVICE_NAME="formanova"
fi

# Colors
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${BLUE}FormaNova Logs${NC}"
echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
echo ""

# Check PM2 first (has nice live logs)
if command -v pm2 &> /dev/null; then
    if pm2 list 2>/dev/null | grep -q "$SERVICE_NAME"; then
        pm2 logs $SERVICE_NAME
        exit 0
    fi
fi

# Fallback to file logs
if [ -f "$LOG_DIR/formanova.log" ]; then
    tail -f "$LOG_DIR/formanova.log"
elif command -v journalctl &> /dev/null; then
    sudo journalctl -u ${SERVICE_NAME}.service -f
else
    echo "No logs found. Is the service running?"
    echo "Check: ./scripts/status.sh"
fi

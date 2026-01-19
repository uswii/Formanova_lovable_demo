#!/bin/bash

# =============================================================================
# FormaNova Frontend - Status Script
# =============================================================================
# Shows the status of FormaNova frontend service
# =============================================================================

SERVICE_NAME="formanova"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$PROJECT_DIR/logs"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}=============================================="
echo "  FormaNova Frontend Status"
echo -e "==============================================${NC}"
echo ""

# Check if service exists
if ! sudo systemctl list-unit-files | grep -q "${SERVICE_NAME}.service"; then
    echo -e "${RED}Service not installed. Run setup.sh first.${NC}"
    exit 1
fi

# Service status
if sudo systemctl is-active --quiet ${SERVICE_NAME}.service; then
    echo -e "Service:    ${GREEN}● Running${NC}"
else
    echo -e "Service:    ${RED}○ Stopped${NC}"
fi

# Enabled status
if sudo systemctl is-enabled --quiet ${SERVICE_NAME}.service; then
    echo -e "Auto-start: ${GREEN}Enabled${NC}"
else
    echo -e "Auto-start: ${YELLOW}Disabled${NC}"
fi

# URLs
echo ""
echo -e "URL:        ${GREEN}http://0.0.0.0:4173${NC}"
echo -e "            ${GREEN}http://$(hostname -I | awk '{print $1}'):4173${NC}"

# Log files
echo ""
echo -e "Logs:       ${YELLOW}$LOG_DIR/formanova.log${NC}"
echo -e "Errors:     ${YELLOW}$LOG_DIR/formanova-error.log${NC}"

# Recent log entries
echo ""
echo -e "${BLUE}Recent logs:${NC}"
if [ -f "$LOG_DIR/formanova.log" ]; then
    tail -5 "$LOG_DIR/formanova.log" 2>/dev/null || echo "  (no logs yet)"
else
    echo "  (no logs yet)"
fi

echo ""

#!/bin/bash

# =============================================================================
# FormaNova Frontend - Restart Script
# =============================================================================
# Restarts the FormaNova frontend service
# =============================================================================

SERVICE_NAME="formanova"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${YELLOW}Restarting FormaNova service...${NC}"

# Check if service exists
if ! sudo systemctl list-unit-files | grep -q "${SERVICE_NAME}.service"; then
    echo -e "${RED}Error: Service not found. Run setup.sh first:${NC}"
    echo "  chmod +x scripts/setup.sh && ./scripts/setup.sh"
    exit 1
fi

# Restart the service
sudo systemctl restart ${SERVICE_NAME}.service

# Wait a moment
sleep 2

# Check status
if sudo systemctl is-active --quiet ${SERVICE_NAME}.service; then
    echo -e "${GREEN}✓ FormaNova restarted${NC}"
    echo ""
    echo -e "URL: ${GREEN}http://0.0.0.0:4173${NC}"
    echo -e "     ${GREEN}http://$(hostname -I | awk '{print $1}'):4173${NC}"
else
    echo -e "${RED}✗ Failed to restart. Check logs:${NC}"
    echo "  sudo journalctl -u ${SERVICE_NAME}.service -n 50"
    exit 1
fi

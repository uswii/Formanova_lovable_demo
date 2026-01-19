#!/bin/bash

# =============================================================================
# FormaNova Frontend - Stop Script
# =============================================================================
# Stops the FormaNova frontend service
# =============================================================================

SERVICE_NAME="formanova"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${YELLOW}Stopping FormaNova service...${NC}"

# Check if service exists
if ! sudo systemctl list-unit-files | grep -q "${SERVICE_NAME}.service"; then
    echo -e "${RED}Error: Service not found.${NC}"
    exit 1
fi

# Stop the service
sudo systemctl stop ${SERVICE_NAME}.service

# Check status
if sudo systemctl is-active --quiet ${SERVICE_NAME}.service; then
    echo -e "${RED}✗ Service is still running${NC}"
    exit 1
else
    echo -e "${GREEN}✓ FormaNova stopped${NC}"
fi

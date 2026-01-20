#!/bin/bash

# =============================================================================
# FormaNova Backend - Local Development Script
# =============================================================================
# 
# Two modes available:
#   1. TEMPORAL MODE (default): Runs Temporal worker + API gateway
#      - Requires: docker-compose up temporal temporal-web postgres
#      - Provides: Workflow orchestration, retries, visibility UI
#   
#   2. STANDALONE MODE: Runs the A100 API server directly
#      - No Temporal dependency
#      - Direct pipeline execution on A100 GPU
#      - Good for development/testing without Temporal infrastructure
#
# Usage:
#   ./run_local.sh              # Temporal mode (default)
#   ./run_local.sh temporal     # Temporal mode (explicit)
#   ./run_local.sh standalone   # Standalone A100 API server mode
#   ./run_local.sh stop         # Stop all running services
#
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$PROJECT_DIR/.backend.pids"

# =============================================================================
# Helper Functions
# =============================================================================

# Find Python command (python3 or python)
find_python() {
    if command -v python3 &> /dev/null; then
        echo "python3"
    elif command -v python &> /dev/null; then
        echo "python"
    else
        echo -e "${RED}Error: Python not found. Install python3.${NC}"
        exit 1
    fi
}

PYTHON_CMD=$(find_python)

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  FormaNova Backend - $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

stop_services() {
    echo -e "${YELLOW}Stopping running services...${NC}"
    
    if [ -f "$PID_FILE" ]; then
        while read -r pid; do
            if kill -0 "$pid" 2>/dev/null; then
                echo "  Stopping PID $pid..."
                kill "$pid" 2>/dev/null || true
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
        echo -e "${GREEN}✓ Services stopped${NC}"
    else
        echo "  No PID file found, checking for processes..."
        # Kill any lingering Python processes for our services
        pkill -f "src.worker" 2>/dev/null || true
        pkill -f "src.api_gateway" 2>/dev/null || true
        pkill -f "api_server.py" 2>/dev/null || true
        echo -e "${GREEN}✓ Cleanup complete${NC}"
    fi
}

check_env() {
    if [ ! -f "$PROJECT_DIR/.env" ]; then
        if [ -f "$PROJECT_DIR/.env.example" ]; then
            echo -e "${YELLOW}Creating .env from .env.example...${NC}"
            cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
            echo -e "${RED}⚠️  Please edit .env with your credentials before running!${NC}"
            exit 1
        else
            echo -e "${RED}Error: No .env or .env.example found${NC}"
            exit 1
        fi
    fi
    
    # Load environment variables
    export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
}

# =============================================================================
# Temporal Mode
# =============================================================================

run_temporal_mode() {
    print_header "Temporal Mode"
    
    check_env
    
    # Check if Temporal is reachable
    TEMPORAL_HOST="${TEMPORAL_ADDRESS:-localhost:7233}"
    echo -e "${YELLOW}Checking Temporal at $TEMPORAL_HOST...${NC}"
    
    # Install dependencies
    echo "Installing Python dependencies..."
    $PYTHON_CMD -m pip install -r "$PROJECT_DIR/requirements.txt" -q
    
    # Clear old PIDs
    rm -f "$PID_FILE"
    
    # Start worker
    echo ""
    echo -e "${YELLOW}Starting Temporal Worker...${NC}"
    cd "$PROJECT_DIR"
    $PYTHON_CMD -m src.worker &
    WORKER_PID=$!
    echo "$WORKER_PID" >> "$PID_FILE"
    
    sleep 2
    
    # Start API Gateway
    echo -e "${YELLOW}Starting API Gateway...${NC}"
    $PYTHON_CMD -m src.api_gateway &
    API_PID=$!
    echo "$API_PID" >> "$PID_FILE"
    
    sleep 2
    
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  TEMPORAL MODE RUNNING${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Worker PID:    ${BLUE}$WORKER_PID${NC}"
    echo -e "  API PID:       ${BLUE}$API_PID${NC}"
    echo ""
    echo -e "  API Gateway:   ${GREEN}http://localhost:${API_PORT:-8001}${NC}"
    echo -e "  Health Check:  ${GREEN}http://localhost:${API_PORT:-8001}/health${NC}"
    echo -e "  Temporal UI:   ${GREEN}http://localhost:8088${NC}"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    
    # Cleanup on exit
    trap 'stop_services' EXIT
    
    # Wait for processes
    wait
}

# =============================================================================
# Standalone Mode (A100 API Server)
# =============================================================================

run_standalone_mode() {
    print_header "Standalone Mode (A100 API Server)"
    
    API_SERVER="$PROJECT_DIR/../server/api_server.py"
    
    if [ ! -f "$API_SERVER" ]; then
        echo -e "${RED}Error: api_server.py not found at $API_SERVER${NC}"
        echo "Expected location: server/api_server.py (relative to project root)"
        exit 1
    fi
    
    # Check for .env in server directory or project root
    SERVER_DIR="$(dirname "$API_SERVER")"
    if [ -f "$SERVER_DIR/.env" ]; then
        export $(cat "$SERVER_DIR/.env" | grep -v '^#' | xargs)
    elif [ -f "$PROJECT_DIR/.env" ]; then
        export $(cat "$PROJECT_DIR/.env" | grep -v '^#' | xargs)
    fi
    
    # Clear old PIDs
    rm -f "$PID_FILE"
    
    echo -e "${YELLOW}Starting A100 API Server...${NC}"
    echo ""
    
    # Run the API server
    cd "$SERVER_DIR"
    $PYTHON_CMD api_server.py &
    API_PID=$!
    echo "$API_PID" >> "$PID_FILE"
    
    sleep 3
    
    # Check if started successfully
    if ! kill -0 "$API_PID" 2>/dev/null; then
        echo -e "${RED}Error: API server failed to start${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  STANDALONE MODE RUNNING${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  API PID:       ${BLUE}$API_PID${NC}"
    echo ""
    echo -e "  API Server:    ${GREEN}http://localhost:8000${NC}"
    echo -e "  Health Check:  ${GREEN}http://localhost:8000/health${NC}"
    echo -e "  Examples:      ${GREEN}http://localhost:8000/examples${NC}"
    echo ""
    echo -e "  ${YELLOW}Endpoints:${NC}"
    echo -e "    POST /segment       - Segment jewelry from image"
    echo -e "    POST /refine-mask   - Refine mask with brush strokes"
    echo -e "    POST /generate      - Generate photoshoot images"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    
    # Cleanup on exit
    trap 'stop_services' EXIT
    
    # Wait for process
    wait
}

# =============================================================================
# Main Entry Point
# =============================================================================

case "${1:-temporal}" in
    temporal|t)
        run_temporal_mode
        ;;
    standalone|s|direct|a100)
        run_standalone_mode
        ;;
    stop)
        stop_services
        ;;
    help|--help|-h)
        echo ""
        echo "FormaNova Backend - Local Development Script"
        echo ""
        echo "Usage:"
        echo "  ./run_local.sh [mode]"
        echo ""
        echo "Modes:"
        echo "  temporal    Run with Temporal workflow orchestration (default)"
        echo "  standalone  Run A100 API server directly without Temporal"
        echo "  stop        Stop all running backend services"
        echo "  help        Show this help message"
        echo ""
        echo "Aliases:"
        echo "  temporal:   t"
        echo "  standalone: s, direct, a100"
        echo ""
        ;;
    *)
        echo -e "${RED}Unknown mode: $1${NC}"
        echo "Use './run_local.sh help' for usage information"
        exit 1
        ;;
esac

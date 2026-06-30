#!/bin/bash
# Startup script for Pothole Detection System

echo "🚀 Starting Pothole Detection & Hazard-Aware Navigation System"
echo "======================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if MongoDB is running
echo -n "Checking MongoDB... "
if mongosh --eval "db.version()" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo -e "${YELLOW}Warning: MongoDB might not be running. Starting in-memory mode...${NC}"
    echo "Run 'mongod' in another terminal to use persistent database"
fi

echo ""
echo "Starting Backend..."
echo "======================================================================"

# Navigate to backend
cd backend

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    source venv/Scripts/activate
else
    source venv/bin/activate
fi

# Install/update dependencies
echo "Installing Python dependencies..."
pip install -q -r requirements.txt

# Check if YOLOv8 model exists
if [ ! -f "models/best.pt" ]; then
    echo -e "${YELLOW}⚠️  YOLOv8 model not found at backend/models/best.pt${NC}"
    echo "Download from: https://docs.ultralytics.com/modes/predict/"
    echo "Place the model as 'best.pt' in backend/models/ directory"
    echo ""
fi

# Start Flask server
echo -e "${GREEN}Starting Flask API server...${NC}"
python app.py &
BACKEND_PID=$!

echo ""
echo "Starting Frontend..."
echo "======================================================================"

# Navigate to frontend (parent directory)
cd ..

# Install npm dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# Start Vite dev server
echo -e "${GREEN}Starting Vite development server...${NC}"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "======================================================================"
echo -e "${GREEN}✓ System startup complete!${NC}"
echo ""
echo "Frontend: http://localhost:5173"
echo "Backend API: http://localhost:5000/api"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID

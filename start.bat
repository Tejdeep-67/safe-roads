@echo off
REM Startup script for Pothole Detection System on Windows

echo.
echo Pothole Detection - Hazard-Aware Navigation System
echo =====================================================
echo.

REM Check Python version
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python not found. Please install Python 3.9+
    pause
    exit /b 1
)

REM Check Node.js version
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js not found. Please install Node.js 16+
    pause
    exit /b 1
)

REM Start Backend
echo.
echo Starting Backend Server...
echo.
cd backend

REM Create venv if it doesn't exist
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate venv
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing Python dependencies...
pip install -q -r requirements.txt

REM Check for YOLOv8 model
if not exist "models\best.pt" (
    echo.
    echo WARNING: YOLOv8 model not found at backend/models/best.pt
    echo Download from: https://docs.ultralytics.com/modes/predict/
    echo Place the model as 'best.pt' in backend/models/ directory
    echo.
)

REM Start Flask
echo Starting Flask API server on http://localhost:5000...
start python app.py
timeout /t 2

REM Navigate to frontend
cd ..

REM Install npm dependencies if needed
if not exist "node_modules" (
    echo Installing npm dependencies...
    call npm install
)

REM Start Vite
echo.
echo Starting Vite development server on http://localhost:5173...
echo.
call npm run dev

pause

@echo off
echo Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python is not installed or not in PATH
    pause
    exit /b 1
)

echo Checking required packages...
pip install waitress >nul 2>&1

echo.
echo Starting Clinic Patient Management System...

start /B python wsgi.py
timeout /t 3 /nobreak > nul
start http://localhost:8080 
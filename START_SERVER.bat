@echo off
echo ========================================
echo   OurShow Local Server Launcher
echo ========================================
echo.
echo Starting local server...
echo.
echo Your site will open at: http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

cd /d "%~dp0"
start http://localhost:8000
python -m http.server 8000

pause

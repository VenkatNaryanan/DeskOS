@echo off
title WhatsApp Lead Engine Launcher
echo ============================================================
echo Starting Autonomous Multilingual Voice & WhatsApp Lead Engine
echo ============================================================

echo Launching Backend (FastAPI on Port 8000)...
start "WhatsApp Lead Engine - Backend" cmd /k "%~dp0start_backend.bat"

timeout /t 3 /nobreak >nul

echo Launching Frontend (Next.js on Port 3000)...
start "WhatsApp Lead Engine - Frontend" cmd /k "%~dp0start_frontend.bat"

echo.
echo Both servers are booting up!
echo   - Backend:  http://localhost:8000
echo   - Frontend: http://localhost:3000
echo   - API Docs: http://localhost:8000/docs
echo.
timeout /t 2 >nul
exit

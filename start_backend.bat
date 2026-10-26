@echo off
title WhatsApp Lead Engine - Backend
echo Starting FastAPI Backend on http://localhost:8000 ...
cd /d "%~dp0backend"
call venv\Scripts\activate.bat
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause

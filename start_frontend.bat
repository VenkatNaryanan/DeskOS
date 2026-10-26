@echo off
title WhatsApp Lead Engine - Frontend Desk
echo Starting Next.js Live Support Desk on http://localhost:3000 ...
set "PATH=C:\Users\Home\nodejs;%PATH%"
cd /d "%~dp0frontend"
npm run dev
pause

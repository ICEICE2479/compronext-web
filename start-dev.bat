@echo off
title ComproNext Next.js Server
set "DEPS=C:\Users\x2001\.gemini\antigravity\bin"
set "PATH=%DEPS%;%PATH%"
cd /d "%~dp0"
echo Starting ComproNext on http://localhost:3000 ...
start http://localhost:3000
call pnpm dev

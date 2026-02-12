@echo off
title ToneAnalyzer
cd /d "%~dp0"
start "" http://localhost:5173
npx vite

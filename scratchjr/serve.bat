@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
    echo Node.js was not found. Install Node.js, then run this file again.
    exit /b 1
)

if not exist "node_modules\" (
    echo Dependencies are not installed. Connect once and run: npm install
    exit /b 1
)

echo Starting the offline ScratchJr web server...
node server\offline.js

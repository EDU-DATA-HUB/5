@echo off
setlocal
cd /d "%~dp0"
echo Opening the knowledge graph browser...
python graph_browser\server.py
endlocal

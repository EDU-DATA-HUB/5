@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
  echo Python 3 is not on PATH. Install Python 3, then run this file again.
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Creating .venv ...
  python -m venv .venv
  if errorlevel 1 exit /b 1
)

echo Installing packages into .venv ...
".venv\Scripts\python.exe" -m pip install -r "ResultSearcher\flask\requirements.txt"
if errorlevel 1 exit /b 1

echo Starting the search page at http://127.0.0.1:5000/
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:5000/"
cd /d "%~dp0ResultSearcher\flask"
"%~dp0.venv\Scripts\python.exe" backend.py
endlocal

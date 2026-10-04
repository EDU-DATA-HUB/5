@echo off
setlocal
cd /d "%~dp0"

set "JAVA_HOME=C:\Program Files\Java\jre1.8.0_471"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "HF_HUB_OFFLINE=1"
set "TRANSFORMERS_OFFLINE=1"
set "HF_DATASETS_OFFLINE=1"
set "HF_HUB_DISABLE_TELEMETRY=1"
set "NLTK_DATA=%~dp0nltk_data"

set "INPUT=%~1"
if "%INPUT%"=="" set "INPUT=examples\input_text.txt"

if not exist "%INPUT%" (
  echo Input file not found: %INPUT%
  echo Usage: run.bat [path\to\text.txt]
  echo Example: run.bat examples\input_text.txt
  exit /b 1
)

echo Running KnowledgeGraph_Builder on %INPUT%
echo This can take several minutes.
".python37\python.exe" text_to_graph.py "%INPUT%"
if errorlevel 1 (
  echo Pipeline failed.
  exit /b 1
)

echo Done.
endlocal

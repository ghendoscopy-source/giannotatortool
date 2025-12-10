@echo off
cd /d "%~dp0"

echo Starting local server...
start "" "python 64\python.exe" -m http.server 8000

timeout /t 2 >nul

echo Opening GI Annotator in your browser...
start "" http://localhost:8000

echo Server running. Close this window to stop the server.
pause

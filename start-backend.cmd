@echo off
rem Double-click to start the CoreCart backend (local server + local database). Keep this window open; close it to stop.
cd /d "%~dp0"
call npm.cmd run dev
pause

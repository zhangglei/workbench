@echo off
chcp 65001 >nul
cd /d "%~dp0"

:: 优先用 Node，没有则用 Python
where node >nul 2>&1
if %errorlevel% equ 0 (
  node server.js
  exit /b
)
python --version >nul 2>&1
if %errorlevel% equ 0 (
  python server.py
  exit /b
)
python3 --version >nul 2>&1
if %errorlevel% equ 0 (
  python3 server.py
  exit /b
)

echo 未检测到 Node.js 或 Python，请先安装其一。
echo 推荐: https://nodejs.org
pause

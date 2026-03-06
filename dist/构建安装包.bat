@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   正在构建安装包（首次会下载 Electron，请稍候）…
echo.
call npm install
if %errorlevel% neq 0 (
  echo   [×] npm install 失败，请确保已安装 Node.js：https://nodejs.org
  pause
  exit /b 1
)
call npm run build:win
if %errorlevel% neq 0 (
  echo   [×] 构建失败
  pause
  exit /b 1
)
echo.
echo   [√] 完成。安装包在 dist 文件夹内：
echo       - 我的工作台 Setup 1.0.0.exe （双击即可安装）
echo       - 我的工作台 1.0.0.exe       （便携版，无需安装）
echo.
explorer "%~dp0dist"
pause

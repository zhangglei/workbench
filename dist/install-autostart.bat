@echo off
chcp 65001 >nul
setlocal
set "DIR=%~dp0"
set "DIR=%DIR:~0,-1%"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\工作台-开机启动.lnk"

:: 用 PowerShell 创建快捷方式：开机时自动运行 start.vbs（无窗口）
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$s = $ws.CreateShortcut('%LNK%'); " ^
  "$s.TargetPath = 'wscript.exe'; " ^
  "$s.Arguments = '\"%DIR%\start.vbs\"'; " ^
  "$s.WorkingDirectory = '%DIR%'; " ^
  "$s.WindowStyle = 7; " ^
  "$s.Description = '工作台网页服务-开机自启'; " ^
  "$s.Save()"

if exist "%LNK%" (
  echo.
  echo   [√] 已安装开机自启：登录系统后会自动在后台启动工作台服务。
  echo       快捷方式位置: %STARTUP%
  echo.
  set /p now="是否现在启动一次服务？(Y/N，直接回车=Y): "
  if /i "%now%"=="" set now=Y
  if /i "%now%"=="Y" (
    start "" wscript.exe "%DIR%\start.vbs"
    echo   已后台启动，可在浏览器访问 http://localhost:8765
  )
) else (
  echo   [×] 创建快捷方式失败，请检查是否有写入权限。
)
echo.
pause

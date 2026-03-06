@echo off
chcp 65001 >nul
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP%\工作台-开机启动.lnk"

if exist "%LNK%" (
  del "%LNK%"
  echo.
  echo   [√] 已取消开机自启，已删除: 工作台-开机启动.lnk
  echo       之后开机不会再自动启动工作台服务。
) else (
  echo.
  echo   未找到开机自启快捷方式，可能未安装过。
)
echo.
pause

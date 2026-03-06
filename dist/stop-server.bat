@echo off
chcp 65001 >nul
echo 正在停止工作台服务...

:: 用 PowerShell 结束命令行中含 server.js 的 node 进程、含 server.py 的 python 进程
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process | Where-Object { " ^
  "  ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'server\.js') -or " ^
  "  ($_.Name -match 'python\.exe' -and $_.CommandLine -match 'server\.py') " ^
  "} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo 已尝试结束工作台相关进程。
timeout /t 2 >nul

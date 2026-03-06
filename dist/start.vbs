' 后台无窗口启动工作台服务（先试 Node，再试 Python）
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = scriptDir
' 0 = 隐藏窗口，不等待
sh.Run "cmd /c """ & scriptDir & "\start.bat""", 0, False

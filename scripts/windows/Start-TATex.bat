@echo off
setlocal
rem Put this file inside the USB TATex folder (next to app\).
rem Double-click on any PC — no Node, no .NET, no source repo.

set "USB_ROOT=%~dp0"
if "%USB_ROOT:~-1%"=="\" set "USB_ROOT=%USB_ROOT:~0,-1%"

if not exist "%USB_ROOT%\app\TATex.exe" (
  echo TATex.exe not found at "%USB_ROOT%\app\TATex.exe"
  echo Copy the packaged app folder into this USB's app\ directory.
  pause
  exit /b 1
)

set "USB_ROOT=%USB_ROOT%"
start "" "%USB_ROOT%\app\TATex.exe"
endlocal

@echo off
setlocal
rem One-time on KARAN'S PC only: create device.json + device.key on this USB.
rem Do not give this bat to Vishal. Start the app ONCE.

set "USB_ROOT=%~dp0"
if "%USB_ROOT:~-1%"=="\" set "USB_ROOT=%USB_ROOT:~0,-1%"
echo USB_ROOT=%USB_ROOT%

if not exist "%USB_ROOT%\app\TATex.exe" (
  echo TATex.exe not found at "%USB_ROOT%\app\TATex.exe"
  pause
  exit /b 1
)

set "TATEX_ALLOW_DEVICE_INIT=1"
echo Initializing USB identity at "%USB_ROOT%"
start "" "%USB_ROOT%\app\TATex.exe"
endlocal

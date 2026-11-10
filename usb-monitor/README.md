# T. A. TEX USB Monitor

Windows-only helper that is **not** part of the Electron app. It waits for a USB volume that contains an authorized `TATex` folder, then starts `TATex.exe`.

Plan mapping: `UsbMonitor.exe` → this project (`TATex.UsbMonitor`). Packaged Electron exe is `TATex.exe` (plan’s `MySoftware.exe`).

## Install target (Windows)

Do not run this on macOS. On a Windows PC:

```
C:\Program Files\TATex\UsbMonitor.exe
```

Start it at logon (Task Scheduler or `shell:startup`). It does **not** install itself as a Windows service from this repo.

## Publish (from Windows, or a Mac with the .NET Windows targeting pack)

```bash
dotnet publish usb-monitor/TATex.UsbMonitor.csproj -c Release -r win-x64 --self-contained true
```

Output: `usb-monitor/bin/Release/net8.0-windows/win-x64/publish/UsbMonitor.exe`

This Mac does not have `dotnet`; source is still complete.

## USB insert

1. `WM_DEVICECHANGE` plus a 2s drive poll.
2. Look for `{drive}:\TATex\config\device.json` (USB_ROOT = `{drive}:\TATex`).
3. Validate `security/device.key` fingerprint against `config/device.json`.
4. If `app\TATex.exe` exists and no TATex process is running, start it with:

   `USB_ROOT={drive}:\TATex`

## USB remove

POST `http://127.0.0.1:47820/shutdown` (localhost only). Electron also polls `USB_ROOT` and calls `shutdownApp()` if the folder vanishes — that path works on macOS against `usb-dev`.

## Layout on a real USB

```
{drive}:\TATex\          ← USB_ROOT
  app\TATex.exe
  data\database.sqlite.enc
  backups\daily|weekly|emergency\
  config\device.json
  logs\
  security\device.key
```

Local stand-in: `<repo>/usb-dev/` is USB_ROOT (same folders, no physical drive).

using System.Diagnostics;

namespace TATex.UsbMonitor;

internal static class AppLauncher
{
    public static bool IsAppRunning()
    {
        return Process.GetProcessesByName("TATex").Length > 0
            || Process.GetProcessesByName("T. A. TEX").Length > 0;
    }

    public static void StartFromUsb(string usbRoot)
    {
        if (IsAppRunning())
        {
            return;
        }

        if (!DeviceAuth.TryValidate(usbRoot, out var error))
        {
            Debug.WriteLine($"TATex USB rejected: {error}");
            return;
        }

        var exe = Path.Combine(usbRoot, "app", "TATex.exe");
        if (!File.Exists(exe))
        {
            Debug.WriteLine($"TATex.exe not found at {exe}");
            return;
        }

        var start = new ProcessStartInfo
        {
            FileName = exe,
            WorkingDirectory = Path.GetDirectoryName(exe) ?? usbRoot,
            UseShellExecute = false,
        };
        start.Environment["USB_ROOT"] = usbRoot;
        start.Environment["TATEX_SHUTDOWN_PORT"] = Environment.GetEnvironmentVariable("TATEX_SHUTDOWN_PORT") ?? "47820";
        Process.Start(start);
    }
}

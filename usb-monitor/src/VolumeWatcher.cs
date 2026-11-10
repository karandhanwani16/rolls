namespace TATex.UsbMonitor;

internal sealed class VolumeWatcher : Form
{
    private const int WmDeviceChange = 0x0219;
    private const int DbtDeviceArrival = 0x8000;
    private const int DbtDeviceRemoveComplete = 0x8004;

    private readonly HashSet<string> _knownRoots = new(StringComparer.OrdinalIgnoreCase);
    private readonly System.Windows.Forms.Timer _pollTimer;

    public VolumeWatcher()
    {
        ShowInTaskbar = false;
        WindowState = FormWindowState.Minimized;
        FormBorderStyle = FormBorderStyle.FixedToolWindow;
        Opacity = 0;
        Load += (_, _) => Hide();

        ScanDrives(startApps: true);

        _pollTimer = new System.Windows.Forms.Timer { Interval = 2000 };
        _pollTimer.Tick += (_, _) => ScanDrives(startApps: true);
        _pollTimer.Start();
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WmDeviceChange)
        {
            var eventType = m.WParam.ToInt32();
            if (eventType == DbtDeviceArrival)
            {
                ScanDrives(startApps: true);
            }
            else if (eventType == DbtDeviceRemoveComplete)
            {
                HandleRemovals();
            }
        }

        base.WndProc(ref m);
    }

    private void ScanDrives(bool startApps)
    {
        var found = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var drive in DriveInfo.GetDrives())
        {
            try
            {
                if (!drive.IsReady)
                {
                    continue;
                }

                var usbRoot = DeviceAuth.FindUsbRoot(drive.RootDirectory.FullName);
                if (usbRoot is null)
                {
                    continue;
                }

                found.Add(usbRoot);
                if (startApps)
                {
                    AppLauncher.StartFromUsb(usbRoot);
                }
            }
            catch
            {
                // Drive may have disappeared mid-scan.
            }
        }

        if (_knownRoots.Count > 0)
        {
            var missing = _knownRoots.Where(root => !found.Contains(root)).ToList();
            if (missing.Count > 0)
            {
                _ = ShutdownClient.RequestShutdownAsync();
            }
        }

        _knownRoots.Clear();
        foreach (var root in found)
        {
            _knownRoots.Add(root);
        }
    }

    private void HandleRemovals()
    {
        _ = ShutdownClient.RequestShutdownAsync();
        ScanDrives(startApps: false);
    }
}

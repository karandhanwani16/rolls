using System.Net.Http;
using System.Text;

namespace TATex.UsbMonitor;

internal static class ShutdownClient
{
    public static async Task RequestShutdownAsync()
    {
        var url = Environment.GetEnvironmentVariable("TATEX_SHUTDOWN_URL")
            ?? "http://127.0.0.1:47820/shutdown";

        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
            using var content = new StringContent("{\"reason\":\"usb-removed\"}", Encoding.UTF8, "application/json");
            await client.PostAsync(url, content);
        }
        catch
        {
            // App may already have quit because usb-manager saw the missing volume.
        }
    }
}

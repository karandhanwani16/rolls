using System.Security.Cryptography;
using System.Text.Json;

namespace TATex.UsbMonitor;

internal static class DeviceAuth
{
    public const string Product = "TATex";
    public const string FolderName = "TATex";

    public static string? FindUsbRoot(string driveRoot)
    {
        var nested = Path.Combine(driveRoot, FolderName);
        if (LooksLikeUsbRoot(nested))
        {
            return nested;
        }

        if (LooksLikeUsbRoot(driveRoot))
        {
            return driveRoot;
        }

        return null;
    }

    public static bool LooksLikeUsbRoot(string path)
    {
        return File.Exists(Path.Combine(path, "config", "device.json"));
    }

    public static bool TryValidate(string usbRoot, out string error)
    {
        error = "";
        var jsonPath = Path.Combine(usbRoot, "config", "device.json");
        var keyPath = Path.Combine(usbRoot, "security", "device.key");

        if (!File.Exists(jsonPath) || !File.Exists(keyPath))
        {
            error = "missing device.json or device.key";
            return false;
        }

        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(jsonPath));
            var root = doc.RootElement;
            var product = root.GetProperty("product").GetString();
            var fingerprint = root.GetProperty("keyFingerprint").GetString();
            if (!string.Equals(product, Product, StringComparison.Ordinal))
            {
                error = "product mismatch";
                return false;
            }

            var hex = File.ReadAllText(keyPath).Trim();
            var key = Convert.FromHexString(hex);
            if (key.Length != 32)
            {
                error = "device.key is not 32 bytes";
                return false;
            }

            var actual = Convert.ToHexString(SHA256.HashData(key)).ToLowerInvariant();
            if (!string.Equals(actual, fingerprint, StringComparison.OrdinalIgnoreCase))
            {
                error = "device key does not match device.json";
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }
}

using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;

internal static class DesktopFiles
{
    internal const string MutexName = @"Local\HaiderMoneyOffline";
    internal static readonly string Root = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HaiderMoney");
    internal static string LiveData { get { return Path.Combine(Root, "Data"); } }

    internal static bool Take(Mutex mutex)
    {
        try { return mutex.WaitOne(0); }
        catch (AbandonedMutexException) { return true; }
    }

    internal static string Quote(string value) { return "\"" + value + "\""; }

    internal static string NewToken()
    {
        byte[] bytes = new byte[32];
        using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes);
    }

    internal static void CopyFolder(string source, string destination)
    {
        Directory.CreateDirectory(destination);
        foreach (string file in Directory.GetFiles(source))
            File.Copy(file, Path.Combine(destination, Path.GetFileName(file)));
        foreach (string folder in Directory.GetDirectories(source))
            CopyFolder(folder, Path.Combine(destination, Path.GetFileName(folder)));
    }

    internal static void DeleteFolder(string path)
    {
        try { if (Directory.Exists(path)) Directory.Delete(path, true); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    internal static void ValidatePayload(string folder)
    {
        string manifest = Path.Combine(folder, "payload.sha256");
        var paths = File.ReadAllLines(manifest).Select(line => line.Split(new[] { "  " }, 2, StringSplitOptions.None)).ToArray();
        string[] required = { "HaiderMoney.exe", "HaiderMoney.exe.config", "node.exe", "server.mjs", "web/index.html",
            "web/setup/index.html", "Microsoft.Web.WebView2.Core.dll",
            "Microsoft.Web.WebView2.WinForms.dll", "WebView2Loader.dll" };
        var entries = paths.ToDictionary(parts => parts[1], parts => parts[0], StringComparer.OrdinalIgnoreCase);
        if (required.Any(file => !entries.ContainsKey(file)) || !entries.Keys.Any(file => file.StartsWith("drizzle/")))
            throw new IOException("The payload manifest is incomplete.");

        string root = Path.GetFullPath(folder) + Path.DirectorySeparatorChar;
        var actual = Directory.GetFiles(folder, "*", SearchOption.AllDirectories)
            .Select(file => file.Substring(root.Length).Replace('\\', '/'))
            .Where(file => file != "payload.sha256");
        if (!new System.Collections.Generic.HashSet<string>(actual, StringComparer.OrdinalIgnoreCase).SetEquals(entries.Keys))
            throw new IOException("The payload files do not match the manifest.");
        using (var sha = SHA256.Create())
        {
            foreach (var entry in entries)
            {
                string path = Path.GetFullPath(Path.Combine(folder, entry.Key));
                if (!path.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                    throw new IOException("The payload contains an invalid path.");
                using (var stream = File.OpenRead(path))
                {
                    string hash = BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "");
                    if (!hash.Equals(entry.Value, StringComparison.OrdinalIgnoreCase))
                        throw new IOException("Damaged setup file: " + entry.Key);
                }
            }
        }
    }

    internal static async Task<string> RunNode(string appFolder, string arguments, string dataFolder)
    {
        var info = new ProcessStartInfo
        {
            FileName = Path.Combine(appFolder, "node.exe"), WorkingDirectory = appFolder,
            Arguments = "server.mjs " + arguments, UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true
        };
        if (dataFolder != null) info.EnvironmentVariables["HAIDER_DATA"] = dataFolder;
        using (var process = Process.Start(info))
        {
            var output = process.StandardOutput.ReadToEndAsync();
            var errors = process.StandardError.ReadToEndAsync();
            if (!await Task.Run(() => process.WaitForExit(90000)))
            {
                process.Kill();
                await Task.Run(() => process.WaitForExit());
                throw new TimeoutException("The backup check took too long.");
            }
            string error = await errors;
            if (process.ExitCode != 0)
            {
                string detail = error.Split('\n').FirstOrDefault(line => line.StartsWith("Error: ") ||
                    line.StartsWith("SyntaxError: "));
                throw new IOException(detail == null ? "The backup check failed." : detail.Trim());
            }
            return await output;
        }
    }
}

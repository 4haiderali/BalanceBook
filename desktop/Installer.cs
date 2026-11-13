using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

internal static class Installer
{
    [STAThread]
    private static int Main(string[] startupArgs)
    {
        bool quiet = Array.IndexOf(startupArgs, "--quiet") >= 0;
        Application.EnableVisualStyles();
        string source = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "payload");
        string programs = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Programs");
        string target = Path.Combine(programs, "HaiderMoney");
        string previous = target + ".previous";
        bool update = Directory.Exists(target) || Directory.Exists(previous);
        if (!File.Exists(Path.Combine(source, "payload.sha256")))
        {
            if (!quiet) MessageBox.Show("Extract the entire ZIP and run setup from the extracted folder.", "BalanceBook Setup");
            return 2;
        }
        string question = update
            ? "Update BalanceBook in place? Setup will check the replacement with a copy of your ledger."
            : "Install BalanceBook for your Windows account?";
        if (!quiet && MessageBox.Show(question, "BalanceBook Setup", MessageBoxButtons.OKCancel,
            MessageBoxIcon.Question) != DialogResult.OK) return 2;

        string verification = null;
        Exception failure = null;
        bool cancelled = false;
        var shortcutErrors = new System.Collections.Generic.List<string>();
        using (var progress = new Form())
        using (var status = new Label())
        using (var bar = new ProgressBar())
        {
            progress.Text = "BalanceBook Setup";
            progress.StartPosition = FormStartPosition.CenterScreen;
            progress.FormBorderStyle = FormBorderStyle.FixedDialog;
            progress.ControlBox = false;
            progress.AutoScaleMode = AutoScaleMode.Font;
            progress.ClientSize = new Size(440, 106);
            progress.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);

            status.SetBounds(20, 20, 400, 36);
            status.Text = "Preparing setup…";
            bar.SetBounds(20, 64, 400, 18);
            bar.Style = ProgressBarStyle.Marquee;
            progress.Controls.AddRange(new Control[] { status, bar });

            bool finished = false;
            progress.FormClosing += (sender, args) => args.Cancel = !finished;
            progress.Shown += async (sender, args) =>
            {
                Action<string> report = message => progress.Invoke(new Action(() => status.Text = message));
                try
                {
                    verification = await Task.Run(() =>
                    {
                        using (var installLock = new Mutex(false, DesktopFiles.MutexName))
                        {
                            if (!DesktopFiles.Take(installLock))
                            {
                                // Unattended setup MUST refuse an open app; never bypass its mutex.
                                if (quiet) throw new IOException("Close BalanceBook before unattended setup. No files were replaced.");
                                if (!CloseRunningApp(target, progress, report, installLock))
                                    throw new OperationCanceledException();
                            }
                            try
                            {
                                if (!Directory.Exists(target) && Directory.Exists(previous)) MoveFolder(previous, target);
                                string result = InstallFiles(source, target, previous, progress, report);
                                report("Creating Desktop and Start menu shortcuts…");
                                progress.Invoke(new Action(() =>
                                {
                                    foreach (var location in new[] { Environment.SpecialFolder.Programs, Environment.SpecialFolder.DesktopDirectory })
                                    {
                                        try { CreateShortcut(location, target); }
                                        catch (Exception error) { shortcutErrors.Add(location + ": " + error.Message); }
                                    }
                                }));
                                return result;
                            }
                            finally { installLock.ReleaseMutex(); }
                        }
                    });
                }
                catch (OperationCanceledException) { cancelled = true; }
                catch (Exception error) { failure = error; }
                finally
                {
                    finished = true;
                    progress.Close();
                }
            };
            progress.ShowDialog();
        }

        if (cancelled) return 2;
        if (failure != null)
        {
            if (!quiet) MessageBox.Show("Setup could not finish.\n\n" + failure.Message, "BalanceBook Setup",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 2;
        }

        string completed = update ? "BalanceBook was updated." : "BalanceBook was installed.";
        if (verification != null) completed += "\n" + verification;
        if (shortcutErrors.Count != 0) completed += "\nCould not create shortcuts:\n" + string.Join("\n", shortcutErrors);
        if (!quiet && MessageBox.Show(completed + "\n\nOpen it now?", "BalanceBook Setup",
            MessageBoxButtons.YesNo, MessageBoxIcon.Information) == DialogResult.Yes)
        {
            try { Process.Start(Path.Combine(target, "HaiderMoney.exe")); }
            catch (Exception error) { MessageBox.Show(error.Message, "BalanceBook Setup"); }
        }
        return 0;
    }

    private static bool CloseRunningApp(string target, Form progress, Action<string> report, Mutex installLock)
    {
        string launcher = Path.Combine(target, "HaiderMoney.exe");
        Process[] candidates = Process.GetProcessesByName("HaiderMoney");
        try
        {
            foreach (Process candidate in candidates)
            {
                bool matches;
                try
                {
                    matches = !candidate.HasExited &&
                        string.Equals(candidate.MainModule.FileName, launcher, StringComparison.OrdinalIgnoreCase) &&
                        candidate.MainWindowHandle != IntPtr.Zero;
                }
                catch (InvalidOperationException) { continue; }
                catch (System.ComponentModel.Win32Exception) { continue; }
                if (!matches) continue;

                var choice = (DialogResult)progress.Invoke(new Func<DialogResult>(() =>
                    MessageBox.Show(progress,
                        "BalanceBook is open. Close it and continue setup? If you have an unsaved draft, BalanceBook will ask what to do.",
                        "BalanceBook Setup", MessageBoxButtons.YesNo, MessageBoxIcon.Question,
                        MessageBoxDefaultButton.Button2)));
                if (choice != DialogResult.Yes) return false;

                report("Waiting for BalanceBook to close…");
                try { candidate.CloseMainWindow(); }
                catch (InvalidOperationException) { }
                var wait = Stopwatch.StartNew();
                while (wait.Elapsed.TotalSeconds < 45)
                {
                    if (DesktopFiles.Take(installLock)) return true;
                    Thread.Sleep(200);
                }
                throw new IOException("BalanceBook is still open or setup is already running. Finish any open work and run setup again.");
            }
            if (DesktopFiles.Take(installLock)) return true;
            throw new IOException("BalanceBook or another setup is still running. Close it and run setup again.");
        }
        finally
        {
            foreach (Process candidate in candidates) candidate.Dispose();
        }
    }

    private static string InstallFiles(string source, string target, string previous, Form progress, Action<string> report)
    {
        string staging = target + ".install-" + Guid.NewGuid().ToString("N");
        string probe = Path.Combine(DesktopFiles.Root, "SetupProbe-" + Guid.NewGuid().ToString("N"));
        try
        {
            report("Copying and checking program files…");
            DesktopFiles.CopyFolder(source, staging);
            DesktopFiles.ValidatePayload(staging);
            Directory.CreateDirectory(probe);
            string data = DesktopFiles.LiveData;
            if (!Directory.Exists(data) && Directory.Exists(data + ".recovery-original"))
                data += ".recovery-original";
            if (Directory.Exists(data)) DesktopFiles.CopyFolder(data, Path.Combine(probe, "Data"));

            bool hasLedger = File.Exists(Path.Combine(data, "ledger.sqlite"));
            string before = null;
            string verification = null;
            if (hasLedger)
            {
                report("Reading a copy of your existing ledger…");
                string baseline = Path.Combine(probe, "Before");
                DesktopFiles.CopyFolder(data, Path.Combine(baseline, "Data"));
                before = LedgerFingerprint(target, baseline);
                verification = "Ledger comparison was unavailable.";
            }

            report("Checking that BalanceBook opens…");
            string failure = Probe(staging, probe);
            if (failure == null && before != null)
            {
                report("Comparing ledger data…");
                string after = LedgerFingerprint(Path.Combine(probe, "Program"), probe);
                if (after == null || before != after)
                    throw new IOException("Setup could not verify that the update opens the same ledger. Your existing installation and data were kept.");
                verification = "Ledger matched before and after the update. Verification code " + after.Substring(0, 12) + ".";
            }
            if (failure != null)
            {
                // A damaged ledger should not prevent installing the recovery tools.
                // Retry only when the candidate itself can open a clean database.
                report("Checking whether recovery tools can open…");
                string cleanProbe = Path.Combine(DesktopFiles.Root, "SetupProbe-" + Guid.NewGuid().ToString("N"));
                bool canRecover;
                try { canRecover = File.Exists(Path.Combine(data, "ledger.sqlite")) && Probe(staging, cleanProbe) == null; }
                finally { DesktopFiles.DeleteFolder(cleanProbe); }
                if (!canRecover || (DialogResult)progress.Invoke(new Func<DialogResult>(() => MessageBox.Show(progress,
                    "The replacement opened with an empty test ledger, but could not open the copy of your existing ledger.\n\n" +
                    "Install anyway to open the recovery tool? Setup will keep your existing database.\n\n" + failure,
                    "BalanceBook Setup", MessageBoxButtons.YesNo, MessageBoxIcon.Warning,
                    MessageBoxDefaultButton.Button2))) != DialogResult.Yes)
                    throw new IOException("The replacement could not open with your existing ledger. The installation is still in place.\n" + failure);
            }

            report("Saving a pre-update ledger copy and installing files…");
            if (Directory.Exists(data)) SavePreUpdateLedger(data);

            DesktopFiles.DeleteFolder(previous);
            if (Directory.Exists(previous)) throw new IOException("Could not clear the temporary previous program folder.");
            if (Directory.Exists(target)) MoveFolder(target, previous);
            try { MoveFolder(staging, target); }
            catch
            {
                if (!Directory.Exists(target) && Directory.Exists(previous)) MoveFolder(previous, target);
                throw;
            }
            DesktopFiles.DeleteFolder(previous);
            return verification;
        }
        finally
        {
            DesktopFiles.DeleteFolder(staging);
            DesktopFiles.DeleteFolder(probe);
        }
    }

    private static void MoveFolder(string from, string to)
    {
        for (int attempt = 0; ; attempt++)
        {
            try { Directory.Move(from, to); return; }
            catch (Exception error)
            {
                if (!(error is IOException) && !(error is UnauthorizedAccessException)) throw;
                if (attempt == 11)
                    throw new IOException("Could not move " + from + " to " + to + ".\n" + error.Message, error);
                Thread.Sleep(250);
            }
        }
    }

    private static void SavePreUpdateLedger(string data)
    {
        string latest = Path.Combine(DesktopFiles.Root, "Before latest update");
        string old = latest + ".previous";
        string pending = latest + "." + Guid.NewGuid().ToString("N");
        try
        {
            if (!Directory.Exists(latest) && Directory.Exists(old)) MoveFolder(old, latest);
            DesktopFiles.CopyFolder(data, pending);
            DesktopFiles.DeleteFolder(old);
            if (Directory.Exists(latest)) MoveFolder(latest, old);
            try { MoveFolder(pending, latest); }
            catch
            {
                if (!Directory.Exists(latest) && Directory.Exists(old)) MoveFolder(old, latest);
                throw;
            }
            DesktopFiles.DeleteFolder(old);
        }
        finally { DesktopFiles.DeleteFolder(pending); }
    }

    // Run each version against its own disposable copy with scheduled exports disabled.
    private static string LedgerFingerprint(string program, string sandbox)
    {
        string node = Path.Combine(program, "node.exe");
        if (!File.Exists(node)) return null;
        string ready = Path.Combine(sandbox, "fingerprint.port");
        string token = Guid.NewGuid().ToString("N");
        var start = new ProcessStartInfo(node, "server.mjs")
        {
            UseShellExecute = false, WorkingDirectory = program, CreateNoWindow = true,
            RedirectStandardInput = true
        };
        start.EnvironmentVariables["HAIDER_DATA"] = Path.Combine(sandbox, "Data");
        start.EnvironmentVariables["HAIDER_READY"] = ready;
        start.EnvironmentVariables["HAIDER_PARENT"] = Process.GetCurrentProcess().Id.ToString();
        start.EnvironmentVariables["HAIDER_TOKEN"] = token;
        start.EnvironmentVariables.Remove("HAIDER_REPORT_CONFIG");
        try
        {
            using (var process = Process.Start(start))
            {
                try
                {
                    var startup = Stopwatch.StartNew();
                    while (!File.Exists(ready))
                    {
                        if (process.HasExited || startup.Elapsed.TotalSeconds >= 60) return null;
                        Thread.Sleep(100);
                    }
                    int port;
                    if (!int.TryParse(File.ReadAllText(ready), out port) || port < 1 || port > 65535) return null;
                    var request = WebRequest.CreateHttp("http://127.0.0.1:" + port + "/api/ledger");
                    request.Proxy = null;
                    request.Timeout = request.ReadWriteTimeout = 30000;
                    request.Headers["x-haider-session"] = token;
                    using (var response = request.GetResponse())
                    using (var body = response.GetResponseStream())
                    using (var sha = SHA256.Create())
                        return BitConverter.ToString(sha.ComputeHash(body)).Replace("-", "");
                }
                finally
                {
                    process.StandardInput.Close();
                    if (!process.WaitForExit(5000))
                    {
                        process.Kill();
                        process.WaitForExit();
                    }
                }
            }
        }
        catch (IOException) { return null; }
        catch (WebException) { return null; }
        catch (System.ComponentModel.Win32Exception) { return null; }
        catch (InvalidOperationException) { return null; }
    }

    private static string Probe(string source, string probe)
    {
        string probeProgram = Path.Combine(probe, "Program");
        DesktopFiles.CopyFolder(source, probeProgram);
        DesktopFiles.ValidatePayload(probeProgram);
        var candidate = new ProcessStartInfo(Path.Combine(probeProgram, "HaiderMoney.exe"),
            "--setup-probe " + DesktopFiles.Quote(probe)) { UseShellExecute = false, WorkingDirectory = probeProgram };
        using (var process = Process.Start(candidate))
        {
            if (!process.WaitForExit(120000))
            {
                process.Kill();
                process.WaitForExit();
                return "The replacement took too long to open.";
            }
            if (process.ExitCode == 0) return null;
            string log = Path.Combine(probe, "startup.log");
            return File.Exists(log) ? File.ReadAllText(log) : "Check that Microsoft Edge WebView2 Runtime is installed.";
        }
    }

    private static void CreateShortcut(Environment.SpecialFolder specialFolder, string target)
    {
        string folder = Environment.GetFolderPath(specialFolder);
        if (string.IsNullOrEmpty(folder) || !Directory.Exists(folder)) return;
        Type shellType = Type.GetTypeFromProgID("WScript.Shell", true);
        dynamic shell = Activator.CreateInstance(shellType);
        dynamic shortcut = shell.CreateShortcut(Path.Combine(folder, "BalanceBook.lnk"));
        shortcut.TargetPath = Path.Combine(target, "HaiderMoney.exe");
        shortcut.WorkingDirectory = target;
        shortcut.Save();

        string oldLink = Path.Combine(folder, "Haider Money.lnk");
        if (File.Exists(oldLink))
        {
            dynamic oldShortcut = shell.CreateShortcut(oldLink);
            if (String.Equals((string)oldShortcut.TargetPath, (string)shortcut.TargetPath, StringComparison.OrdinalIgnoreCase))
                File.Delete(oldLink);
        }
    }
}


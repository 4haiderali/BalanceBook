using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal static class Launcher
{
    [STAThread]
    private static int Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        if (args.Length == 2 && args[0] == "--setup-probe")
        {
            string probeRoot = Path.GetFullPath(args[1]);
            string prefix = Path.Combine(DesktopFiles.Root, "SetupProbe-");
            if (!probeRoot.StartsWith(prefix, StringComparison.OrdinalIgnoreCase) ||
                Path.GetDirectoryName(probeRoot) != DesktopFiles.Root) return 2;
            using (var probe = new LedgerWindow(probeRoot, true))
            {
                Application.Run(probe);
                return probe.Ready ? 0 : 1;
            }
        }

        using (var instance = new Mutex(false, DesktopFiles.MutexName))
        {
            if (!DesktopFiles.Take(instance))
            {
                MessageBox.Show("BalanceBook or setup is already open.", "BalanceBook");
                return 1;
            }
            try
            {
                bool restart;
                do
                {
                    using (var window = new LedgerWindow(DesktopFiles.Root, false))
                    {
                        window.ShowDialog();
                        restart = window.RestartRequested;
                    }
                } while (restart);
            }
            finally { instance.ReleaseMutex(); }
        }
        return 0;
    }
}

internal sealed class LedgerWindow : Form
{
    private readonly string appFolder = AppDomain.CurrentDomain.BaseDirectory;
    private readonly string localFolder;
    private readonly string dataFolder;
    private readonly string readyFile;
    private readonly string token = DesktopFiles.NewToken();
    private readonly bool probe;
    private readonly JavaScriptSerializer serializer = new JavaScriptSerializer();
    private string diagnostic = "";
    private string appState = "idle";
    private bool maintenance, downloadActive, bypassClose, handlingError;
    private Process server;
    private WebView2 web;
    private Uri origin;
    internal bool Ready { get; private set; }
    internal bool RestartRequested { get; private set; }

    internal LedgerWindow(string localFolder, bool probe)
    {
        this.localFolder = localFolder;
        this.probe = probe;
        dataFolder = Path.Combine(localFolder, "Data");
        readyFile = Path.Combine(Path.GetTempPath(), "haider-money-" + Guid.NewGuid().ToString("N") + ".port");
        Text = "BalanceBook " + Application.ProductVersion;
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        AutoScaleDimensions = new SizeF(96F, 96F);
        AutoScaleMode = AutoScaleMode.Dpi;
        Size = new Size(1350, 900);
        MinimumSize = new Size(580, 420);
        StartPosition = FormStartPosition.CenterScreen;
        if (probe) { ShowInTaskbar = false; Opacity = 0; }
        Controls.Add(new Label {
            Text = "Opening your local ledger…", Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter
        });
        Shown += OpenLedger;
        FormClosing += GuardClose;
        FormClosed += delegate { StopServer(); };
    }

    private async void OpenLedger(object sender, EventArgs args)
    {
        try
        {
            Directory.CreateDirectory(localFolder);
            if (!Directory.Exists(dataFolder) && Directory.Exists(dataFolder + ".recovery-original"))
                Directory.Move(dataFolder + ".recovery-original", dataFolder);
            CoreWebView2Environment.GetAvailableBrowserVersionString();
            var start = new ProcessStartInfo
            {
                FileName = Path.Combine(appFolder, "node.exe"), Arguments = "server.mjs",
                WorkingDirectory = appFolder, UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardInput = true, RedirectStandardError = true
            };
            start.EnvironmentVariables["HAIDER_DATA"] = dataFolder;
            start.EnvironmentVariables["HAIDER_READY"] = readyFile;
            start.EnvironmentVariables["HAIDER_PARENT"] = Process.GetCurrentProcess().Id.ToString();
            start.EnvironmentVariables["HAIDER_TOKEN"] = token;
            if (!probe) start.EnvironmentVariables["HAIDER_REPORT_CONFIG"] = Path.Combine(localFolder, "report-folder.txt");
            else start.EnvironmentVariables.Remove("HAIDER_REPORT_CONFIG");
            server = Process.Start(start);
            server.ErrorDataReceived += delegate(object _, DataReceivedEventArgs e)
            {
                if (e.Data != null && diagnostic.Length < 12000)
                    diagnostic += e.Data.Substring(0, Math.Min(e.Data.Length, 1000)) + Environment.NewLine;
            };
            server.BeginErrorReadLine();
            var startup = Stopwatch.StartNew();
            while (!File.Exists(readyFile))
            {
                if (IsDisposed) return;
                if (server.HasExited)
                {
                    server.WaitForExit();
                    throw new IOException("The local ledger service exited during startup (code " + server.ExitCode + ").");
                }
                if (startup.Elapsed.TotalSeconds > 60) throw new TimeoutException("The ledger service did not become ready.");
                await Task.Delay(100);
            }
            if (IsDisposed) return;
            origin = new Uri("http://127.0.0.1:" + int.Parse(File.ReadAllText(readyFile)));
            File.Delete(readyFile);
            web = new WebView2
            {
                Dock = DockStyle.Fill,
                CreationProperties = new CoreWebView2CreationProperties
                { UserDataFolder = Path.Combine(localFolder, "WebView2") }
            };
            Controls.Add(web);
            web.BringToFront();
            await web.EnsureCoreWebView2Async(null, null);
            if (IsDisposed) return;
            var core = web.CoreWebView2;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.NavigationStarting += delegate(object _, CoreWebView2NavigationStartingEventArgs e)
            {
                e.Cancel = !IsLocal(e.Uri);
            };
            core.NewWindowRequested += delegate(object _, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; };
            core.AddWebResourceRequestedFilter(origin.GetLeftPart(UriPartial.Authority) + "/api/*",
                CoreWebView2WebResourceContext.All);
            core.WebResourceRequested += delegate(object _, CoreWebView2WebResourceRequestedEventArgs e)
            {
                if (IsLocal(e.Request.Uri)) e.Request.Headers.SetHeader("X-Haider-Session", token);
            };
            core.NavigationCompleted += delegate(object _, CoreWebView2NavigationCompletedEventArgs e)
            {
                if (!e.IsSuccess && e.WebErrorStatus != CoreWebView2WebErrorStatus.OperationCanceled)
                    BeginInvoke(new Action(() => ShowStartupError("The ledger window could not load (" + e.WebErrorStatus + ").")));
            };
            core.ProcessFailed += delegate(object _, CoreWebView2ProcessFailedEventArgs e)
            {
                if (e.ProcessFailedKind == CoreWebView2ProcessFailedKind.BrowserProcessExited ||
                    e.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessExited)
                    BeginInvoke(new Action(() => ShowStartupError("The ledger window stopped (" + e.ProcessFailedKind + ").")));
            };
            core.WebMessageReceived += ReceiveMessage;
            core.DownloadStarting += ChooseExportLocation;
            core.Navigate(origin.AbsoluteUri);
            await Task.Delay(TimeSpan.FromSeconds(35));
            if (!IsDisposed && !Ready) ShowStartupError("The ledger service opened, but the interface did not become ready.");
        }
        catch (WebView2RuntimeNotFoundException)
        {
            ShowStartupError("Microsoft Edge WebView2 Runtime is required. Install it, then open BalanceBook again.", false);
        }
        catch (Exception error) { ShowStartupError(error.Message); }
    }

    private bool IsLocal(string value)
    {
        Uri uri;
        return origin != null && Uri.TryCreate(value, UriKind.Absolute, out uri) &&
            uri.Scheme == origin.Scheme && uri.Host == origin.Host && uri.Port == origin.Port;
    }

    private void Send(object message)
    {
        if (!IsDisposed && web != null && web.CoreWebView2 != null)
            web.CoreWebView2.PostWebMessageAsJson(serializer.Serialize(message));
    }

    public sealed class BackupRecord
    {
        public string at { get; set; }
        public string path { get; set; }
        public int revision { get; set; }
    }

    private void ReceiveMessage(object sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        if (!IsLocal(args.Source)) return;
        string message;
        try { message = args.TryGetWebMessageAsString(); }
        catch (ArgumentException) { return; }
        if (message == "state:ready")
        {
            Ready = true;
            if (probe) BeginInvoke(new Action(Close));
        }
        else if (!probe && message == "entry-draft")
        {
            try { if (File.Exists(DraftPath)) Send(new { type = "entry-draft", draft = File.ReadAllText(DraftPath) }); }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
        else if (!probe && message == "clear-entry-draft")
            UpdateEntryDraft(null);
        else if (!probe && message.StartsWith("entry-draft:", StringComparison.Ordinal) && message.Length <= 65536)
            UpdateEntryDraft(message.Substring("entry-draft:".Length));
        else if (!probe && message == "backup-status")
        {
            string stamp = Path.Combine(localFolder, "verified-backup.txt");
            try
            {
                if (File.Exists(stamp))
                {
                    var record = serializer.Deserialize<BackupRecord>(File.ReadAllText(stamp));
                    if (record != null && File.Exists(record.path))
                        Send(new { type = "backup-status", record.at, record.path, record.revision });
                }
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
            catch (ArgumentException) { }
            catch (InvalidOperationException) { }
        }
        else if (!probe && message == "open-backup-folder")
        {
            try
            {
                string folder = File.ReadAllText(Path.Combine(localFolder, "report-folder.txt"));
                string backups = Path.Combine(folder, "Backups");
                if (Directory.Exists(backups)) folder = backups;
                if (!Directory.Exists(folder)) throw new IOException("The export folder is unavailable.");
                Process.Start(folder);
            }
            catch (Exception error) { Send(new { type = "backup-folder", error = error.Message }); }
        }
        else if (!probe && message == "choose-report-folder" && !maintenance && !downloadActive)
            BeginInvoke(new Action(ChooseReportFolder));
        else if (!probe && message == "recover" && !maintenance && !downloadActive && appState == "idle")
            BeginInvoke(new Action(async () => await Recover()));
        else if (message == "state:busy" || message == "state:draft" || message == "state:persisted-draft" || message == "state:idle")
            appState = message.Substring(6);
    }

    private void ChooseReportFolder()
    {
        string settings = Path.Combine(localFolder, "report-folder.txt");
        try
        {
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "Choose the folder for BalanceBook reports and backups";
                string initial = File.Exists(settings) ? File.ReadAllText(settings)
                    : Environment.GetEnvironmentVariable("OneDriveConsumer") ?? Environment.GetEnvironmentVariable("OneDrive");
                if (!String.IsNullOrEmpty(initial) && Directory.Exists(initial)) dialog.SelectedPath = initial;
                if (dialog.ShowDialog(this) != DialogResult.OK)
                {
                    Send(new { type = "report-folder", state = "canceled" });
                    return;
                }
                string selected = Path.GetFullPath(dialog.SelectedPath);
                string live = Path.GetFullPath(localFolder).TrimEnd(Path.DirectorySeparatorChar);
                if (selected.TrimEnd(Path.DirectorySeparatorChar).Equals(live, StringComparison.OrdinalIgnoreCase)
                    || selected.StartsWith(live + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                    throw new IOException("Choose a folder outside the app’s local data folder.");
                string temporary = settings + "." + Guid.NewGuid().ToString("N") + ".tmp";
                try
                {
                    File.WriteAllText(temporary, selected, new System.Text.UTF8Encoding(false));
                    if (File.Exists(settings)) File.Replace(temporary, settings, null);
                    else File.Move(temporary, settings);
                }
                finally { if (File.Exists(temporary)) File.Delete(temporary); }
                Send(new { type = "report-folder", state = "saved", path = selected });
            }
        }
        catch (Exception error)
        {
            Send(new { type = "report-folder", state = "failed", error = error.Message });
        }
    }

    private void ChooseExportLocation(object sender, CoreWebView2DownloadStartingEventArgs args)
    {
        if (probe || maintenance || downloadActive)
        {
            args.Cancel = true;
            args.Handled = true;
            if (!probe) BeginInvoke(new Action(() => Send(new { type = "export-result", state = "failed",
                error = "Another export or recovery is running. Try again when it finishes." })));
            return;
        }
        downloadActive = true;
        var deferral = args.GetDeferral();
        BeginInvoke(new Action(delegate
        {
            try
            {
                args.Handled = true;
                using (var dialog = new SaveFileDialog())
                {
                    dialog.Title = "Save BalanceBook export";
                    dialog.FileName = Path.GetFileName(args.ResultFilePath);
                    bool json = dialog.FileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase);
                    dialog.Filter = json ? "JSON backup (*.json)|*.json" : "Excel report (*.xlsx)|*.xlsx";
                    dialog.DefaultExt = json ? "json" : "xlsx";
                    dialog.InitialDirectory = Environment.GetEnvironmentVariable("OneDriveConsumer")
                        ?? Environment.GetEnvironmentVariable("OneDrive")
                        ?? Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
                    if (dialog.ShowDialog(this) != DialogResult.OK)
                    {
                        args.Cancel = true;
                        downloadActive = false;
                        Send(new { type = "export-result", state = "canceled" });
                        return;
                    }

                    string destination = dialog.FileName;
                    string temporary = Path.Combine(Path.GetDirectoryName(destination), ".haider-export-" + Guid.NewGuid().ToString("N") + ".tmp");
                    args.ResultFilePath = temporary;
                    var operation = args.DownloadOperation;
                    operation.StateChanged += async delegate
                    {
                        if (operation.State == CoreWebView2DownloadState.InProgress) return;
                        try
                        {
                            if (operation.State != CoreWebView2DownloadState.Completed)
                                throw new IOException("The download was interrupted (" + operation.InterruptReason + ").");
                            int? revision = null;
                            if (json)
                            {
                                string verified = await DesktopFiles.RunNode(appFolder, "--verify-backup " + DesktopFiles.Quote(temporary), null);
                                revision = serializer.Deserialize<BackupRecord>(verified).revision;
                            }
                            if (File.Exists(destination)) File.Replace(temporary, destination, null);
                            else File.Move(temporary, destination);
                            string at = DateTime.UtcNow.ToString("o");
                            string statusNote = null;
                            if (json)
                            {
                                try { File.WriteAllText(Path.Combine(localFolder, "verified-backup.txt"), serializer.Serialize(new { at, path = destination, revision })); }
                                catch (IOException) { statusNote = "The backup date could not be recorded."; }
                                catch (UnauthorizedAccessException) { statusNote = "The backup date could not be recorded."; }
                            }
                            Send(new { type = "export-result", state = "saved", path = destination, json, at, revision, error = statusNote });
                        }
                        catch (Exception error)
                        {
                            Send(new { type = "export-result", state = "failed", error = error.Message });
                        }
                        finally
                        {
                            try { File.Delete(temporary); } catch (IOException) { } catch (UnauthorizedAccessException) { }
                            downloadActive = false;
                        }
                    };
                }
            }
            catch (Exception error)
            {
                args.Cancel = true;
                downloadActive = false;
                Send(new { type = "export-result", state = "failed", error = error.Message });
            }
            finally { deferral.Complete(); }
        }));
    }

    private async Task Recover()
    {
        if (maintenance) return;
        maintenance = true;
        string candidate = Path.Combine(localFolder, "Recovery-" + Guid.NewGuid().ToString("N"));
        string original = dataFolder + ".recovery-original";
        bool stopped = false;
        try
        {
            using (var dialog = new OpenFileDialog { Title = "Choose a full BalanceBook backup", Filter = "JSON backup (*.json)|*.json" })
            {
                if (dialog.ShowDialog(this) != DialogResult.OK) return;
                string summary = await DesktopFiles.RunNode(appFolder, "--restore-backup " + DesktopFiles.Quote(dialog.FileName), candidate);
                if (MessageBox.Show(this, summary + "\n\nSwitch to this ledger? The current database and its history will be kept separately.",
                    "Review recovered ledger", MessageBoxButtons.YesNo, MessageBoxIcon.Question,
                    MessageBoxDefaultButton.Button2) != DialogResult.Yes) return;
            }
            if (downloadActive || appState != "idle") throw new IOException("Close the open draft or finish the current save, then retry recovery.");
            stopped = true;
            if (!StopServer()) throw new IOException("Could not close the active ledger cleanly. The app will reopen the current ledger.");
            if (Directory.Exists(original))
                Directory.Move(original, dataFolder + ".recovery-" + Guid.NewGuid().ToString("N"));
            if (Directory.Exists(dataFolder)) Directory.Move(dataFolder, original);
            try { Directory.Move(candidate, dataFolder); }
            catch
            {
                if (Directory.Exists(original)) Directory.Move(original, dataFolder);
                throw;
            }
            try { File.Delete(Path.Combine(localFolder, "verified-backup.txt")); }
            catch (IOException) { } catch (UnauthorizedAccessException) { }
            UpdateEntryDraft(null);
            RestartRequested = true;
            bypassClose = true;
            Close();
        }
        catch (Exception error)
        {
            MessageBox.Show(this, error.Message, "Recovery could not finish", MessageBoxButtons.OK, MessageBoxIcon.Error);
            if (stopped) { RestartRequested = true; bypassClose = true; Close(); }
        }
        finally
        {
            DesktopFiles.DeleteFolder(candidate);
            maintenance = false;
        }
    }

    private async void ShowStartupError(string message, bool allowRecovery = true)
    {
        if (IsDisposed || handlingError) return;
        handlingError = true;
        string log = Path.Combine(localFolder, "startup.log");
        try { File.WriteAllText(log, message + Environment.NewLine + diagnostic); }
        catch (IOException) { } catch (UnauthorizedAccessException) { }
        if (probe) { Ready = false; Close(); return; }
        if (!allowRecovery)
        {
            MessageBox.Show(this, message, "BalanceBook", MessageBoxButtons.OK, MessageBoxIcon.Error);
            bypassClose = true;
            Close();
            return;
        }
        var choice = MessageBox.Show(this, message + "\n\nDiagnostics: " + log +
            "\n\nYes: retry   ·   No: recover from JSON   ·   Cancel: close",
            "BalanceBook", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Error);
        if (choice == DialogResult.No)
        {
            await Recover();
            if (!IsDisposed)
            {
                handlingError = false;
                if (!Ready)
                {
                    bypassClose = true;
                    Close();
                }
            }
            return;
        }
        RestartRequested = choice == DialogResult.Yes;
        bypassClose = true;
        Close();
    }

    private string DraftPath { get { return Path.Combine(localFolder, "entry-draft.json"); } }

    private bool UpdateEntryDraft(string content)
    {
        try
        {
            if (content == null) File.Delete(DraftPath);
            else
            {
                string temporary = DraftPath + ".tmp";
                File.WriteAllText(temporary, content);
                if (File.Exists(DraftPath)) File.Replace(temporary, DraftPath, null);
                else File.Move(temporary, DraftPath);
            }
            return true;
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        Send(new { type = "entry-draft", error = "Could not update the saved draft." });
        return false;
    }

    private void GuardClose(object sender, FormClosingEventArgs args)
    {
        if (bypassClose || probe || args.CloseReason == CloseReason.WindowsShutDown) return;
        if (maintenance || downloadActive || appState == "busy")
        {
            args.Cancel = true;
            MessageBox.Show(this, "Wait for the current operation to finish before closing.", "BalanceBook");
        }
        else if (appState == "draft" || appState == "persisted-draft")
        {
            args.Cancel = MessageBox.Show(this, "Close and discard the open draft?", "BalanceBook",
                MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2) != DialogResult.Yes;
            if (!args.Cancel && appState == "persisted-draft" && !UpdateEntryDraft(null)) args.Cancel = true;
        }
    }

    private bool StopServer()
    {
        bool graceful = true;
        if (server != null)
        {
            try
            {
                server.StandardInput.Close();
                if (!server.WaitForExit(5000))
                {
                    graceful = false;
                    server.Kill();
                    server.WaitForExit();
                }
            }
            catch (InvalidOperationException) { }
            catch (IOException) { graceful = false; }
            finally { server.Dispose(); server = null; }
        }
        try { File.Delete(readyFile); File.Delete(readyFile + ".tmp"); }
        catch (IOException) { }
        return graceful;
    }
}

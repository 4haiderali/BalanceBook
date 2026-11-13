#ifndef ReleaseRoot
#define ReleaseRoot AddBackslash(SourcePath) + "..\dist\BalanceBook-Windows"
#endif
#ifndef OutputRoot
#define OutputRoot AddBackslash(SourcePath) + "..\dist"
#endif
[Setup]
AppId=BalanceBookDesktop
AppName=BalanceBook
AppVersion=1.2.27
AppVerName=BalanceBook 1.2.27
AppPublisher=Haider Ali
VersionInfoVersion=1.2.27.0
OutputDir={#OutputRoot}
OutputBaseFilename=BalanceBook-1.2.27-Setup-x64
SetupIconFile={#ReleaseRoot}\payload\HaiderMoney.ico
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
DefaultDirName={localappdata}\Programs\BalanceBookSetup
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=no
CloseApplications=no
RestartApplications=no
UninstallDisplayName=BalanceBook
UninstallDisplayIcon={localappdata}\Programs\HaiderMoney\HaiderMoney.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
[Files]
Source: "{#ReleaseRoot}\*"; DestDir: "{tmp}\BalanceBook"; Flags: dontcopy recursesubdirs createallsubdirs
Source: "{#ReleaseRoot}\payload\HaiderMoney.ico"; DestDir: "{app}"; Flags: ignoreversion
[UninstallDelete]
Type: filesandordirs; Name: "{localappdata}\Programs\HaiderMoney"
Type: files; Name: "{userdesktop}\BalanceBook.lnk"
Type: files; Name: "{userprograms}\BalanceBook.lnk"
[Code]
var VerifiedInstallCompleted: Boolean;
function PrepareToInstall(var NeedsRestart: Boolean): String;
var ResultCode: Integer; Params: String;
begin
  Result := '';
  if VerifiedInstallCompleted then exit;
  ExtractTemporaryFiles('{tmp}\BalanceBook\*');
  Params := '';
  if WizardSilent then Params := '--quiet';
  if not Exec(ExpandConstant('{tmp}\BalanceBook\Install-BalanceBook.exe'), Params, ExpandConstant('{tmp}\BalanceBook'), SW_SHOWNORMAL, ewWaitUntilTerminated, ResultCode) then
    Result := 'Could not start BalanceBook setup.'
  else if ResultCode <> 0 then
    Result := 'BalanceBook installation was canceled or could not finish. Your ledger was kept. Close setup, finish any open work, and try again.'
  else
    VerifiedInstallCompleted := True;
end;
function InitializeUninstall(): Boolean;
begin
  Result := False;
  if CheckForMutexes('Local\HaiderMoneyOffline') then begin
    if not UninstallSilent then MsgBox('Close BalanceBook before uninstalling. Your ledger and exported backups will be kept.', mbInformation, MB_OK);
    exit;
  end;
  if UninstallSilent then begin Result := True; exit; end;
  Result := MsgBox('Remove the BalanceBook application? Your ledger, saved history, preferences and exported backups will be kept. Reinstalling opens the retained ledger.', mbConfirmation, MB_YESNO) = IDYES;
end;

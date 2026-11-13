param(
    [Parameter(Mandatory = $true)][string]$RuntimePayload,
    [Parameter(Mandatory = $true)][string]$OutputFolder,
    [string]$SigningThumbprint,
    [string]$SignTool = 'signtool.exe',
    [string]$TimestampUrl = 'http://timestamp.digicert.com'
)

$ErrorActionPreference = 'Stop'
$runtime = (Resolve-Path $RuntimePayload).Path
$output = [IO.Path]::GetFullPath($OutputFolder)
if (Test-Path $output) { throw 'Choose a new output folder.' }

function Invoke-Checked($executable, $arguments) {
    if ([IO.Path]::GetFileName($executable) -eq 'csc.exe') {
        $response = Join-Path (Split-Path $PSScriptRoot) 'compiler-arguments.rsp'
        $arguments | ForEach-Object {
            if ($_ -notmatch '\s') { $_ } elseif ($_ -match '^(/[^:]+:)(.*)$') { $matches[1] + '"' + $matches[2] + '"' }
            else { '"' + $_ + '"' }
        } | Set-Content -LiteralPath $response -Encoding UTF8
        & $executable ('@' + $response)
    } else { & $executable @arguments }
    if ($LASTEXITCODE -ne 0) { throw "$executable failed with exit code $LASTEXITCODE." }
}

Push-Location (Split-Path $PSScriptRoot)
try {
    Invoke-Checked node @('desktop/build.mjs')
    Invoke-Checked node @('node_modules/vite/bin/vite.js', 'build', '--config', 'vite.desktop.config.ts')
    $payload = Join-Path $output 'payload'
    New-Item -ItemType Directory -Path $payload | Out-Null
    Get-ChildItem $runtime -File | Where-Object {
        $_.Name -notin @('HaiderMoney.exe','HaiderMoney.exe.config','server.mjs','payload.sha256')
    } | Copy-Item -Destination $payload
    Copy-Item 'LICENSE' (Join-Path $payload 'BalanceBook-LICENSE.txt')
    Copy-Item 'desktop-dist/server.mjs' $payload
    Copy-Item 'desktop-dist/drizzle','desktop-dist/web' $payload -Recurse

    $framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
    $compiler = Join-Path $framework 'csc.exe'
    $common = @('/nologo','/win32manifest:desktop\Windows.manifest','/target:winexe','/platform:x64','/optimize+',
        "/win32icon:$payload\HaiderMoney.ico", '/r:System.Core.dll', '/r:System.Drawing.dll',
        '/r:System.Windows.Forms.dll', '/r:Microsoft.CSharp.dll', '/r:System.Web.Extensions.dll'
    )
    $facade = Join-Path ${env:ProgramFiles(x86)} 'Reference Assemblies\Microsoft\Framework\.NETFramework\v4.8\Facades\netstandard.dll'
    if (!(Test-Path $facade)) { $facade = Join-Path $framework 'netstandard.dll' }; if (!(Test-Path $facade)) { throw 'Install the .NET Framework 4.8 Developer Pack.' }
    Invoke-Checked $compiler ($common + @("/out:$output\Install-BalanceBook.exe",'desktop\Version.cs','desktop\DesktopFiles.cs','desktop\Installer.cs'))
    Invoke-Checked $compiler ($common + @("/out:$payload\HaiderMoney.exe",
        "/r:$facade","/r:$payload\Microsoft.Web.WebView2.Core.dll",
        "/r:$payload\Microsoft.Web.WebView2.WinForms.dll",'desktop\Version.cs','desktop\DesktopFiles.cs','desktop\Launcher.cs'))
    Copy-Item 'desktop/Windows.config' (Join-Path $payload 'HaiderMoney.exe.config')
    Copy-Item 'desktop/Windows.config' (Join-Path $output 'Install-BalanceBook.exe.config')
    if ($SigningThumbprint) {
        foreach ($binary in @("$output\Install-BalanceBook.exe", "$payload\HaiderMoney.exe")) {
            Invoke-Checked $SignTool @('sign','/sha1',$SigningThumbprint,'/fd','SHA256','/tr',$TimestampUrl,'/td','SHA256',$binary)
            Invoke-Checked $SignTool @('verify','/pa',$binary)
        }
    }
    Get-ChildItem $payload -File -Recurse | ForEach-Object {
        $relative = $_.FullName.Substring($payload.Length + 1).Replace('\','/')
        (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $relative
    } | Set-Content (Join-Path $payload 'payload.sha256') -Encoding Ascii
    Copy-Item 'desktop/START-HERE.txt' $output
}
finally { Pop-Location }








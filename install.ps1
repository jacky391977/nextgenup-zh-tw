param(
    [string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\NextGenUp-zh-TW'),
    [string]$AssetDir = '',
    [switch]$NoLaunch,
    [switch]$Doctor
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$Tag = 'v1.2.0-zh.4'
$Base = "https://github.com/jacky391977/nextgenup-zh-tw/releases/download/$Tag"
$Flavor = 'zh-Hant-TW-1.2.0-r4'
$UpstreamUrl = 'https://github.com/riponcm/nextgenUp/releases/download/v1.2.0/NextGenUp-Windows-Setup.exe'
$UpstreamSha = '4ca06b720a6df1909cebd6f5c54c9f25de295a4c4f3294d59ca6638496669ea0'
$Marker = Join-Path $InstallDir 'nextgenup-zh-tw.json'
$Exe = Join-Path $InstallDir 'nextgenup.exe'
function Download([string]$Url, [string]$Path) {
    if (-not $Url.StartsWith('https://')) { throw '僅允許 HTTPS 下載。' }
    Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Path
}
function Health {
    try {
        $Cap = Invoke-RestMethod -Uri 'http://127.0.0.1:18790/api/capabilities' -TimeoutSec 3
        if ($Cap.distribution -eq $Flavor -and $Cap.ffmpeg -and $Cap.server_ai) { return $Cap }
    } catch { }
    return $null
}
if ($env:OS -ne 'Windows_NT') { throw '這支安裝程式適用於 Windows；Mac 請使用 install.sh。' }
if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') {
    throw '目前提供 Windows 10/11 x64 版本；Windows ARM 與 32 位元尚未支援。'
}
if ($Doctor) {
    if (-not (Test-Path $Marker) -or -not (Test-Path $Exe)) { throw '找不到此社群版安裝紀錄。' }
    $Cap = Health
    if (-not $Cap) { throw '程式尚未啟動，或本機 AI／FFmpeg 檢查未通過。' }
    $Cap | ConvertTo-Json
    Write-Host "安裝與啟動檢查通過：$Exe"
    exit 0
}
$Installed = $false
if (Test-Path $Marker) {
    $Record = Get-Content -Raw -Encoding UTF8 $Marker | ConvertFrom-Json
    if ($Record.release -eq $Tag) {
        foreach ($Name in @('nextgenup.exe', 'nextgenup-server.exe')) {
            $Expected = $Record.files.("payload/$Name")
            if ((Get-FileHash -Algorithm SHA256 (Join-Path $InstallDir $Name)).Hash.ToLower() -ne $Expected) {
                throw "已安裝檔案驗證失敗：$Name；請保留檔案並回報。"
            }
        }
        $Installed = $true
        Write-Host '此版本已安裝，準備啟動。'
    }
}
if (-not $Installed) {
    if ((Test-Path $InstallDir) -and -not (Test-Path $Marker)) {
        throw "目標位置有未受管理的程式，請選擇其他 -InstallDir：$InstallDir"
    }
    $Running = Get-Process -Name nextgenup, nextgenup-server -ErrorAction SilentlyContinue
    if ($Running) { throw '請先正常結束 NextGenUp，再重新安裝；不會強制停止處理中的工作。' }
    $Work = Join-Path ([IO.Path]::GetTempPath()) ('nextgenup-zh-' + [Guid]::NewGuid())
    New-Item -ItemType Directory $Work | Out-Null
    $Backup = ''
    $MutationStarted = $false
    try {
        $Name = "NextGenUp-zh-TW-$Tag-windows-x64.zip"
        $Zip = Join-Path $Work $Name
        $Sums = Join-Path $Work 'SHA256SUMS'
        if ($AssetDir) {
            Copy-Item (Join-Path $AssetDir $Name) $Zip
            Copy-Item (Join-Path $AssetDir 'SHA256SUMS') $Sums
        } else {
            Download "$Base/SHA256SUMS" $Sums
            Download "$Base/$Name" $Zip
        }
        $Rows = @(Get-Content $Sums | Where-Object { $_ -match ('^[0-9a-fA-F]{64}\s+' + [regex]::Escape($Name) + '$') })
        if ($Rows.Count -ne 1) { throw '發行版缺少唯一的 SHA-256 校驗碼。' }
        $Expected = ($Rows[0] -split '\s+')[0].ToLower()
        if ((Get-FileHash -Algorithm SHA256 $Zip).Hash.ToLower() -ne $Expected) { throw '繁體中文套件校驗失敗，未安裝。' }
        $Original = Join-Path $Work 'official-setup.exe'
        Download $UpstreamUrl $Original
        if ((Get-FileHash -Algorithm SHA256 $Original).Hash.ToLower() -ne $UpstreamSha) { throw '官方原版校驗失敗，未安裝。' }
        $Patch = Join-Path $Work 'patch'
        Expand-Archive $Zip $Patch
        $Record = Get-Content -Raw (Join-Path $Patch 'manifest.json') | ConvertFrom-Json
        if ($Record.target -ne 'windows-x64' -or $Record.release -ne $Tag) { throw '套件平台或版本不符。' }
        if (Test-Path $InstallDir) {
            $Backup = "$InstallDir-backup-$(Get-Date -Format yyyyMMdd-HHmmss)-$PID"
            Move-Item $InstallDir $Backup
        }
        $MutationStarted = $true
        # NSIS /D must be the final argument; current-user installer needs no admin rights.
        $Proc = Start-Process -FilePath $Original -ArgumentList "/S /D=$InstallDir" -Wait -PassThru
        if ($Proc.ExitCode -ne 0) { throw "官方安裝程式失敗，代碼：$($Proc.ExitCode)" }
        if (-not (Test-Path $Exe)) { throw "找不到安裝完成的主程式：$Exe" }
        Copy-Item (Join-Path $Patch 'payload\*') $InstallDir -Force
        Copy-Item (Join-Path $Patch 'manifest.json') $Marker
        Copy-Item (Join-Path $Patch 'LICENSE') (Join-Path $InstallDir 'LICENSE-NextGenUp')
        Copy-Item (Join-Path $Patch 'THIRD_PARTY_NOTICES.md') $InstallDir
        $Shell = New-Object -ComObject WScript.Shell
        $Shortcut = $Shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'NextGenUp 繁體中文版.lnk'))
        $Shortcut.TargetPath = $Exe
        $Shortcut.WorkingDirectory = $InstallDir
        $Shortcut.Save()
        Write-Host "繁體中文版已安裝：$Exe"
        if ($Backup) { Write-Host "上一版備份：$Backup" }
    } catch {
        if ($MutationStarted) {
            if (Test-Path $InstallDir) { Move-Item $InstallDir "$InstallDir-failed-$PID" }
            if ($Backup -and (Test-Path $Backup)) { Move-Item $Backup $InstallDir }
        }
        throw
    } finally {
        Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue
    }
}
if ($NoLaunch) { Write-Host '未要求啟動；尚未檢查執行中的引擎。'; exit 0 }
$Cap = Health
if ($Cap) { $Cap | ConvertTo-Json; Write-Host '程式已啟動，檢查通過。'; exit 0 }
try {
    $Other = Invoke-RestMethod -Uri 'http://127.0.0.1:18790/api/capabilities' -TimeoutSec 2
} catch { $Other = $null }
if ($Other) { throw '18790 埠已有其他版本，請正常結束原版 NextGenUp 後重新執行。' }
Start-Process -FilePath $Exe -WorkingDirectory $InstallDir
for ($Index = 0; $Index -lt 90; $Index++) {
    $Cap = Health
    if ($Cap) { $Cap | ConvertTo-Json; Write-Host "安裝並啟用完成：$Exe"; exit 0 }
    Start-Sleep -Seconds 2
}
throw '程式已安裝，但引擎未在 180 秒內就緒。請查看 SmartScreen／WebView2 或程式錯誤；不要回報啟用成功。'

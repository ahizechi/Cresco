param([Parameter(Mandatory)][ValidateSet('dev','build','test','check','lock')][string]$Action)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)

# Optional machine-local paths keep the project independent of any other checkout.
$localConfig = Join-Path $PSScriptRoot 'windows-toolchain.local.json'
if (Test-Path -LiteralPath $localConfig) {
    $toolchain = Get-Content -LiteralPath $localConfig -Raw | ConvertFrom-Json
    if ($toolchain.cargoHome) { $env:CARGO_HOME = $toolchain.cargoHome }
    if ($toolchain.rustupHome) { $env:RUSTUP_HOME = $toolchain.rustupHome }
}
$cargoBin = if ($env:CARGO_HOME) { Join-Path $env:CARGO_HOME 'bin' } else { Join-Path $env:USERPROFILE '.cargo\bin' }
if (Test-Path -LiteralPath (Join-Path $cargoBin 'cargo.exe')) { $env:PATH = "$cargoBin;$env:PATH" }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw 'Rust is missing. Install the stable MSVC toolchain from https://rustup.rs, then reopen the terminal.'
}
# AWS-LC's published x64 assembly objects avoid a separate NASM installation.
# An installed NASM still takes precedence; callers may explicitly disable this.
if (-not $env:AWS_LC_SYS_PREBUILT_NASM) { $env:AWS_LC_SYS_PREBUILT_NASM = '1' }
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (Test-Path -LiteralPath $vswhere) {
    $installation = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($installation) {
        $vcVars = Join-Path $installation 'VC\Auxiliary\Build\vcvars64.bat'
        cmd.exe /d /c "`"$vcVars`" >nul && set" | ForEach-Object {
            if ($_ -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') }
        }
    }
}
switch ($Action) {
    'lock' { & cargo generate-lockfile --manifest-path src-tauri/Cargo.toml }
    'dev' { & node_modules\.bin\tauri.cmd dev }
    'build' {
        & node_modules\.bin\tauri.cmd build --bundles nsis
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    'test' { & cargo test --locked --manifest-path src-tauri/Cargo.toml }
    'check' {
        & cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        & cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
    }
}
exit $LASTEXITCODE

# Post-sync script for Android (Windows PowerShell)
# Removes Transistorsoft plugin from Android build (it's iOS-only)
# Run after: npx cap sync android

$AndroidDir = "android"

if (-not (Test-Path $AndroidDir)) {
    Write-Host "⚠️  $AndroidDir not found. Run 'npx cap add android' first."
    exit 0
}

# 1. Remove Transistorsoft entries from settings.gradle
$SettingsFile = "$AndroidDir\settings.gradle"
if (Test-Path $SettingsFile) {
    $content = Get-Content $SettingsFile | Where-Object { $_ -notmatch "transistorsoft" }
    $content | Set-Content $SettingsFile
    Write-Host "[OK] Cleaned transistorsoft from $SettingsFile"
}

# 2. Remove Transistorsoft dependency from app/build.gradle
$AppGradle = "$AndroidDir\app\build.gradle"
if (Test-Path $AppGradle) {
    $content = Get-Content $AppGradle | Where-Object { $_ -notmatch "transistorsoft" }
    $content | Set-Content $AppGradle
    Write-Host "[OK] Cleaned transistorsoft from $AppGradle"
}

# 3. Remove Transistorsoft Maven repo from root build.gradle
$RootGradle = "$AndroidDir\build.gradle"
if (Test-Path $RootGradle) {
    $content = Get-Content $RootGradle | Where-Object { $_ -notmatch "transistorsoft" }
    $content | Set-Content $RootGradle
    Write-Host "[OK] Cleaned transistorsoft from $RootGradle"
}

# 4. Remove native module directories
$dirs = @(
    "$AndroidDir\transistorsoft-capacitor-background-geolocation",
    "$AndroidDir\transistorsoft-capacitor-background-fetch"
)
foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        Remove-Item -Recurse -Force $dir
        Write-Host "[OK] Removed $dir"
    }
}

Write-Host "[OK] Android build cleaned - Transistorsoft plugin removed (iOS-only)"

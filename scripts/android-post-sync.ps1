# Post-sync script for Android (Windows PowerShell)
# Removes Transistorsoft plugin from Android build (it's iOS-only)
# Run after: npx cap sync android

$AndroidDir = "android"

if (-not (Test-Path $AndroidDir)) {
    Write-Host "⚠️  $AndroidDir not found. Run 'npx cap add android' first."
    exit 0
}

function Remove-TransistorsoftLines {
    param(
        [string]$FilePath
    )

    if (-not (Test-Path $FilePath)) {
        return
    }

    $original = Get-Content $FilePath
    $cleaned = $original | Where-Object { $_ -notmatch "transistorsoft" }

    if ($cleaned.Count -ne $original.Count) {
        $cleaned | Set-Content $FilePath
        Write-Host "[OK] Cleaned transistorsoft from $FilePath"
    }
}

# 1. Remove Transistorsoft entries from Gradle files
$filesToClean = @(
    "$AndroidDir\settings.gradle",
    "$AndroidDir\build.gradle",
    "$AndroidDir\app\build.gradle",
    "$AndroidDir\app\capacitor.settings.gradle",
    "$AndroidDir\app\capacitor.build.gradle"
)

foreach ($file in $filesToClean) {
    Remove-TransistorsoftLines -FilePath $file
}

# 2. Remove native module directories
$dirs = @(
    "$AndroidDir\transistorsoft-capacitor-background-geolocation",
    "$AndroidDir\transistorsoft-capacitor-background-fetch",
    "$AndroidDir\app\transistorsoft-capacitor-background-geolocation",
    "$AndroidDir\app\transistorsoft-capacitor-background-fetch"
)

foreach ($dir in $dirs) {
    if (Test-Path $dir) {
        Remove-Item -Recurse -Force $dir
        Write-Host "[OK] Removed $dir"
    }
}

Write-Host "[OK] Android build cleaned - Transistorsoft plugin removed (iOS-only)"

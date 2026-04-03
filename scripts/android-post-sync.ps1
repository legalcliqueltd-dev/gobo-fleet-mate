# Post-sync script for Android (Windows PowerShell)
# Removes Transistorsoft plugin from Android build (it's iOS-only)
# Verifies @capacitor/geolocation plugin is preserved
# Run after: npx cap sync android

$AndroidDir = "android"

if (-not (Test-Path $AndroidDir)) {
    Write-Host "[WARN] $AndroidDir not found. Run 'npx cap add android' first."
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
    "$AndroidDir\app\capacitor.build.gradle",
    "$AndroidDir\capacitor.settings.gradle",
    "$AndroidDir\capacitor.build.gradle"
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

Write-Host ""
Write-Host "[OK] Android build cleaned - Transistorsoft plugin removed (iOS-only)"
Write-Host ""

# 3. Verify required Capacitor plugins are present
Write-Host "--- Plugin Verification ---"

function Verify-CapacitorPlugin {
    param(
        [string]$PluginName,
        [string]$PluginDirName,
        [string]$NpmPath
    )

    $pluginFound = $false

    $settingsFiles = @(
        "$AndroidDir\capacitor.settings.gradle",
        "$AndroidDir\app\capacitor.settings.gradle",
        "$AndroidDir\settings.gradle"
    )

    foreach ($file in $settingsFiles) {
        if (Test-Path $file) {
            $content = Get-Content $file -Raw
            if ($content -match $PluginDirName) {
                Write-Host "[OK] $PluginName plugin found in $file"
                $pluginFound = $true
            }
        }
    }

    $dir1 = "$AndroidDir\$PluginDirName"
    $dir2 = "$AndroidDir\app\$PluginDirName"
    if ((Test-Path $dir1) -or (Test-Path $dir2)) {
        Write-Host "[OK] $PluginName plugin native directory exists"
        $pluginFound = $true
    }

    if (Test-Path $NpmPath) {
        Write-Host "[OK] $PluginName Android source found in node_modules"
    } else {
        Write-Host "[WARN] $PluginName Android source NOT found in node_modules"
        Write-Host "       Run: npm install @capacitor/$($PluginDirName -replace 'capacitor-', '')"
    }

    if (-not $pluginFound) {
        Write-Host ""
        Write-Host "[WARN] $PluginName plugin NOT found in Gradle config!"
        Write-Host "       The plugin may not be registered. Try:"
        Write-Host "       1. Delete the android/ folder entirely"
        Write-Host "       2. Run: npx cap add android"
        Write-Host "       3. Run: npx cap sync android"
        Write-Host "       4. Run this script again"
    }
}

Verify-CapacitorPlugin -PluginName "Geolocation" -PluginDirName "capacitor-geolocation" -NpmPath "node_modules\@capacitor\geolocation\android"
Write-Host ""
Verify-CapacitorPlugin -PluginName "Camera" -PluginDirName "capacitor-camera" -NpmPath "node_modules\@capacitor\camera\android"

Write-Host ""
Write-Host "--- End Verification ---"

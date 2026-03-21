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

# 3. Verify @capacitor/geolocation plugin is present
Write-Host "--- Plugin Verification ---"

$geoPluginFound = $false

# Check capacitor.settings.gradle for geolocation include
$settingsFiles = @(
    "$AndroidDir\capacitor.settings.gradle",
    "$AndroidDir\app\capacitor.settings.gradle",
    "$AndroidDir\settings.gradle"
)

foreach ($file in $settingsFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        if ($content -match "capacitor-geolocation") {
            Write-Host "[OK] Geolocation plugin found in $file"
            $geoPluginFound = $true
        }
    }
}

# Check for the native plugin directory
$geoDir = "$AndroidDir\capacitor-geolocation"
$geoDir2 = "$AndroidDir\app\capacitor-geolocation"
if ((Test-Path $geoDir) -or (Test-Path $geoDir2)) {
    Write-Host "[OK] Geolocation plugin native directory exists"
    $geoPluginFound = $true
}

# Check node_modules for the plugin
$nodeGeo = "node_modules\@capacitor\geolocation\android"
if (Test-Path $nodeGeo) {
    Write-Host "[OK] @capacitor/geolocation Android source found in node_modules"
} else {
    Write-Host "[WARN] @capacitor/geolocation Android source NOT found in node_modules"
    Write-Host "       Run: npm install @capacitor/geolocation"
}

if (-not $geoPluginFound) {
    Write-Host ""
    Write-Host "[WARN] Geolocation plugin NOT found in Gradle config!"
    Write-Host "       The plugin may not be registered. Try:"
    Write-Host "       1. Delete the android/ folder entirely"
    Write-Host "       2. Run: npx cap add android"
    Write-Host "       3. Run: npx cap sync android"
    Write-Host "       4. Run this script again"
}

Write-Host ""
Write-Host "--- End Verification ---"

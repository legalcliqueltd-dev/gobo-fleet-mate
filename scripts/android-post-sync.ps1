# Post-sync script for Android (Windows PowerShell)
# Removes Transistorsoft plugin from Android build (it's iOS-only)
# Verifies @capacitor/geolocation and @capacitor/camera plugins are preserved
# Run after: npx cap sync android

$AndroidDir = "android"

if (-not (Test-Path $AndroidDir)) {
    Write-Host "[WARN] $AndroidDir not found. Run 'npx cap add android' first."
    exit 0
}

Write-Host "=== Android Post-Sync Cleanup ==="
Write-Host ""

# 1. Remove ALL Transistorsoft native module directories (recursive search)
Write-Host "--- Step 1: Remove Transistorsoft directories ---"
Get-ChildItem -Path $AndroidDir -Directory -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match "transistorsoft" } |
    ForEach-Object {
        Remove-Item -Recurse -Force $_.FullName
        Write-Host "[OK] Removed directory: $($_.FullName)"
    }

# 2. Clean ALL Gradle files of transistorsoft references
Write-Host ""
Write-Host "--- Step 2: Clean Gradle files ---"

Get-ChildItem -Path $AndroidDir -File -Recurse -Include "*.gradle","*.gradle.kts" -ErrorAction SilentlyContinue |
    ForEach-Object {
        $filePath = $_.FullName
        $original = Get-Content $filePath
        $cleaned = $original | Where-Object { $_ -notmatch "transistorsoft" }

        if ($cleaned.Count -ne $original.Count) {
            $cleaned | Set-Content $filePath
            $removed = $original.Count - $cleaned.Count
            Write-Host "[OK] Removed $removed transistorsoft line(s) from $filePath"
        }
    }

Write-Host ""
Write-Host "[OK] Transistorsoft cleanup complete (iOS-only plugin)"
Write-Host ""

# 3. Verify required Capacitor plugins are present
Write-Host "--- Step 3: Plugin Verification ---"

function Verify-CapacitorPlugin {
    param(
        [string]$PluginName,
        [string]$PluginDirName,
        [string]$NpmPath
    )

    $pluginFound = $false

    # Search all gradle files for the plugin reference
    Get-ChildItem -Path $AndroidDir -File -Recurse -Include "*.gradle","*.gradle.kts" -ErrorAction SilentlyContinue |
        ForEach-Object {
            $content = Get-Content $_.FullName -Raw
            if ($content -match $PluginDirName) {
                Write-Host "[OK] $PluginName registered in $($_.FullName)"
                $pluginFound = $true
            }
        }

    if (Test-Path $NpmPath) {
        Write-Host "[OK] $PluginName Android source found in node_modules"
    } else {
        Write-Host "[WARN] $PluginName Android source NOT found in node_modules"
    }

    if (-not $pluginFound) {
        Write-Host "[WARN] $PluginName plugin NOT found in any Gradle config!"
        Write-Host "       Try: delete android/, then 'npx cap add android' + 'npx cap sync android'"
    }

    Write-Host ""
}

Verify-CapacitorPlugin -PluginName "Geolocation" -PluginDirName "capacitor-geolocation" -NpmPath "node_modules\@capacitor\geolocation\android"
Verify-CapacitorPlugin -PluginName "Camera" -PluginDirName "capacitor-camera" -NpmPath "node_modules\@capacitor\camera\android"

Write-Host "=== Done ==="

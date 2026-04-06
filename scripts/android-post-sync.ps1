# Post-sync script for Android (Windows PowerShell)
# Removes Transistorsoft plugin from Android build (it's iOS-only)
# Verifies @capacitor/geolocation and @capacitor/camera plugins are preserved
# Ensures AndroidManifest.xml has required permissions and features
# Run after: npx cap sync android

$AndroidDir = "android"

if (-not (Test-Path $AndroidDir)) {
    Write-Host "[WARN] $AndroidDir not found. Run 'npx cap add android' first."
    exit 0
}

if ((-not (Test-Path "$AndroidDir\gradlew")) -or (-not (Test-Path "$AndroidDir\app\src\main\AndroidManifest.xml"))) {
    Write-Host "[ERROR] Android platform is incomplete."
    Write-Host "        Missing gradlew or app/src/main/AndroidManifest.xml."
    Write-Host "        Delete android/ and run: npx cap add android"
    exit 1
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

$GeneratedConfig = "$AndroidDir\app\src\main\assets\capacitor.config.json"
if (Test-Path $GeneratedConfig) {
    $generatedConfigText = Get-Content $GeneratedConfig -Raw
    if ($generatedConfigText -match '"server"') {
        Write-Host "[ERROR] Generated capacitor.config.json still contains a server block."
        Write-Host "        Native Geolocation can fail when Android loads remote assets instead of bundled dist files."
        Write-Host "        Remove server.url from capacitor.config.ts and sync again."
        exit 1
    }
}

$ManifestPath = "$AndroidDir\app\src\main\AndroidManifest.xml"

# Check if manifest is suspiciously minimal
$manifestLines = (Get-Content $ManifestPath).Count
if ($manifestLines -lt 5) {
    Write-Host "[WARN] AndroidManifest.xml looks suspiciously minimal ($manifestLines lines)."
    Write-Host "       This may cause runtime permission errors even if permissions appear present."
}

function Ensure-ManifestPermission {
    param([string]$Permission)

    $manifestText = Get-Content $ManifestPath -Raw
    if ($manifestText -match [regex]::Escape($Permission)) {
        Write-Host "[OK] AndroidManifest.xml already includes $Permission"
        return
    }

    $updatedManifest = $manifestText -replace '<application', "    <uses-permission android:name=`"$Permission`" />`r`n<application"
    Set-Content -Path $ManifestPath -Value $updatedManifest
    Write-Host "[OK] Added $Permission to AndroidManifest.xml"
}

function Ensure-ManifestFeature {
    param([string]$Feature)

    $manifestText = Get-Content $ManifestPath -Raw
    if ($manifestText -match [regex]::Escape($Feature)) {
        Write-Host "[OK] AndroidManifest.xml already includes uses-feature $Feature"
        return
    }

    $updatedManifest = $manifestText -replace '<application', "    <uses-feature android:name=`"$Feature`" android:required=`"false`" />`r`n<application"
    Set-Content -Path $ManifestPath -Value $updatedManifest
    Write-Host "[OK] Added uses-feature $Feature to AndroidManifest.xml"
}

Write-Host "--- Step 3: Manifest Permission Check ---"
Ensure-ManifestPermission -Permission "android.permission.ACCESS_COARSE_LOCATION"
Ensure-ManifestPermission -Permission "android.permission.ACCESS_FINE_LOCATION"
Ensure-ManifestFeature -Feature "android.hardware.location.gps"
Write-Host ""

# 4. Verify required Capacitor plugins are present
Write-Host "--- Step 4: Plugin Verification ---"

function Verify-CapacitorPlugin {
    param(
        [string]$PluginName,
        [string]$PluginDirName,
        [string]$NpmPath
    )

    $pluginFound = $false

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
Write-Host ""
Write-Host "IMPORTANT: Always use 'npm run cap:sync:android' instead of plain 'npx cap sync android'"
Write-Host "           to ensure this post-sync script runs automatically."

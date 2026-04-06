import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const errors = [];
const warnings = [];
const oks = [];

const rel = (...parts) => path.join(root, ...parts);
const exists = (...parts) => fs.existsSync(rel(...parts));
const readText = (...parts) => fs.readFileSync(rel(...parts), 'utf8');

const requiredFiles = [
  ['android', 'gradlew'],
  ['android', 'app', 'src', 'main', 'AndroidManifest.xml'],
  ['android', 'capacitor.settings.gradle'],
  ['android', 'app', 'capacitor.build.gradle'],
  ['android', 'app', 'src', 'main', 'assets', 'capacitor.config.json'],
  ['android', 'app', 'src', 'main', 'assets', 'capacitor.plugins.json'],
];

for (const parts of requiredFiles) {
  const relativePath = parts.join('/');
  if (exists(...parts)) {
    oks.push(`${relativePath} exists`);
  } else {
    errors.push(`${relativePath} is missing`);
  }
}

if (exists('android', 'app', 'src', 'main', 'assets', 'capacitor.config.json')) {
  try {
    const generatedConfig = JSON.parse(readText('android', 'app', 'src', 'main', 'assets', 'capacitor.config.json'));

    if (generatedConfig.server?.url) {
      errors.push(
        `Generated Android config still has server.url=${generatedConfig.server.url}. Native Geolocation and Camera can fail when Android loads remote assets instead of bundled dist files.`
      );
    } else {
      oks.push('Generated Android config uses bundled local assets');
    }
  } catch (error) {
    errors.push(`Failed to parse android/app/src/main/assets/capacitor.config.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (exists('android', 'app', 'src', 'main', 'assets', 'capacitor.plugins.json')) {
  try {
    const plugins = JSON.parse(readText('android', 'app', 'src', 'main', 'assets', 'capacitor.plugins.json'));
    const hasGeolocation = plugins.some(
      (plugin) => plugin?.pkg === '@capacitor/geolocation' && plugin?.classpath === 'com.capacitorjs.plugins.geolocation.GeolocationPlugin'
    );
    const hasCamera = plugins.some(
      (plugin) => plugin?.pkg === '@capacitor/camera' && plugin?.classpath === 'com.capacitorjs.plugins.camera.CameraPlugin'
    );

    if (!hasGeolocation) {
      errors.push('capacitor.plugins.json is missing the Geolocation plugin entry');
    } else {
      oks.push('capacitor.plugins.json includes the Geolocation plugin');
    }

    if (!hasCamera) {
      warnings.push('capacitor.plugins.json is missing the Camera plugin entry');
    } else {
      oks.push('capacitor.plugins.json includes the Camera plugin');
    }
  } catch (error) {
    errors.push(`Failed to parse android/app/src/main/assets/capacitor.plugins.json: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (exists('android', 'app', 'src', 'main', 'AndroidManifest.xml')) {
  const manifest = readText('android', 'app', 'src', 'main', 'AndroidManifest.xml');
  const manifestLines = manifest.split('\n').filter(l => l.trim()).length;

  // Warn if manifest looks suspiciously minimal
  if (manifestLines < 5) {
    warnings.push(`AndroidManifest.xml looks suspiciously minimal (${manifestLines} non-empty lines). This may cause runtime permission errors.`);
  }

  if (manifest.includes('android.permission.ACCESS_COARSE_LOCATION')) {
    oks.push('AndroidManifest.xml includes ACCESS_COARSE_LOCATION');
  } else {
    errors.push('AndroidManifest.xml is missing android.permission.ACCESS_COARSE_LOCATION');
  }

  if (manifest.includes('android.permission.ACCESS_FINE_LOCATION')) {
    oks.push('AndroidManifest.xml includes ACCESS_FINE_LOCATION');
  } else {
    errors.push('AndroidManifest.xml is missing android.permission.ACCESS_FINE_LOCATION');
  }

  if (manifest.includes('android.hardware.location.gps')) {
    oks.push('AndroidManifest.xml includes uses-feature android.hardware.location.gps');
  } else {
    warnings.push('AndroidManifest.xml is missing uses-feature android.hardware.location.gps (recommended)');
  }
}

if (exists('android', 'capacitor.settings.gradle')) {
  const settingsGradle = readText('android', 'capacitor.settings.gradle');

  if (settingsGradle.includes("include ':capacitor-geolocation'")) {
    oks.push('capacitor.settings.gradle includes capacitor-geolocation');
  } else {
    errors.push('capacitor.settings.gradle is missing capacitor-geolocation');
  }

  if (settingsGradle.includes("transistorsoft-capacitor-background-geolocation")) {
    warnings.push('Transistorsoft Android plugin is still referenced in capacitor.settings.gradle');
  }
}

if (exists('android', 'app', 'capacitor.build.gradle')) {
  const appCapacitorGradle = readText('android', 'app', 'capacitor.build.gradle');

  if (appCapacitorGradle.includes("implementation project(':capacitor-geolocation')")) {
    oks.push('app/capacitor.build.gradle depends on capacitor-geolocation');
  } else {
    errors.push('app/capacitor.build.gradle is missing the capacitor-geolocation dependency');
  }

  if (appCapacitorGradle.includes('transistorsoft-capacitor-background-geolocation')) {
    warnings.push('Transistorsoft Android plugin is still referenced in app/capacitor.build.gradle');
  }
}

console.log('=== Android Platform Verification ===');

for (const ok of oks) {
  console.log(`[OK] ${ok}`);
}

for (const warning of warnings) {
  console.warn(`[WARN] ${warning}`);
}

if (errors.length > 0) {
  console.error('');
  console.error('Root cause detected: Android native setup is incomplete or incompatible with native plugin loading.');
  for (const error of errors) {
    console.error(`[ERROR] ${error}`);
  }
  console.error('');
  console.error('Recommended recovery steps:');
  console.error('1. Uninstall the app from the device/emulator');
  console.error('2. Delete the android/ folder completely (keep a backup of local.properties if needed)');
  console.error('3. Run: npx cap add android');
  console.error('4. Run: npm run build');
  console.error('5. Run: npm run cap:sync:android');
  console.error('6. Open Android Studio and rebuild the native app');
  process.exit(1);
}

console.log('');
console.log('Android native platform looks valid for Geolocation plugin loading.');
console.log('');
console.log('REMINDER: Always use "npm run cap:sync:android" instead of plain "npx cap sync android".');

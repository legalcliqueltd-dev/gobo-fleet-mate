import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDriverNative = process.env.VITE_BUILD_TARGET === "driver-native";

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: [
        // Build-time switch: when VITE_BUILD_TARGET=driver-native, the iOS / Android
        // bundle loads the slim NativeApp (driver routes only) instead of the full
        // App (which includes admin, marketing, and subscription surfaces). This is
        // what keeps Stripe / Paystack / APK / "Upgrade to Pro" strings out of the
        // native bundle, the basis for App Store guideline 3.1.3(f).
        // The longer, more specific alias must come first so it takes precedence
        // over the generic "@" alias.
        {
          find: "app-entry",
          replacement: path.resolve(
            __dirname,
            isDriverNative ? "./src/NativeApp.tsx" : "./src/App.tsx"
          ),
        },
        { find: "@", replacement: path.resolve(__dirname, "./src") },
      ],
    },
    build: {
      rollupOptions: {
        external: [
          '@capawesome-team/capacitor-android-foreground-service',
          '@transistorsoft/capacitor-background-geolocation',
          '@transistorsoft/capacitor-background-fetch',
        ],
      },
    },
  };
});

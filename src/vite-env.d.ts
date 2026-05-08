/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BUILD_TARGET?: 'driver-native';
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

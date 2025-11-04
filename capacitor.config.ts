import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d78756af7da0400ebb464b099b10699b',
  appName: 'gobo-fleet-mate',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://d78756af-7da0-400e-bb46-4b099b10699b.lovableproject.com?forceHideBadge=true',
    cleartext: true,
    androidScheme: 'https'
  }
};

export default config;

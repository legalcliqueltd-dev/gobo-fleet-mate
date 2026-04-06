import { isAndroid, detectNativePlatform } from '@/utils/platformDetection';

let foregroundServiceModule: any = null;

const loadForegroundService = async () => {
  if (foregroundServiceModule) return foregroundServiceModule;
  try {
    foregroundServiceModule = await import('@capawesome-team/capacitor-android-foreground-service');
    return foregroundServiceModule;
  } catch (e) {
    console.warn('[ForegroundService] Plugin not available:', e);
    return null;
  }
};

export const startAndroidForegroundService = async (): Promise<boolean> => {
  if (!detectNativePlatform() || !isAndroid()) {
    console.log('[ForegroundService] Not native Android, skipping');
    return false;
  }

  try {
    const mod = await loadForegroundService();
    if (!mod?.ForegroundService) {
      console.warn('[ForegroundService] Plugin not loaded');
      return false;
    }

    const { ForegroundService } = mod;

    await ForegroundService.startForegroundService({
      id: 1001,
      title: 'FleetTrackMate',
      body: 'Location tracking active',
      smallIcon: 'ic_stat_directions_car',
      buttons: [
        {
          title: 'Stop',
          id: 1,
        },
      ],
    });

    console.log('[ForegroundService] Started successfully');
    return true;
  } catch (error) {
    console.error('[ForegroundService] Failed to start:', error);
    return false;
  }
};

export const stopAndroidForegroundService = async (): Promise<void> => {
  if (!detectNativePlatform() || !isAndroid()) return;

  try {
    const mod = await loadForegroundService();
    if (!mod?.ForegroundService) return;

    const { ForegroundService } = mod;
    await ForegroundService.stopForegroundService();
    console.log('[ForegroundService] Stopped');
  } catch (error) {
    console.error('[ForegroundService] Failed to stop:', error);
  }
};

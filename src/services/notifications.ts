import { detectNativePlatform, isAndroid } from '@/utils/platformDetection';

/**
 * On-device notifications with their own alert sound.
 *
 * SCOPE, stated plainly: these are LOCAL notifications. They fire from code
 * running in this app, so they reach the user when the app is foregrounded or
 * backgrounded — a new job arriving while the driver is on another screen, a
 * station still outstanding at the end of a shift.
 *
 * They cannot wake a device for something that happened on the server while
 * the app was closed. An SOS reaching a sleeping manager's phone needs Firebase
 * Cloud Messaging: a Firebase project, google-services.json, and a server key
 * so the backend can push. That is owner setup plus an edge function, and is
 * deliberately not faked here — a notification that silently never arrives is
 * worse than none, because it gets trusted.
 *
 * ANDROID CHANNEL CAVEAT: from Android 8, sound is bound to a channel at
 * creation and is immutable afterwards. Changing the sound later means
 * creating a NEW channel id — editing the existing one does nothing, silently.
 * Hence the version suffix on the ids below: bump it to change a sound.
 */

export type NotificationChannel = 'alerts' | 'jobs' | 'reminders';

/** Bump the suffix when a channel's sound changes; Android ignores edits. */
const CHANNELS: Record<
  NotificationChannel,
  { id: string; name: string; description: string; sound?: string; importance: 1 | 2 | 3 | 4 | 5 }
> = {
  alerts: {
    id: 'ftm_alerts_v1',
    name: 'Emergencies',
    description: 'SOS alerts from drivers — the ones you must not miss',
    sound: 'alert.wav',
    importance: 5,
  },
  jobs: {
    id: 'ftm_jobs_v1',
    name: 'Jobs and stations',
    description: 'New work assigned to you, and stops still outstanding',
    sound: 'chime.wav',
    importance: 4,
  },
  reminders: {
    id: 'ftm_reminders_v1',
    name: 'Reminders',
    description: 'Low battery, unsent receipts, sync problems',
    importance: 3,
  },
};

type LocalNotificationsPlugin = {
  requestPermissions: () => Promise<{ display: string }>;
  checkPermissions: () => Promise<{ display: string }>;
  createChannel: (channel: Record<string, unknown>) => Promise<void>;
  schedule: (options: { notifications: Record<string, unknown>[] }) => Promise<unknown>;
};

let pluginBox: Promise<{ plugin: LocalNotificationsPlugin | null }> | null = null;
let channelsReady = false;

/**
 * Boxed for the same reason as the social-login plugin: resolving a promise
 * WITH a Capacitor proxy makes the runtime probe it for `.then`, which the
 * proxy forwards to a native method that does not exist.
 */
function loadPlugin(): Promise<{ plugin: LocalNotificationsPlugin | null }> {
  if (!pluginBox) {
    pluginBox = import('@capacitor/local-notifications')
      .then((mod) => ({
        plugin: (mod?.LocalNotifications as unknown as LocalNotificationsPlugin) ?? null,
      }))
      .catch((err) => {
        console.warn('[notifications] plugin unavailable:', err);
        return { plugin: null };
      });
  }
  return pluginBox;
}

/** Ask once, and tell the caller whether alerts can actually be delivered. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!detectNativePlatform()) return false;
  const { plugin } = await loadPlugin();
  if (!plugin) return false;

  try {
    const existing = await plugin.checkPermissions();
    if (existing.display === 'granted') return true;
    const asked = await plugin.requestPermissions();
    return asked.display === 'granted';
  } catch (err) {
    console.warn('[notifications] permission request failed:', err);
    return false;
  }
}

/** Create the Android channels. No-op on iOS, where sound is per-notification. */
async function ensureChannels(plugin: LocalNotificationsPlugin): Promise<void> {
  if (channelsReady || !isAndroid()) return;

  await Promise.allSettled(
    Object.values(CHANNELS).map((channel) =>
      plugin.createChannel({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        importance: channel.importance,
        sound: channel.sound,
        vibration: true,
        visibility: 1,
      })
    )
  );
  channelsReady = true;
}

/**
 * Fire a notification now.
 *
 * Failures are swallowed: a missed notification must never take down the
 * screen that triggered it.
 */
export async function notify(
  channel: NotificationChannel,
  title: string,
  body: string,
  extra?: { id?: number }
): Promise<void> {
  if (!detectNativePlatform()) return;

  const { plugin } = await loadPlugin();
  if (!plugin) return;

  try {
    await ensureChannels(plugin);
    const config = CHANNELS[channel];

    await plugin.schedule({
      notifications: [
        {
          // A stable-ish id keeps repeat alerts from stacking endlessly.
          id: extra?.id ?? Math.floor(Date.now() % 2147483647),
          title,
          body,
          channelId: config.id,
          // iOS takes the sound per notification; Android ignores this in
          // favour of the channel's sound.
          sound: config.sound,
          smallIcon: 'ic_stat_directions_car',
        },
      ],
    });
  } catch (err) {
    console.warn('[notifications] could not post notification:', err);
  }
}

/** True when the device will actually show what we post. */
export async function notificationsEnabled(): Promise<boolean> {
  if (!detectNativePlatform()) return false;
  const { plugin } = await loadPlugin();
  if (!plugin) return false;
  try {
    return (await plugin.checkPermissions()).display === 'granted';
  } catch {
    return false;
  }
}

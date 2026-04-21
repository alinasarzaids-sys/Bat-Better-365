import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure foreground notification behaviour
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface ScheduledSession {
  id: string;
  title: string;
  session_date: string;   // 'YYYY-MM-DD'
  session_time: string;   // 'HH:MM' 24-hr
  location?: string;
}

/**
 * Request notification permissions. Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('training', {
      name: 'Training Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
      sound: 'default',
    });
  }
  return status === 'granted';
}

/**
 * Cancel all previously scheduled training notifications for this academy,
 * then re-schedule from the given session list.
 *
 * We tag each notification with an identifier that includes the session id so we
 * can cancel them individually or in bulk.
 *
 * Two notifications per session:
 *  1. Morning-of  → 8:00 AM on the training day
 *  2. 5-min-prior → 5 minutes before session_time
 */
export async function scheduleTrainingNotifications(sessions: ScheduledSession[]): Promise<void> {
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  // Cancel all existing scheduled notifications first so we don't duplicate
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = new Date();

  for (const session of sessions) {
    const [year, month, day] = session.session_date.split('-').map(Number);
    const [hour, minute] = (session.session_time || '10:00').split(':').map(Number);

    // ── 1. Morning-of notification (8:00 AM on training day) ──────────────────
    const morningTrigger = new Date(year, month - 1, day, 8, 0, 0);
    if (morningTrigger > now) {
      await Notifications.scheduleNotificationAsync({
        identifier: `training_morning_${session.id}`,
        content: {
          title: 'Training Day!',
          body: `${session.title} is scheduled for today${session.location ? ` at ${session.location}` : ''}. Get ready!`,
          sound: 'default',
          data: { sessionId: session.id, type: 'morning' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: morningTrigger,
          channelId: Platform.OS === 'android' ? 'training' : undefined,
        } as Notifications.DateTriggerInput,
      });
    }

    // ── 2. 5-minutes-before notification ─────────────────────────────────────
    const sessionStart = new Date(year, month - 1, day, hour, minute, 0);
    const fiveMinBefore = new Date(sessionStart.getTime() - 5 * 60 * 1000);
    if (fiveMinBefore > now) {
      const h12 = hour % 12 || 12;
      const period = hour >= 12 ? 'PM' : 'AM';
      const timeStr = `${h12}:${String(minute).padStart(2, '0')} ${period}`;
      await Notifications.scheduleNotificationAsync({
        identifier: `training_5min_${session.id}`,
        content: {
          title: 'Starting in 5 minutes!',
          body: `${session.title} starts at ${timeStr}${session.location ? ` · ${session.location}` : ''}. Warm up now!`,
          sound: 'default',
          data: { sessionId: session.id, type: '5min' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fiveMinBefore,
          channelId: Platform.OS === 'android' ? 'training' : undefined,
        } as Notifications.DateTriggerInput,
      });
    }
  }
}

/**
 * Cancel all scheduled training notifications (e.g. on logout or academy leave).
 */
export async function cancelAllTrainingNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Given a session's date and time strings, compute how many minutes
 * remain until it starts. Negative = already started/past.
 */
export function minutesUntilSession(session_date: string, session_time: string): number {
  const [year, month, day] = session_date.split('-').map(Number);
  const [hour, minute] = (session_time || '10:00').split(':').map(Number);
  const sessionStart = new Date(year, month - 1, day, hour, minute, 0);
  return (sessionStart.getTime() - Date.now()) / 60000;
}

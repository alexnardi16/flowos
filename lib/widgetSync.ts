import { Platform } from 'react-native';
import { buildTodayGlance } from './widgetData';
import { logNotificationEvent } from './notificationLog';
import type { Commitment } from '../types';

/**
 * Pushes the latest snapshot to the iOS home-screen widget via expo-widgets.
 * No-op on Android/web for now — see docs/IMPLEMENTATION_STATUS.md for the
 * Android widget plan (react-native-android-widget, not yet implemented).
 *
 * IMPORTANT: this has only been typechecked, never built or rendered — there
 * is no Xcode/macOS in the environment this was written in. Verify with a
 * real development build (`eas build --profile development --platform ios`,
 * or `npx expo run:ios` on a Mac) before relying on it.
 */
export async function syncTodayWidget(commitments: Commitment[], now: Date = new Date()) {
  if (Platform.OS !== 'ios') return;
  try {
    const { default: TodayWidget } = await import('../widgets/TodayWidget');
    const glance = buildTodayGlance(commitments, now);
    TodayWidget.updateSnapshot(glance);
    await logNotificationEvent('today-widget-updated', { dateKey: glance.dateKey });
  } catch (error) {
    // Widget module isn't linked yet (Expo Go, or a build that predates the
    // widget target) — never let this break the rest of the sync flow.
    await logNotificationEvent('today-widget-update-failed', error, 'warn');
  }
}

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('flowos-reminders', {
      name: 'FlowOS reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleCommitmentNotification(title: string, date: Date) {
  const allowed = await requestNotificationPermission();
  if (!allowed || date.getTime() <= Date.now()) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title: 'FlowOS', body: title, data: { source: 'commitment' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

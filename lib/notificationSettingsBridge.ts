import { Platform } from 'react-native';

async function nativeBackgroundService() {
  if (Platform.OS === 'web') return null;
  return import('./backgroundSyncService');
}

export async function registerBackgroundSync() {
  const service = await nativeBackgroundService();
  if (service) await service.registerBackgroundSync();
}

export async function unregisterBackgroundSync() {
  const service = await nativeBackgroundService();
  if (service) await service.unregisterBackgroundSync();
}

export async function runDailySummaryRefresh() {
  const service = await nativeBackgroundService();
  if (!service) return null;
  return service.runDailySummaryRefresh();
}

export async function checkAndRecoverMissedDailySummary() {
  const service = await nativeBackgroundService();
  if (service) await service.checkAndRecoverMissedDailySummary();
}

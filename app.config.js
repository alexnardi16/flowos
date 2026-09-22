const fs = require('fs');

function resolveGoogleServicesFile() {
  const easFile = process.env.GOOGLE_SERVICES_JSON;
  if (easFile) return easFile;

  const localFile = './google-services.json';
  if (fs.existsSync(localFile)) return localFile;

  if (process.env.EAS_BUILD === '1') {
    throw new Error('GOOGLE_SERVICES_JSON is required for EAS Android builds. Upload google-services.json as an EAS file environment variable.');
  }

  return undefined;
}

const googleServicesFile = resolveGoogleServicesFile();
const androidVersionCode = Number(process.env.FLOWOS_ANDROID_VERSION_CODE || 2);

module.exports = {
  name: 'FlowOS',
  slug: 'flowos',
  owner: 'alex16nardi',
  version: '1.0.0',
  description: 'Unifica task ed eventi con reminder locali associabili a ciascuna attività.',
  icon: './assets/flowos-app-icon-512-store.png',
  orientation: 'portrait',
  scheme: 'flowos',
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'appVersion' },
  updates: {
    url: 'https://u.expo.dev/95803fab-e55e-48a0-8e48-f8b504f6aeac',
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
  },
  extra: {
    eas: { projectId: '95803fab-e55e-48a0-8e48-f8b504f6aeac' },
    // Supabase publishable client configuration is safe to ship in the app binary.
    // Keeping it in Expo config also makes production GitHub/Gradle builds independent
    // of shell-only EXPO_PUBLIC_* environment variables.
    supabaseUrl: 'https://inifmdkbefwynupqspfr.supabase.co',
    supabasePublishableKey: 'sb_publishable_NVhKrBvwGti3noXCXUP6SQ_8ulIzVhf',
  },
  plugins: [
    'expo-router',
    'expo-web-browser',
    './plugins/withNativeAccessJvmArgs.js',
    './plugins/withSingleTaskMainActivity.js',
    ['expo-notifications', { defaultChannel: 'flowos-reminders', enableBackgroundRemoteNotifications: true }],
    'expo-task-manager',
    'expo-background-task',
    ['expo-widgets', { widgets: [{ name: 'TodayWidget', displayName: 'FlowOS Oggi', description: 'Tutte le attività previste per oggi.', supportedFamilies: ['systemSmall', 'systemMedium'] }] }],
    ['react-native-android-widget', { widgets: [
      { name: 'TodayAndroidWidget', label: 'FlowOS Oggi', description: 'Tutte le attività di oggi.', minWidth: '320dp', minHeight: '180dp', targetCellWidth: 4, targetCellHeight: 3, resizeMode: 'horizontal|vertical', updatePeriodMillis: 1800000 },
      { name: 'CalendarAndroidWidget', label: 'FlowOS Calendario', description: 'Agenda FlowOS per le prossime settimane.', minWidth: '320dp', minHeight: '260dp', targetCellWidth: 4, targetCellHeight: 5, resizeMode: 'horizontal|vertical', updatePeriodMillis: 1800000 }
    ] }],
  ],
  experiments: { typedRoutes: true },
  web: { bundler: 'metro', output: 'static' },
  android: {
    package: 'com.alexnardi.flowos',
    icon: './assets/flowos-app-icon-512-store.png',
    versionCode: androidVersionCode,
    permissions: ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM'],
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
  ios: {
    bundleIdentifier: 'com.alexnardi.flowos',
    buildNumber: '3',
    infoPlist: {
      UIBackgroundModes: ['processing'],
      BGTaskSchedulerPermittedIdentifiers: ['com.expo.modules.backgroundtask.processing'],
    },
  },
};

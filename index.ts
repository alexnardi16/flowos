import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // Keep the Android-only native module out of web/iOS startup.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { widgetTaskHandler } = require('./widget-task-handler') as typeof import('./widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}

import 'expo-router/entry';

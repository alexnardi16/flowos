import { Platform } from 'react-native';

declare const require: (moduleName: string) => any;

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}

import 'expo-router/entry';

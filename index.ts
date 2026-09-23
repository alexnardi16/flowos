import { Platform } from 'react-native';
import './lib/googlePushSync';
import './lib/widgetQuickAdd';

declare const require: (moduleName: string) => any;

if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}

import 'expo-router/entry';

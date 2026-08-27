import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  void import('react-native-android-widget').then(({ registerWidgetTaskHandler }) =>
    import('./widget-task-handler').then(({ widgetTaskHandler }) => registerWidgetTaskHandler(widgetTaskHandler)),
  );
}

import 'expo-router/entry';

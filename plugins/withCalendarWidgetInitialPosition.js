const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * react-native-android-widget currently exposes no initial collection position.
 * Patch its generated native implementation so CalendarAndroidWidget opens at
 * the current week while retaining chronological rows in the adapter.
 */
module.exports = function withCalendarWidgetInitialPosition(config) {
  return withDangerousMod(config, ['android', async (config) => {
    const javaPath = path.join(
      config.modRequest.projectRoot,
      'node_modules',
      'react-native-android-widget',
      'android',
      'src',
      'main',
      'java',
      'com',
      'reactnativeandroidwidget',
      'RNWidget.java'
    );

    if (!fs.existsSync(javaPath)) {
      throw new Error('Calendar widget native patch could not find RNWidget.java');
    }

    let source = fs.readFileSync(javaPath, 'utf8');
    const marker = 'private Intent createCollectionRemoteAdapterIntent(';
    if (!source.includes(marker)) {
      throw new Error('Calendar widget native patch: collection adapter method not found');
    }

    const returnMarker = '        return intent;\n    }\n';
    const positionCode = `        // Only the calendar collection supplies week=YYYY-MM-DD.
        // Other widgets retain the library default scroll position.
        int initialScrollPosition = -1;
        java.util.Calendar today = java.util.Calendar.getInstance();
        int daysSinceMonday = (today.get(java.util.Calendar.DAY_OF_WEEK) + 5) % 7;
        today.add(java.util.Calendar.DAY_OF_MONTH, -daysSinceMonday);
        today.set(java.util.Calendar.HOUR_OF_DAY, 0);
        today.set(java.util.Calendar.MINUTE, 0);
        today.set(java.util.Calendar.SECOND, 0);
        today.set(java.util.Calendar.MILLISECOND, 0);
        String currentWeek = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
            .format(today.getTime());
        for (int itemIndex = 0; itemIndex < collectionItems.size(); itemIndex++) {
            Bundle itemBundle = collectionItems.get(itemIndex);
            Bundle clickData = itemBundle.getBundle("clickActionData");
            String itemUri = clickData == null ? null : clickData.getString("uri");
            if (itemUri == null) continue;
            Uri parsedUri = Uri.parse(itemUri);
            if (!parsedUri.getQueryParameterNames().contains("week")) continue;
            if (currentWeek.equals(parsedUri.getQueryParameter("week"))) {
                initialScrollPosition = itemIndex;
                break;
            }
        }
        intent.putExtra("flowosInitialScrollPosition", initialScrollPosition);

`;
    if (!source.includes('flowosInitialScrollPosition')) {
      const methodStart = source.indexOf(marker);
      const returnAt = source.indexOf(returnMarker, methodStart);
      if (returnAt < 0) throw new Error('Calendar widget native patch: adapter return point not found');
      source = source.slice(0, returnAt) + positionCode + source.slice(returnAt);
    }

    const adapterCall = '        remoteWidgetView.setRemoteAdapter(lists[collectionId], remoteAdapterIntent);';
    const scrollCall = `        remoteWidgetView.setRemoteAdapter(lists[collectionId], remoteAdapterIntent);
        int initialScrollPosition = remoteAdapterIntent.getIntExtra("flowosInitialScrollPosition", -1);
        if (initialScrollPosition >= 0) {
            remoteWidgetView.setScrollPosition(lists[collectionId], initialScrollPosition);
        }`;
    if (!source.includes('remoteWidgetView.setScrollPosition(lists[collectionId], initialScrollPosition)')) {
      if (!source.includes(adapterCall)) throw new Error('Calendar widget native patch: setRemoteAdapter call not found');
      source = source.replace(adapterCall, scrollCall);
    }

    fs.writeFileSync(javaPath, source);
    return config;
  }]);
};

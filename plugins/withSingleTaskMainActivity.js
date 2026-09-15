const { withAndroidManifest } = require('expo/config-plugins');

/**
 * OAuth callbacks arrive through the flowos:// deep link. Keep the existing
 * Android activity alive and deliver the callback to it instead of letting
 * Android create a second FlowOS activity/task.
 */
module.exports = function withSingleTaskMainActivity(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    const mainActivity = application?.activity?.find((activity) => {
      const name = activity?.$?.['android:name'];
      return name === '.MainActivity' || name === 'com.alexnardi.flowos.MainActivity' || name?.endsWith('.MainActivity');
    });

    if (mainActivity) {
      mainActivity.$ = mainActivity.$ ?? {};
      mainActivity.$['android:launchMode'] = 'singleTask';
    }

    return config;
  });
};

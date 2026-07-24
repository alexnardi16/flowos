const { withGradleProperties } = require('@expo/config-plugins');

const NATIVE_ACCESS_FLAG = '--enable-native-access=ALL-UNNAMED';

/**
 * JDK 22+ restricts JNI-style native access by default, which makes Gradle's
 * CMake configuration tasks for native modules (expo-updates,
 * react-native-worklets) fail outright rather than just warn — the error
 * shown is the bare "WARNING: A restricted method in java.lang.System has
 * been called" line with no further detail. Appending this flag to
 * org.gradle.jvmargs (rather than replacing it) re-enables native access
 * without touching the existing heap-size settings Expo's template sets.
 * Runs on every `expo prebuild`, so it survives the android/ directory being
 * regenerated — this can't be fixed by hand-editing gradle.properties once.
 */
module.exports = function withNativeAccessJvmArgs(config) {
  return withGradleProperties(config, (config) => {
    const jvmArgsEntry = config.modResults.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs',
    );

    if (jvmArgsEntry && jvmArgsEntry.type === 'property') {
      if (!jvmArgsEntry.value.includes(NATIVE_ACCESS_FLAG)) {
        jvmArgsEntry.value = `${jvmArgsEntry.value} ${NATIVE_ACCESS_FLAG}`;
      }
    } else {
      config.modResults.push({
        type: 'property',
        key: 'org.gradle.jvmargs',
        value: NATIVE_ACCESS_FLAG,
      });
    }

    return config;
  });
};

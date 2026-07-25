const { withGradleProperties } = require('@expo/config-plugins');

const NATIVE_ACCESS_FLAG = '--enable-native-access=ALL-UNNAMED';

function upsertProperty(modResults, key, value, { append = false } = {}) {
  const entry = modResults.find((item) => item.type === 'property' && item.key === key);
  if (entry && entry.type === 'property') {
    if (append) {
      if (!entry.value.includes(value)) entry.value = `${entry.value} ${value}`;
    } else {
      entry.value = value;
    }
  } else {
    modResults.push({ type: 'property', key, value });
  }
}

/**
 * Two unrelated Gradle build-environment fixes bundled together because
 * both only matter on memory/JDK-constrained machines (like a default
 * GitHub Codespace) and both have to be re-applied on every `expo prebuild`
 * since android/gradle.properties is regenerated each time:
 *
 * 1. JDK 22+ restricts JNI-style native access by default, which makes
 *    Gradle's CMake configuration tasks for native modules (expo-updates,
 *    react-native-worklets) fail outright rather than just warn — the error
 *    shown is the bare "WARNING: A restricted method in java.lang.System
 *    has been called" line with no further detail. Appending this flag to
 *    org.gradle.jvmargs (rather than replacing it) re-enables native access
 *    without touching the existing heap-size settings Expo's template sets.
 *
 * 2. On a memory-constrained build machine, running a separate Kotlin
 *    compile daemon process *alongside* the Gradle daemon (the default)
 *    routinely gets one of the two OOM-killed by the OS mid-build — shows
 *    up as "Connection to the Kotlin daemon has been unexpectedly lost" or
 *    "Gradle build daemon disappeared unexpectedly". Forcing the Kotlin
 *    compiler to run in-process (inside the Gradle daemon's own JVM,
 *    instead of spawning a second one) and capping Gradle's worker
 *    parallelism trades a bit of build speed for a much smaller peak memory
 *    footprint — the right trade on a small Codespace. Harmless on a bigger
 *    machine, just slightly slower.
 */
module.exports = function withNativeAccessJvmArgs(config) {
  return withGradleProperties(config, (config) => {
    upsertProperty(config.modResults, 'org.gradle.jvmargs', NATIVE_ACCESS_FLAG, { append: true });
    upsertProperty(config.modResults, 'kotlin.compiler.execution.strategy', 'in-process');
    upsertProperty(config.modResults, 'org.gradle.workers.max', '1');
    upsertProperty(config.modResults, 'org.gradle.parallel', 'false');
    return config;
  });
};

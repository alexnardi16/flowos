const { withGradleProperties } = require('expo/config-plugins');

const NATIVE_ACCESS_FLAG = '--enable-native-access=ALL-UNNAMED';
const GRADLE_JVM_ARGS = '-Xmx4g -XX:MaxMetaspaceSize=1g -Dfile.encoding=UTF-8';

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
 * Build-environment fixes for CI/local EAS builds:
 *
 * 1. JDK 22+ restricts JNI-style native access by default. Append the flag
 *    to org.gradle.jvmargs so native modules can configure CMake normally.
 *
 * 2. The default Gradle daemon memory is too small for this Expo/RN 0.86
 *    application. The build previously exhausted the 512 MiB Metaspace limit
 *    during release lint analysis, leaving the daemon repeatedly restarting.
 *    Give the Gradle daemon 4 GiB heap and 1 GiB Metaspace.
 *
 * 3. Run Kotlin compilation in-process and cap Gradle workers to keep peak
 *    memory usage predictable on GitHub-hosted runners.
 */
module.exports = function withNativeAccessJvmArgs(config) {
  return withGradleProperties(config, (config) => {
    upsertProperty(config.modResults, 'org.gradle.jvmargs', `${GRADLE_JVM_ARGS} ${NATIVE_ACCESS_FLAG}`);
    upsertProperty(config.modResults, 'kotlin.compiler.execution.strategy', 'in-process');
    upsertProperty(config.modResults, 'org.gradle.workers.max', '1');
    upsertProperty(config.modResults, 'org.gradle.parallel', 'false');
    return config;
  });
};

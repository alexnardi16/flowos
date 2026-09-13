import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';

const appVersion = Constants.expoConfig?.version ?? 'unknown';
const versionCode = Constants.nativeBuildVersion ?? (Constants.expoConfig?.android?.versionCode != null ? String(Constants.expoConfig.android.versionCode) : 'unknown');
const releaseTag = process.env.EXPO_PUBLIC_FLOWOS_RELEASE_TAG ?? 'local';
const commitSha = process.env.EXPO_PUBLIC_FLOWOS_COMMIT_SHA ?? 'unknown';

export function BuildInfo() {
  return (
    <View pointerEvents="none" style={styles.container}>
      <Text selectable style={styles.text}>
        FlowOS {appVersion} · versionCode {versionCode} · Release {releaseTag}
      </Text>
      <Text selectable style={styles.text}>
        commit {commitSha}
      </Text>
    </View>
  );
}

export function getBuildInfo() {
  return {
    appVersion,
    versionCode,
    releaseTag,
    commitSha,
  };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 4,
    alignItems: 'center',
    zIndex: 9999,
  },
  text: {
    fontSize: 9,
    lineHeight: 12,
    color: '#666',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
});

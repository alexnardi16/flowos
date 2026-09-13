import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';

const appVersion = Constants.expoConfig?.version ?? 'unknown';
const versionCode = Constants.expoConfig?.android?.versionCode;
const releaseTag = process.env.EXPO_PUBLIC_FLOWOS_RELEASE_TAG ?? 'local';
const commitSha = process.env.EXPO_PUBLIC_FLOWOS_COMMIT_SHA ?? 'unknown';
const commitShort = commitSha !== 'unknown' ? commitSha.slice(0, 12) : commitSha;

export function BuildInfo() {
  return (
    <View pointerEvents="none" style={styles.container}>
      <Text selectable style={styles.text}>
        FlowOS {appVersion}{versionCode != null ? ` (${versionCode})` : ''} · Release {releaseTag} · commit {commitShort}
      </Text>
    </View>
  );
}

export function getBuildInfo() {
  return {
    appVersion,
    versionCode: versionCode ?? null,
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
    paddingVertical: 2,
    borderRadius: 4,
  },
});

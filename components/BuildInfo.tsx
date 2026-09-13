import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';
import { FLOWOS_BUILD } from '../lib/generatedBuildInfo';

const appVersion = Constants.expoConfig?.version ?? 'unknown';
const versionCode = Constants.nativeBuildVersion ?? (Constants.expoConfig?.android?.versionCode != null ? String(Constants.expoConfig.android.versionCode) : 'unknown');

export function getBuildInfo() {
  return {
    appVersion,
    versionCode,
    releaseTag: FLOWOS_BUILD.releaseTag,
    commitSha: FLOWOS_BUILD.commitSha,
  };
}

export function BuildInfo({ inline = false }: { inline?: boolean }) {
  const info = getBuildInfo();
  return (
    <View pointerEvents="none" style={inline ? styles.inlineContainer : styles.container}>
      <Text selectable style={styles.text}>
        FlowOS {info.appVersion} · versionCode {info.versionCode} · Release {info.releaseTag}
      </Text>
      <Text selectable style={styles.text}>
        commit {info.commitSha}
      </Text>
    </View>
  );
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
  inlineContainer: {
    alignItems: 'flex-start',
    marginTop: 12,
    marginBottom: 4,
  },
  text: {
    fontSize: 9,
    lineHeight: 12,
    color: '#666',
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
});

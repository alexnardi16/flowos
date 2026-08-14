import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dismissSnackbar, subscribeSnackbar, type SnackbarState } from '@/lib/snackbar';
import { palette } from '@/components/ui';

export function SnackbarHost() {
  const [state, setState] = useState<SnackbarState>(null);
  useEffect(() => subscribeSnackbar(setState), []);
  if (!state) return null;

  return <View pointerEvents="box-none" style={styles.overlay}>
    <View style={styles.bar}>
      <Text style={styles.message} numberOfLines={2}>{state.message}</Text>
      {state.actionLabel && state.onAction ? (
        <Pressable onPress={() => { state.onAction?.(); dismissSnackbar(); }} style={styles.action}>
          <Text style={styles.actionText}>{state.actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 88, alignItems: 'center', paddingHorizontal: 16 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: palette.ink, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, maxWidth: 520, width: '100%' },
  message: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '700' },
  action: { paddingHorizontal: 4 },
  actionText: { color: palette.soft, fontSize: 14, fontWeight: '900', textTransform: 'uppercase' },
});

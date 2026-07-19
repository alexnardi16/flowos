import { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, palette } from '@/components/ui';
import { interpretCommitment } from '@/lib/ai';
import { useFlowStore } from '@/lib/store';

export default function Capture() {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const addCommitment = useFlowStore((state) => state.addCommitment);

  async function organize() {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const commitment = await interpretCommitment(text.trim());
      await addCommitment(commitment);
      setSaved(true);
      setText('');
    } catch (error) {
      Alert.alert('Non riesco a organizzare questa intenzione', error instanceof Error ? error.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.wrap}>
        <Text style={styles.title}>Cosa vuoi ottenere?</Text>
        <Text style={styles.sub}>Scrivilo come ti viene. L’IA organizza il resto.</Text>
        <Card>
          <TextInput
            value={text}
            onChangeText={(value) => { setText(value); setSaved(false); }}
            multiline
            autoFocus
            placeholder="Es. Martedì alle 15 riunione con Marco, devo preparare il budget prima"
            style={styles.input}
          />
          <Button label={loading ? 'Sto organizzando…' : 'Organizza con l’IA'} onPress={() => { void organize(); }} />
        </Card>
        {saved && <Card><Text style={styles.saved}>✓ Intenzione interpretata, salvata e inserita nel piano</Text></Card>}
        <Text style={styles.hint}>FlowOS usa l’IA reale quando Supabase è configurato; in assenza di connessione passa automaticamente al parser locale e sincronizza in seguito.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  wrap: { padding: 20, gap: 16 },
  title: { fontSize: 31, fontWeight: '900', color: palette.ink, marginTop: 14 },
  sub: { fontSize: 16, color: palette.muted },
  input: { minHeight: 170, fontSize: 18, lineHeight: 26, color: palette.ink, textAlignVertical: 'top', marginBottom: 16 },
  saved: { fontWeight: '800', color: palette.success },
  hint: { fontSize: 13, lineHeight: 19, color: palette.muted },
});

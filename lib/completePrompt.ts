import { Alert } from 'react-native';
import type { Commitment } from '@/types';
import { t } from '@/lib/i18n';

export type CompletionScope = 'occurrence' | 'series';
type CompleteAction = (id: string, scope?: CompletionScope) => Promise<void>;

export function requestComplete(item: Commitment, complete: CompleteAction) {
  const recurring = Boolean(item.recurrenceRule || item.recurrenceSeriesId || item.googleRecurringEventId);
  if (!recurring) {
    void complete(item.id, 'occurrence');
    return;
  }
  Alert.alert(
    t('Completare attività?'),
    t('Scegli se completare solo questa occorrenza o tutta la serie.'),
    [
      { text: t('Annulla'), style: 'cancel' },
      { text: t('Solo questa occorrenza'), onPress: () => { void complete(item.id, 'occurrence'); } },
      { text: t('Tutta la serie'), style: 'destructive', onPress: () => { void complete(item.id, 'series'); } },
    ],
  );
}

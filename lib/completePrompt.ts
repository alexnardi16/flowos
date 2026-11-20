import { Alert } from 'react-native';
import type { Commitment } from '@/types';
import { t } from '@/lib/i18n';
import { isMultiDayActivity } from '@/lib/commitmentVisibility';

export type CompletionScope = 'occurrence' | 'series' | 'duration';
type CompleteAction = (id: string, scope?: CompletionScope) => Promise<void>;

export function requestComplete(item: Commitment, complete: CompleteAction) {
  const recurring = Boolean(item.recurrenceRule || item.recurrenceSeriesId || item.googleRecurringEventId);
  if (isMultiDayActivity(item)) {
    Alert.alert(t('Completare attività?'),t('Vuoi completare questa attività solo per oggi o per tutti i giorni della sua durata?'),[
      { text: t('Annulla'), style: 'cancel' },
      { text: t('Solo oggi'), onPress: () => { void complete(item.id, 'occurrence'); } },
      { text: t('Tutti i giorni'), style: 'destructive', onPress: () => { void complete(item.id, 'duration'); } },
    ]);
    return;
  }
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

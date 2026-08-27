import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { TodayWidget, type AndroidTodayWidgetProps } from './widgets/android/TodayWidget';

const STORAGE_KEY = 'flowos-store-v2';

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function todayItems(raw: string | null): AndroidTodayWidgetProps {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    const commitments = Array.isArray(parsed?.state?.commitments) ? parsed.state.commitments : [];
    const now = new Date();
    const items = commitments
      .filter((item: any) => item && item.status !== 'done' && !item.deletedAt)
      .map((item: any) => ({ item, date: item.scheduledAt ?? item.dueAt }))
      .filter(({ item, date }: any) => {
        if (!date) return false;
        const d = new Date(date);
        return item.allDay
          ? d.getUTCFullYear() === now.getFullYear() && d.getUTCMonth() === now.getMonth() && d.getUTCDate() === now.getDate()
          : dateKey(d) === dateKey(now);
      })
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(({ item, date }: any) => ({
        id: item.id,
        title: item.title,
        time: item.allDay ? 'Tutto il giorno' : new Date(date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        kind: item.kind === 'event' ? 'Evento' : item.kind === 'task' ? 'Task' : 'Reminder',
      }));
    const overdueCount = commitments.filter((item: any) => item && item.status !== 'done' && item.dueAt && new Date(item.dueAt).getTime() < now.getTime()).length;
    return { items, overdueCount };
  } catch {
    return { items: [], overdueCount: 0 };
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== 'TodayAndroidWidget') return;
  const data = todayItems(await AsyncStorage.getItem(STORAGE_KEY));
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(<TodayWidget {...data} />);
      break;
    case 'WIDGET_CLICK':
      // ✓ and Apri use OPEN_URI/OPEN_APP, so Android performs the navigation
      // without requiring the JS process to stay alive.
      props.renderWidget(<TodayWidget {...data} />);
      break;
    default:
      break;
  }
}

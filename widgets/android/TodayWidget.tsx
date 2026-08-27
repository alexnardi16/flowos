import React from 'react';
import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';

export type AndroidWidgetItem = { id: string; title: string; time: string; kind: string };
export type AndroidTodayWidgetProps = { items: AndroidWidgetItem[]; overdueCount: number };

export function TodayWidget({ items, overdueCount }: AndroidTodayWidgetProps) {
  const visible = items.slice(0, 4);
  return <FlexWidget style={{ width: 'match_parent', height: 'match_parent', padding: 14, backgroundColor: '#F7F8FC', borderRadius: 20, flexDirection: 'column' }} clickAction="OPEN_APP" accessibilityLabel="FlowOS: attività di oggi">
    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <TextWidget text="Oggi" style={{ fontSize: 20, fontWeight: 'bold', color: '#172033' }} />
      <TextWidget text={overdueCount ? `${overdueCount} in ritardo` : 'FlowOS'} style={{ fontSize: 11, color: overdueCount ? '#B42318' : '#5B6475' }} />
    </FlexWidget>
    <ListWidget style={{ width: 'match_parent', height: 'match_parent', marginTop: 8, backgroundColor: '#F7F8FC' }}>
      {visible.length ? visible.map((item) => <FlexWidget key={item.id} style={{ width: 'match_parent', height: 48, flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
        <FlexWidget style={{ width: 'match_parent', height: 'match_parent', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} clickAction="OPEN_URI" clickActionData={{ uri: `flowos://today?widgetAction=complete&id=${encodeURIComponent(item.id)}` }}>
            <TextWidget text="✓" style={{ fontSize: 17, color: '#1D7A55', width: 26 }} />
            <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
              <TextWidget text={item.title} style={{ fontSize: 13, fontWeight: 'bold', color: '#172033', maxLines: 1 }} />
              <TextWidget text={`${item.time} · ${item.kind}`} style={{ fontSize: 10, color: '#697386' }} />
            </FlexWidget>
          </FlexWidget>
          <FlexWidget style={{ width: 48, height: 34, justifyContent: 'center', alignItems: 'center' }} clickAction="OPEN_APP">
            <TextWidget text="Apri" style={{ fontSize: 10, fontWeight: 'bold', color: '#4254C5' }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>) : <FlexWidget style={{ width: 'match_parent', height: 60, justifyContent: 'center' }}><TextWidget text="Nessuna attività in programma" style={{ fontSize: 13, color: '#697386' }} /></FlexWidget>}
    </ListWidget>
  </FlexWidget>;
}

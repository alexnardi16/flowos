import React from 'react';
import { FlexWidget, ImageWidget, ListWidget, TextWidget } from 'react-native-android-widget';

export type AndroidCalendarItem = { id: string; title: string; time: string; sourceColor: any; priority?: number };
export type AndroidCalendarDay = { dateKey: string; label: string; isToday: boolean; items: AndroidCalendarItem[] };
export type AndroidCalendarWeek = { title: string; days: AndroidCalendarDay[] };
export type AndroidCalendarWidgetProps = { weeks: AndroidCalendarWeek[]; heightDp?: number };

const BG = '#F1F4FF';
const INK = '#172033';
const MUTED = '#697386';
const PRIMARY = '#4254C5';
const BORDER = '#C8CEDA';

function capitalizeMonthTitle(value: string) {
  const [month, ...year] = value.split(' ');
  return month ? `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year.join(' ')}` : value;
}

function titleLines(text: string, maxChars = 12) {
  const clean = text.trim();
  if (!clean) return [''];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

const ITEM_TIME_HEIGHT = 9;
const ITEM_TITLE_LINE_HEIGHT = 9;
const ITEM_PADDING = 7;
const DAY_HEADER_HEIGHT = 11;
const ITEM_GAP = 3;

function itemHeight(item: AndroidCalendarItem) {
  const lines = titleLines(item.title).length;
  const timeHeight = item.time ? ITEM_TIME_HEIGHT : 0;
  return ITEM_PADDING + timeHeight + lines * ITEM_TITLE_LINE_HEIGHT + 2;
}

function dayHeight(day: AndroidCalendarDay) {
  const itemsHeight = day.items.reduce((total, item) => total + itemHeight(item), 0);
  const gaps = Math.max(0, day.items.length - 1) * ITEM_GAP;
  return Math.max(92, DAY_HEADER_HEIGHT + itemsHeight + gaps + 4);
}

function weekHeight(week: AndroidCalendarWeek) {
  return Math.max(92, ...week.days.map(day => dayHeight(day)));
}

export function CalendarWidget({ weeks }: AndroidCalendarWidgetProps) {
  return (
    <FlexWidget
      style={{ width: 'match_parent', height: 'match_parent', padding: 8, backgroundColor: BG, borderRadius: 20, flexDirection: 'column' }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'flowos://calendar' }}
      accessibilityLabel="FlowOS: calendario"
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 5 }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flex:1 }}>
          <ImageWidget image={require("../../assets/flowos-app-icon-512-store.png")} imageWidth={26} imageHeight={26} style={{ width:26, height:26, marginRight:7 }} radius={7} resizeMode="contain" />
          <TextWidget text="Calendario" style={{ fontSize: 19, fontWeight: 'bold', color: INK }} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <FlexWidget style={{ width: 30, height: 26, marginRight: 4, borderRadius: 13, backgroundColor: '#DDE2FF', justifyContent: 'center', alignItems: 'center' }} clickAction="SYNC_GOOGLE" accessibilityLabel="Sincronizza FlowOS e Google">
            <TextWidget text="↻" style={{ fontSize: 16, fontWeight: 'bold', color: INK }} />
          </FlexWidget>
          <FlexWidget style={{ width: 30, height: 26, borderRadius: 13, backgroundColor: '#DDE2FF', justifyContent: 'center', alignItems: 'center' }} clickAction="VOICE_COMMAND" accessibilityLabel="Comando vocale">
            <TextWidget text="🎙" style={{ fontSize: 14 }} />
          </FlexWidget>
          <FlexWidget style={{ height: 26, paddingHorizontal: 9, borderRadius: 13, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center' }} clickAction="QUICK_ADD">
            <TextWidget text="+" style={{ fontSize: 10, fontWeight: 'bold', color: '#FFFFFF' }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      <ListWidget style={{ width: 'match_parent', height: 'match_parent', backgroundColor: BG }}>
        {weeks.slice(0, 8).map(week => {
          const height = weekHeight(week);
          return (
            <FlexWidget key={`${week.title}-${week.days[0]?.dateKey}`} style={{ width: 'match_parent', flexDirection: 'column', marginVertical: 2 }}>
              {week.title ? <TextWidget text={capitalizeMonthTitle(week.title)} style={{ fontSize: 10, fontWeight: 'bold', color: PRIMARY, marginBottom: 3 }} /> : null}
              <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'flex-start' }}>
                {Array.from({ length: 7 }, (_, index) => week.days[index] ?? {
                  dateKey: `${week.title}-${index}`,
                  label: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'][index],
                  isToday: false,
                  items: [],
                }).map(day => (
                  <FlexWidget
                    key={day.dateKey}
                    clickAction="OPEN_URI"
                    clickActionData={{ uri: `flowos://calendar?date=${day.dateKey}` }}
                    accessibilityLabel={`Apri ${day.label}`}
                    style={{ width: 0, flex: 1, height, marginHorizontal: 1, padding: 2, borderRadius: 7, borderWidth: 1, borderColor: BORDER, backgroundColor: day.isToday ? '#E8ECFF' : '#FFFFFF', flexDirection: 'column' }}
                  >
                    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
                      <TextWidget text={day.label} style={{ fontSize: 8, fontWeight: 'bold', color: day.isToday ? PRIMARY : MUTED }} />
                    </FlexWidget>
                    {day.items.map(item => {
                      const lines = titleLines(item.title);
                      return (
                        <FlexWidget key={item.id} style={{ width: 'match_parent', height: itemHeight(item), marginTop: 3, padding: 2, borderRadius: 5, borderWidth: 1, borderColor: '#D9DDE7', backgroundColor: item.sourceColor, flexDirection: 'column' }}>
                          {item.time ? <TextWidget text={item.time} style={{ fontSize: 5, lineHeight: ITEM_TIME_HEIGHT, fontWeight: 'bold', color: MUTED }} /> : null}
                          <FlexWidget style={{ width:'match_parent', flexDirection:'row', alignItems:'flex-start' }}>
                            {item.priority ? <TextWidget text={String(item.priority)} style={{ width:8, fontSize: 5, lineHeight: ITEM_TITLE_LINE_HEIGHT, fontWeight: 'bold', color: PRIMARY }} /> : null}
                            <FlexWidget style={{ flex:1, flexDirection:'column' }}>
                              {lines.map((line, index) => (
                                <TextWidget key={`${item.id}-line-${index}`} text={line} style={{ fontSize: 5, lineHeight: ITEM_TITLE_LINE_HEIGHT, fontWeight: 'bold', color: INK }} />
                              ))}
                            </FlexWidget>
                          </FlexWidget>
                        </FlexWidget>
                      );
                    })}
                    {!day.items.length ? <TextWidget text="·" style={{ fontSize: 9, color: '#B8BFCC', marginTop: 3 }} /> : null}
                  </FlexWidget>
                ))}
              </FlexWidget>
            </FlexWidget>
          );
        })}
        <FlexWidget style={{ width: 'match_parent', height: 40 }} />
      </ListWidget>
    </FlexWidget>
  );
}

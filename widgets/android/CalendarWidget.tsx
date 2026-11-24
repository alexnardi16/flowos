import React from 'react';
import { widgetStrings, type Language } from '../../lib/i18n';
import { FlexWidget, ImageWidget, ListWidget, TextWidget } from 'react-native-android-widget';

export type AndroidCalendarItem = { id: string; title: string; kind:string; time: string; duration?: string; sourceColor: any; priority?: number; multiDaySegment?: 'start'|'middle'|'end' };
export type AndroidCalendarDay = { dateKey: string; label: string; isToday: boolean; items: AndroidCalendarItem[] };
export type AndroidCalendarWeek = { title: string; days: AndroidCalendarDay[] };
export type AndroidCalendarWidgetProps = { weeks: AndroidCalendarWeek[]; hasOlderWeeks?: boolean; hasNewerWeeks?: boolean; isLoading?: boolean; loadingProgress?: number; language?: Language; backgroundColor?: string; textColor?: string; buttonBackgroundColor?: string; buttonTextColor?: string; density?: 'comfortable'|'balanced'|'compact'; borderColor?:string; surfaceColor?:string; todaySurfaceColor?:string; activeNavigation?:'older'|'newer'|null };

const BG = '#F1F4FF';
const INK = '#172033';
const PRIMARY = '#6658D3';
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
const ITEM_DURATION_HEIGHT = 7;
const ITEM_TITLE_LINE_HEIGHT = 9;
const ITEM_VERTICAL_PADDING = 2;
const DAY_HEADER_HEIGHT = 11;
const ITEM_GAP = 3;
const WEEK_BOTTOM_PADDING = 10;
function itemTitleLines(item: AndroidCalendarItem) {
  // Reserve horizontal space for the priority badge before calculating title wrapping.
  return titleLines(item.title, item.priority ? 10 : 12);
}

function itemHeight(item: AndroidCalendarItem,density:'comfortable'|'balanced'|'compact'='balanced') {
  const compact=density==='compact',comfortable=density==='comfortable';
  const lines=itemTitleLines(item).length;
  const timeHeight=item.time?(compact?7:comfortable?11:ITEM_TIME_HEIGHT):0;
  const durationHeight=item.duration?(compact?6:comfortable?9:ITEM_DURATION_HEIGHT):0;
  const titleLine=compact?7:comfortable?12:ITEM_TITLE_LINE_HEIGHT;
  const vertical=compact?1:comfortable?3:ITEM_VERTICAL_PADDING;
  return vertical*2+timeHeight+durationHeight+lines*titleLine+6;
}

function dayHeight(day: AndroidCalendarDay,density:'comfortable'|'balanced'|'compact'='balanced') {
  const itemsHeight=day.items.reduce((total,item)=>total+itemHeight(item,density),0);
  const gaps=Math.max(0,day.items.length-1)*(density==='compact'?2:density==='comfortable'?4:ITEM_GAP);
  return Math.max(density==='compact'?76:density==='comfortable'?112:92,DAY_HEADER_HEIGHT+itemsHeight+gaps+WEEK_BOTTOM_PADDING);
}

function weekHeight(week: AndroidCalendarWeek,density:'comfortable'|'balanced'|'compact'='balanced') {
  return Math.max(density==='compact'?76:density==='comfortable'?112:92,...week.days.map(day=>dayHeight(day,density)));
}

export function CalendarWidget({ weeks, hasOlderWeeks=false, hasNewerWeeks=false, isLoading=false, loadingProgress=0, language='it', backgroundColor=BG, textColor=INK, buttonBackgroundColor=PRIMARY, buttonTextColor='#FFFFFF', density='balanced', borderColor=BORDER, surfaceColor='#FFFFFF', todaySurfaceColor='#E8ECFF', activeNavigation=null }: AndroidCalendarWidgetProps) {
  const labels=widgetStrings(language);
  return (
    <FlexWidget
      style={{ width: 'match_parent', height: 'match_parent', padding: 8, backgroundColor:backgroundColor as any, borderRadius: 20, flexDirection: 'column' }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'flowos://calendar' }}
      accessibilityLabel="FlowOS: calendario"
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 5 }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flex:1 }}>
          <ImageWidget image={require("../../assets/flowos-app-icon-512-store.png")} imageWidth={26} imageHeight={26} style={{ width:26, height:26, marginRight:7 }} radius={7} resizeMode="contain" />
          <TextWidget text={labels.calendar} style={{ fontSize: 19, fontWeight: 'bold', color: textColor as any }} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <FlexWidget style={{ width: 30, height: 26, paddingHorizontal: 0, marginRight: 4, borderRadius: 13, backgroundColor: buttonBackgroundColor as any, justifyContent: 'center', alignItems: 'center' }} clickAction="CALENDAR_PAGE_TODAY" accessibilityLabel={labels.today}><TextWidget text={labels.today} style={{ fontSize: 9, fontWeight: 'bold', color: buttonTextColor as any }} /></FlexWidget>
          <FlexWidget style={{ width: 30, height: 26, marginRight: 4, borderRadius: 13, backgroundColor: buttonBackgroundColor as any, justifyContent: 'center', alignItems: 'center' }} clickAction="SYNC_GOOGLE" accessibilityLabel={labels.sync}>
            <TextWidget text="↻" style={{ fontSize: 18, fontWeight: 'bold', color: buttonTextColor as any }} />
          </FlexWidget>
          <FlexWidget style={{ width: 30, height: 26, marginRight: 4, borderRadius: 13, backgroundColor: buttonBackgroundColor as any, justifyContent: 'center', alignItems: 'center' }} clickAction="OPEN_URI" clickActionData={{ uri:'flowos://capture?voice=1' }} accessibilityLabel={labels.voice}>
            <TextWidget text="🎙" style={{ fontSize: 13, fontWeight: 'bold', color: buttonTextColor as any }} />
          </FlexWidget>
          <FlexWidget style={{ width: 30, height: 26, paddingHorizontal: 0, borderRadius: 13, backgroundColor: buttonBackgroundColor as any, justifyContent: 'center', alignItems: 'center' }} clickAction="OPEN_URI" clickActionData={{ uri:'flowos://capture' }}>
            <TextWidget text="+" style={{ fontSize: 20, fontWeight: 'bold', color: buttonTextColor as any }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      <ListWidget style={{ width: 'match_parent', height: 'match_parent', backgroundColor: backgroundColor as any }}>
        {isLoading ? <FlexWidget style={{ width: 'match_parent', height: 16, flexDirection: 'row', alignItems: 'center', marginVertical: 2 }}><FlexWidget style={{ flex: 1, height: 5, backgroundColor: '#D9DFF8', borderRadius: 3, flexDirection: 'row' }}><FlexWidget style={{ flex: Math.max(1, loadingProgress), height: 5, backgroundColor: PRIMARY, borderRadius: 3 }} /><FlexWidget style={{ flex: Math.max(1, 100 - loadingProgress), height: 5 }} /></FlexWidget><TextWidget text={`${Math.round(loadingProgress)}%`} style={{ width: 32, marginLeft: 6, fontSize: 9, fontWeight: 'bold', color: PRIMARY }} /></FlexWidget> : null}
        {hasOlderWeeks || activeNavigation==='older' ? <FlexWidget clickAction="CALENDAR_PAGE_OLDER" style={{ width:'match_parent', height:28, flexDirection:'row', alignItems:'center', justifyContent:'center', backgroundColor:activeNavigation==='older'?buttonTextColor as any:buttonBackgroundColor as any, borderColor:activeNavigation==='older'?buttonBackgroundColor as any:'transparent', borderWidth:activeNavigation==='older'?2:0, borderRadius:8, marginVertical:2 }}><TextWidget text={`← ${labels.olderWeeks}`} style={{ fontSize:10, fontWeight:'bold', color:activeNavigation==='older'?buttonBackgroundColor as any:buttonTextColor as any }} /></FlexWidget> : null}
        {weeks.map(week => {
          const height = weekHeight(week,density); const weekContainerHeight = height + (week.title ? 14 : 0) + 4 + WEEK_BOTTOM_PADDING;
          return (
            <FlexWidget key={`${week.title}-${week.days[0]?.dateKey}`} style={{ width: 'match_parent', height: weekContainerHeight, flexDirection: 'column', marginVertical: 2 }}>
              {week.title ? <TextWidget text={capitalizeMonthTitle(week.title)} style={{ fontSize: 10, fontWeight: 'bold', color: PRIMARY, marginBottom: 3 }} /> : null}
              <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'flex-start' }}>
                {Array.from({ length: 7 }, (_, index) => week.days[index] ?? {
                  dateKey: `${week.title}-${index}`,
                  label: labels.dayNames[index],
                  isToday: false,
                  items: [],
                }).map(day => (
                  <FlexWidget
                    key={day.dateKey}
                    accessibilityLabel={`Giorno ${day.label}`}
                    style={{ width: 0, flex: 1, height, marginHorizontal: 1, padding: 2, borderRadius: 7, borderWidth: day.isToday ? 2 : 1, borderColor: day.isToday ? buttonBackgroundColor as any : borderColor as any, backgroundColor: day.isToday ? todaySurfaceColor as any : surfaceColor as any, flexDirection: 'column' }}
                  >
                    <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center' }} clickAction="OPEN_URI" clickActionData={{ uri: `flowos://calendar?date=${day.dateKey}` }} accessibilityLabel={`Apri ${day.label}`}>
                      <TextWidget text={day.label} style={{ fontSize: 8, fontWeight: 'bold', color: textColor as any }} />
                    </FlexWidget>
                    {day.items.map(item => {
                      const lines = itemTitleLines(item);
                      const showDetails=true;
                      return (
                        <FlexWidget key={item.id} style={{ width: 'match_parent', height: itemHeight(item,density), marginTop: 3, padding: 2, borderTopLeftRadius:item.multiDaySegment==='middle'||item.multiDaySegment==='end'?0:5, borderBottomLeftRadius:item.multiDaySegment==='middle'||item.multiDaySegment==='end'?0:5, borderTopRightRadius:item.multiDaySegment==='middle'||item.multiDaySegment==='start'?0:5, borderBottomRightRadius:item.multiDaySegment==='middle'||item.multiDaySegment==='start'?0:5, marginLeft:item.multiDaySegment==='middle'||item.multiDaySegment==='end'?-2:0, marginRight:item.multiDaySegment==='middle'||item.multiDaySegment==='start'?-2:0, borderWidth: 1, borderColor: borderColor as any, backgroundColor: item.sourceColor, flexDirection: 'column' }} clickAction="OPEN_URI" clickActionData={{ uri: `flowos://calendar?widgetAction=manage&id=${encodeURIComponent(item.id)}` }} accessibilityLabel={`Gestisci ${item.title}`}>
                          {showDetails&&item.kind ? <TextWidget text={item.kind.toUpperCase()} style={{fontSize:4,lineHeight:6,fontWeight:'bold',color:textColor as any}}/> : null}
                          {showDetails&&item.time ? <TextWidget text={item.time} style={{ fontSize: density==='compact'?4:density==='comfortable'?6:5, lineHeight: density==='compact'?7:density==='comfortable'?11:ITEM_TIME_HEIGHT, fontWeight: 'bold', color: textColor as any }} /> : null}
                          {showDetails&&item.duration ? <TextWidget text={item.duration} style={{ fontSize: density==='compact'?4:density==='comfortable'?6:5, lineHeight: density==='compact'?6:density==='comfortable'?9:ITEM_DURATION_HEIGHT, color: textColor as any }} /> : null}
                          {showDetails?<FlexWidget style={{ flex:1, flexDirection:'row', alignItems:'flex-start' }}>
                            {item.priority ? <TextWidget text={String(item.priority)} style={{ width:8, fontSize: density==='compact'?4:density==='comfortable'?6:5, lineHeight: density==='compact'?7:density==='comfortable'?12:ITEM_TITLE_LINE_HEIGHT, fontWeight: 'bold', color: PRIMARY }} /> : null}
                            <FlexWidget style={{ flex:1, flexDirection:'column' }}>
                              {lines.map((line, index) => (
                                <TextWidget key={`${item.id}-line-${index}`} text={line} style={{ fontSize: 5, lineHeight: ITEM_TITLE_LINE_HEIGHT, fontWeight: 'bold', color: textColor as any }} />
                              ))}
                            </FlexWidget>
                          </FlexWidget>:null}
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
        {hasNewerWeeks || activeNavigation==='newer' ? <FlexWidget clickAction="CALENDAR_PAGE_NEWER" style={{ width:'match_parent', height:28, flexDirection:'row', alignItems:'center', justifyContent:'center', backgroundColor:activeNavigation==='newer'?buttonTextColor as any:buttonBackgroundColor as any, borderColor:activeNavigation==='newer'?buttonBackgroundColor as any:'transparent', borderWidth:activeNavigation==='newer'?2:0, borderRadius:8, marginVertical:2 }}><TextWidget text={`${labels.newerWeeks} →`} style={{ fontSize:10, fontWeight:'bold', color:activeNavigation==='newer'?buttonBackgroundColor as any:buttonTextColor as any }} /></FlexWidget> : null}
        <FlexWidget style={{ width: 'match_parent', height: 12 }} />
      </ListWidget>
    </FlexWidget>
  );
}

import { Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { TodayGlance } from '../lib/widgetData';
import { widgetStrings } from '../lib/i18n';

const TodayWidgetComponent=(props:TodayGlance,environment:WidgetEnvironment)=>{
  const labels=widgetStrings(props.language??'it');
  'widget';
  const visible=props.items.slice(0,5);
  return <VStack modifiers={[padding({all:10})]}>
    <Text modifiers={[font({weight:'bold',size:16})]}>{labels.today} · {props.items.length} {labels.activityWord}</Text>
    {visible.length?visible.map(item=><Text key={item.id} modifiers={[font({size:12})]}>{item.time} · {item.kind==='event'?labels.event:labels.task} · {item.title}</Text>):<Text modifiers={[font({size:12}),foregroundStyle('#6B7280')]}>{labels.noActivities}</Text>}
    {props.items.length>visible.length?<Text modifiers={[font({size:10}),foregroundStyle('#6B7280')]}>+{props.items.length-visible.length} {labels.more}</Text>:null}
  </VStack>;
};

const TodayWidget=createWidget('TodayWidget',TodayWidgetComponent);
export default TodayWidget;

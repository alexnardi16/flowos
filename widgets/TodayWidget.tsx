import { Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { TodayGlance } from '../lib/widgetData';

const TodayWidgetComponent=(props:TodayGlance,environment:WidgetEnvironment)=>{
  'widget';
  const visible=props.items.slice(0,5);
  return <VStack modifiers={[padding({all:10})]}>
    <Text modifiers={[font({weight:'bold',size:16})]}>Oggi · {props.items.length} attività</Text>
    {visible.length?visible.map(item=><Text key={item.id} modifiers={[font({size:12})]}>{item.time} · {item.kind==='event'?'Evento':item.kind==='task'?'Task':'Reminder'} · {item.title}</Text>):<Text modifiers={[font({size:12}),foregroundStyle('#6B7280')]}>Nessuna attività prevista</Text>}
    {props.items.length>visible.length?<Text modifiers={[font({size:10}),foregroundStyle('#6B7280')]}>+{props.items.length-visible.length} altre</Text>:null}
  </VStack>;
};

const TodayWidget=createWidget('TodayWidget',TodayWidgetComponent);
export default TodayWidget;

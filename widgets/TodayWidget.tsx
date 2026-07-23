import { Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { TodayGlance } from '../lib/widgetData';

// Widget name must match "TodayWidget" in app.json's expo-widgets plugin config.
const TodayWidgetComponent = (props: TodayGlance, environment: WidgetEnvironment) => {
  'widget';

  if (environment.widgetFamily === 'systemSmall') {
    return (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 14 })]}>
          {props.nextEventTitle ?? 'Nessun evento'}
        </Text>
        {props.nextEventTime ? <Text modifiers={[font({ size: 12 })]}>{props.nextEventTime}</Text> : null}
      </VStack>
    );
  }

  return (
    <VStack modifiers={[padding({ all: 12 })]}>
      <Text modifiers={[font({ weight: 'bold', size: 16 })]}>
        {props.nextEventTitle ? `${props.nextEventTime} · ${props.nextEventTitle}` : 'Nessun evento in programma'}
      </Text>
      <Text modifiers={[font({ size: 13 }), foregroundStyle('#6B7280')]}>
        {props.dueSoonCount} in scadenza · {props.overdueCount} scadute
      </Text>
    </VStack>
  );
};

const TodayWidget = createWidget('TodayWidget', TodayWidgetComponent);
export default TodayWidget;

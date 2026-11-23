import React from 'react';
import { Pressable as NativePressable, StyleSheet, type PressableProps } from 'react-native';

/**
 * Shared press feedback for every interactive surface in the app.
 * Android receives a visible ripple; all platforms receive a pressed-state
 * opacity and scale change, including buttons with custom style callbacks.
 */
export function FeedbackPressable({ style, android_ripple, ...props }: PressableProps) {
  return (
    <NativePressable
      {...props}
      android_ripple={android_ripple ?? { color: 'rgba(102, 88, 211, 0.28)', borderless: false }}
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        state.pressed && styles.pressed,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.68,
    transform: [{ scale: 0.985 }],
  },
});

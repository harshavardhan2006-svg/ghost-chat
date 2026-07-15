import { Animated, StyleSheet, Text, View } from 'react-native';
import { useEffect, useRef } from 'react';

import { colors, spacing } from '../../../shared/theme/theme';

export const SplashScreen = () => {
  const scale = useRef(new Animated.Value(0.86)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 16,
        stiffness: 140,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.mark, { opacity, transform: [{ scale }] }]} />
      <Text style={styles.title}>Ghost</Text>
      <Text style={styles.subtitle}>Private. Paired. Gone after seen.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  mark: {
    backgroundColor: colors.text,
    borderRadius: 30,
    height: 60,
    width: 60,
  },
  title: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
  },
});

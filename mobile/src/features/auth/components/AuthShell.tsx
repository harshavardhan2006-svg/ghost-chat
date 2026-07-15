import { Animated, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { type ReactNode, useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '../../../shared/theme/theme';

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export const AuthShell = ({ title, subtitle, children }: AuthShellProps) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        stiffness: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        <Animated.View style={[styles.content, { opacity, transform: [{ translateY }] }]}>
          <View style={styles.header}>
            <View style={styles.mark} />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  mark: {
    backgroundColor: colors.text,
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  title: {
    color: colors.text,
    fontSize: 38,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
  },
});

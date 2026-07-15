import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';

import { colors, radii, spacing } from '../theme/theme';

type GhostButtonProps = PressableProps & {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
};

export const GhostButton = ({ label, loading = false, variant = 'primary', disabled, style, ...props }: GhostButtonProps) => {
  const isDisabled = disabled === true || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? colors.background : colors.text} /> : <Text style={[styles.label, variant === 'primary' && styles.primaryLabel]}>{label}</Text>}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radii.pill,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: colors.panelRaised,
    borderColor: colors.border,
    borderWidth: 1,
  },
  danger: {
    backgroundColor: 'rgba(255, 90, 106, 0.12)',
    borderColor: 'rgba(255, 90, 106, 0.34)',
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryLabel: {
    color: colors.background,
  },
});

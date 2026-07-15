import { useState } from 'react';
import { StyleSheet, Text, Pressable, View, Alert } from 'react-native';

import { AuthShell } from './AuthShell';
import { GhostButton } from '../../../shared/components/GhostButton';
import { GhostInput } from '../../../shared/components/GhostInput';
import { colors, spacing } from '../../../shared/theme/theme';
import { authApi } from '../services/auth-api';
import { useAuthStore } from '../store/auth-store';
import { validateLogin, validateRegister, type AuthFormErrors } from '../services/validation';

export const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  const handleSubmit = async () => {
    const values = { email, password };
    const validationErrors = isLogin ? validateLogin(values) : validateRegister(values);

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      if (isLogin) {
        const payload = await authApi.login({ email, password });
        await setSession(payload);
      } else {
        const payload = await authApi.register({ email, password });
        await setSession(payload);
      }
    } catch (error: any) {
      Alert.alert('Authentication Error', error?.message ?? 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={isLogin ? 'Welcome Back' : 'Get Started'}
      subtitle={
        isLogin
          ? 'Log in to connect with your partner in your private, self-destructing space.'
          : 'Create your private credentials. Pairing happens next.'
      }
    >
      <View style={styles.form}>
        <GhostInput
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          error={errors.email}
          keyboardType="email-address"
          label="EMAIL ADDRESS"
          onChangeText={(text) => {
            setEmail(text);
            if (errors.email) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.email;
                return next;
              });
            }
          }}
          placeholder="e.g. name@example.com"
          value={email}
        />

        <GhostInput
          autoCapitalize="none"
          autoComplete="password"
          autoCorrect={false}
          error={errors.password}
          label="PASSWORD"
          onChangeText={(text) => {
            setPassword(text);
            if (errors.password) {
              setErrors((prev) => {
                const next = { ...prev };
                delete next.password;
                return next;
              });
            }
          }}
          placeholder="••••••••"
          secureTextEntry
          value={password}
        />

        <GhostButton
          disabled={loading}
          label={isLogin ? 'Log In' : 'Sign Up'}
          loading={loading}
          onPress={handleSubmit}
          style={styles.submitBtn}
          variant="primary"
        />

        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => {
            setIsLogin((prev) => !prev);
            setErrors({});
          }}
          style={({ pressed }) => [styles.toggleLink, pressed && styles.toggleLinkPressed]}
        >
          <Text style={styles.toggleText}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <Text style={styles.toggleHighlight}>{isLogin ? 'Sign Up' : 'Log In'}</Text>
          </Text>
        </Pressable>
      </View>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  submitBtn: {
    marginTop: spacing.sm,
  },
  toggleLink: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  toggleLinkPressed: {
    opacity: 0.7,
  },
  toggleText: {
    color: colors.muted,
    fontSize: 14,
  },
  toggleHighlight: {
    color: colors.text,
    fontWeight: '700',
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { GhostButton } from '../../../shared/components/GhostButton';
import { GhostInput } from '../../../shared/components/GhostInput';
import { colors, spacing } from '../../../shared/theme/theme';
import { AuthShell } from '../components/AuthShell';
import { useAuth } from '../AuthContext';
import { type AuthFormErrors, validateRegister } from '../services/validation';

type RegisterScreenProps = {
  onLoginPress: () => void;
};

export const RegisterScreen = ({ onLoginPress }: RegisterScreenProps) => {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<AuthFormErrors>({});

  const submit = async (): Promise<void> => {
    const nextErrors = validateRegister({ email, password });
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await auth.register({ email: email.trim().toLowerCase(), password });
  };

  return (
    <AuthShell title="Create Ghost" subtitle="One account. One partner. No public profile.">
      <View style={styles.form}>
        <GhostInput
          autoCapitalize="none"
          autoComplete="email"
          error={errors.email}
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="you@example.com"
          value={email}
        />
        <GhostInput
          autoCapitalize="none"
          error={errors.password}
          label="Password"
          onChangeText={setPassword}
          placeholder="At least 8 characters"
          secureTextEntry
          value={password}
        />
        {auth.error === null ? null : <Text style={styles.error}>{auth.error}</Text>}
        <GhostButton label="Register" loading={auth.busy} onPress={() => void submit()} />
        <Pressable onPress={onLoginPress} style={styles.switchButton}>
          <Text style={styles.switchText}>I already have an account</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  switchButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  switchText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
});

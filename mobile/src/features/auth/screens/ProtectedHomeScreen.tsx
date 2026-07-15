import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GhostButton } from '../../../shared/components/GhostButton';
import { colors, radii, spacing } from '../../../shared/theme/theme';
import { useAuth } from '../AuthContext';

export const ProtectedHomeScreen = () => {
  const auth = useAuth();
  const user = auth.session?.user;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Ghost</Text>
        <Text style={styles.subtitle}>{user?.email ?? 'Authenticated'}</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>{user?.paired === true ? 'Private chat ready' : 'Pairing needed'}</Text>
        <Text style={styles.panelText}>
          {user?.paired === true ? 'Your protected route is active.' : 'Generate or enter a pairing code after auth.'}
        </Text>
      </View>
      <GhostButton label="Log out" loading={auth.busy} onPress={() => void auth.logout()} variant="danger" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    gap: spacing.xs,
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
  },
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
    marginBottom: 'auto',
    padding: spacing.lg,
  },
  panelTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  panelText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';

import { GhostButton } from '../../../shared/components/GhostButton';
import { colors, radii, spacing } from '../../../shared/theme/theme';
import { useAuthStore } from '../../auth/store/auth-store';
import { pairingApi } from '../services/pairing-api';
import { connectSocket, disconnectSocket } from '../../../shared/services/socket-service';

type ViewState = 'initial' | 'generate' | 'enter';

export const PairingScreen = () => {
  const [viewState, setViewState] = useState<ViewState>('initial');
  const [loading, setLoading] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('10:00');
  const [enterCode, setEnterCode] = useState<string[]>(Array(6).fill(''));
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const accessToken = useAuthStore((state) => state.accessToken);
  const updatePairingStatus = useAuthStore((state) => state.updatePairingStatus);

  // Refs for 6 code inputs
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Pulse animation for waiting state
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation loop
  useEffect(() => {
    if (viewState === 'generate' && pairingCode !== null) {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1.4,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      fadeAnim.setValue(1);
    }
  }, [viewState, pairingCode, pulseAnim, fadeAnim]);

  // Handle countdown timer
  useEffect(() => {
    if (viewState !== 'generate' || expiresAt === null) {
      return;
    }

    const updateTimer = () => {
      const diff = expiresAt.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('00:00');
        setPairingCode(null);
        setExpiresAt(null);
        setViewState('initial');
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setTimeLeft(
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [viewState, expiresAt]);

  // Real-time synchronization (Socket.IO + Fallback Polling)
  useEffect(() => {
    if (accessToken === null) {
      return;
    }

    // Connect socket
    const socket = connectSocket(accessToken);

    const handlePairingCompleted = (payload: any) => {
      disconnectSocket();
      updatePairingStatus(true, payload.friendship.participantIds.find((id: string) => id !== useAuthStore.getState().user?.id) ?? null, payload.chat.id);
    };

    socket.on('pairing-completed', handlePairingCompleted);

    // Fallback Polling in case of socket issues
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    if (viewState === 'generate') {
      pollInterval = setInterval(async () => {
        try {
          const status = await pairingApi.getStatus(accessToken);
          if (status.paired && status.chatId !== null) {
            disconnectSocket();
            if (pollInterval) {
              clearInterval(pollInterval);
            }
            updatePairingStatus(true, status.partnerId, status.chatId);
          }
        } catch {
          // Ignore polling errors to prevent app crashes
        }
      }, 4000);
    }

    return () => {
      socket.off('pairing-completed', handlePairingCompleted);
      disconnectSocket();
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [accessToken, viewState, updatePairingStatus]);

  // Trigger Generate Code API
  const handleGenerateCode = async () => {
    if (accessToken === null) {
      return;
    }

    setLoading(true);
    try {
      const response = await pairingApi.generateCode(accessToken);
      setPairingCode(response.code);
      setExpiresAt(new Date(response.expiresAt));
      setViewState('generate');
    } catch (error: any) {
      setPairingError(error?.message ?? 'Failed to generate code');
    } finally {
      setLoading(false);
    }
  };

  // Trigger Copy Code
  const handleCopyCode = async () => {
    if (pairingCode === null) {
      return;
    }

    await Clipboard.setStringAsync(pairingCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Trigger Share Code
  const handleShareCode = async () => {
    if (pairingCode === null) {
      return;
    }

    try {
      await Share.share({
        message: `Let's pair up on Ghost! Here is my invite code: ${pairingCode} (Expires in 10 minutes).`,
      });
    } catch {
      // Ignore
    }
  };

  // Code input change handler
  const handleCodeChange = (text: string, index: number) => {
    const cleanText = text.replace(/[^0-9]/g, '');
    const newCode = [...enterCode];
    newCode[index] = cleanText.substring(cleanText.length - 1);
    setEnterCode(newCode);

    if (cleanText.length > 0 && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto submit when all digits filled
    const completeCode = newCode.join('');
    if (completeCode.length === 6) {
      Keyboard.dismiss();
      void submitPairingCode(completeCode);
    }
  };

  // Backspace handler for inputs
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && enterCode[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Submit entered code to server
  const submitPairingCode = async (code: string) => {
    if (accessToken === null) {
      return;
    }

    setLoading(true);
    setPairingError(null);

    try {
      const response = await pairingApi.pairWithCode(code, accessToken);
      updatePairingStatus(
        true,
        response.friendship.participantIds.find((id) => id !== useAuthStore.getState().user?.id) ?? null,
        response.chat.id
      );
    } catch (error: any) {
      setPairingError(error?.message ?? 'Invalid code or pairing failed.');
      setEnterCode(Array(6).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setViewState('initial');
    setPairingCode(null);
    setExpiresAt(null);
    setEnterCode(Array(6).fill(''));
    setPairingError(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.wrapper}>
        {viewState === 'initial' && (
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <View style={styles.ghostIcon} />
            </View>
            <Text style={styles.title}>Pair with your Partner</Text>
            <Text style={styles.description}>
              Ghost is a secure 1-to-1 private chat. Connect with your partner using a temporary, single-use invite code.
            </Text>

            <View style={styles.actionContainer}>
              <GhostButton
                disabled={loading}
                label="Generate Invite Code"
                loading={loading}
                onPress={handleGenerateCode}
                variant="primary"
              />
              <GhostButton
                disabled={loading}
                label="Enter Invite Code"
                onPress={() => setViewState('enter')}
                variant="secondary"
              />
            </View>
          </View>
        )}

        {viewState === 'generate' && pairingCode !== null && (
          <View style={styles.card}>
            {/* Pulsing indicator */}
            <View style={styles.pulseContainer}>
              <Animated.View
                style={[
                  styles.pulseCircle,
                  {
                    transform: [{ scale: pulseAnim }],
                    opacity: fadeAnim,
                  },
                ]}
              />
              <View style={styles.innerPulseCircle} />
            </View>

            <Text style={styles.title}>Waiting for Partner</Text>
            <Text style={styles.description}>
              Share this secure code with your partner. Keep this screen open while they enter it.
            </Text>

            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>{pairingCode}</Text>
            </View>

            <View style={styles.timerContainer}>
              <Text style={styles.timerLabel}>EXPIRES IN</Text>
              <Text style={styles.timerText}>{timeLeft}</Text>
            </View>

            <View style={styles.actionContainer}>
              <View style={styles.row}>
                <GhostButton
                  label={isCopied ? 'Copied!' : 'Copy Code'}
                  onPress={handleCopyCode}
                  style={styles.flexBtn}
                  variant="secondary"
                />
                <GhostButton
                  label="Share Code"
                  onPress={handleShareCode}
                  style={styles.flexBtn}
                  variant="primary"
                />
              </View>
              <GhostButton label="Cancel" onPress={handleBack} variant="danger" />
            </View>
          </View>
        )}

        {viewState === 'enter' && (
          <View style={styles.card}>
            <Text style={styles.title}>Enter Invite Code</Text>
            <Text style={styles.description}>
              Input the 6-digit invite code generated by your partner's device.
            </Text>

            <View style={styles.codeInputWrapper}>
              <View style={styles.codeInputRow}>
                {enterCode.map((digit, i) => (
                  <TextInput
                    key={i}
                    ref={(ref) => {
                      inputRefs.current[i] = ref;
                    }}
                    autoFocus={i === 0}
                    keyboardType="numeric"
                    maxLength={1}
                    onChangeText={(text) => handleCodeChange(text, i)}
                    onKeyPress={(e) => handleKeyPress(e, i)}
                    placeholder="•"
                    placeholderTextColor={colors.subtle}
                    style={[
                      styles.codeDigitInput,
                      pairingError !== null && styles.codeDigitInputError,
                      enterCode[i] !== '' && styles.codeDigitInputFilled,
                    ]}
                    value={digit}
                  />
                ))}
              </View>
            </View>

            {pairingError !== null && <Text style={styles.errorText}>{pairingError}</Text>}

            {loading && (
              <View style={styles.loadingWrapper}>
                <ActivityIndicator color={colors.text} size="small" />
                <Text style={styles.loadingText}>Verifying code...</Text>
              </View>
            )}

            <View style={[styles.actionContainer, { marginTop: spacing.lg }]}>
              <GhostButton label="Back" onPress={handleBack} variant="secondary" />
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  wrapper: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    width: '100%',
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    width: 56,
  },
  ghostIcon: {
    backgroundColor: colors.text,
    borderRadius: 12,
    height: 24,
    width: 24,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  description: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  actionContainer: {
    gap: spacing.md,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  flexBtn: {
    flex: 1,
  },
  pulseContainer: {
    alignItems: 'center',
    height: 80,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    width: 80,
  },
  pulseCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 40,
    height: 80,
    position: 'absolute',
    width: 80,
  },
  innerPulseCircle: {
    backgroundColor: colors.text,
    borderRadius: 16,
    height: 32,
    width: 32,
  },
  codeContainer: {
    backgroundColor: colors.panelRaised,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  codeText: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 4,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  timerLabel: {
    color: colors.subtle,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  timerText: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: '800',
  },
  codeInputWrapper: {
    marginBottom: spacing.md,
    width: '100%',
  },
  codeInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  codeDigitInput: {
    backgroundColor: colors.panelRaised,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    height: 50,
    textAlign: 'center',
    width: '14%',
  },
  codeDigitInputError: {
    borderColor: colors.danger,
  },
  codeDigitInputFilled: {
    borderColor: colors.text,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  loadingWrapper: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 14,
  },
});

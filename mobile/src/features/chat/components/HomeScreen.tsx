import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GhostButton } from '../../../shared/components/GhostButton';
import { colors, radii, spacing } from '../../../shared/theme/theme';
import { useAuthStore } from '../../auth/store/auth-store';
import { chatApi } from '../services/chat-api';
import { type PartnerDetails } from '../types/chat.types';
import { connectSocket, disconnectSocket } from '../../../shared/services/socket-service';
import { useNavigationStore } from '../../../shared/store/navigation-store';

// Curated list of premium solid colors for custom avatar
const avatarColors = [
  '#FF5A6A', // Coral
  '#39D98A', // success/green
  '#4D96FF', // blue
  '#F3C969', // yellow
  '#9B51E0', // violet
  '#FF8243', // orange
];

const getAvatarColor = (email: string): string => {
  let hash = 0;
  for (let i = 0; i < email.length; i += 1) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarColors.length;
  return avatarColors[index] ?? '#FF5A6A';
};

const getUsername = (email: string): string => {
  const parts = email.split('@');
  return parts[0] ?? email;
};

const formatLastSeen = (lastSeenAt: string | null): string => {
  if (lastSeenAt === null) {
    return 'Active long ago';
  }
  const date = new Date(lastSeenAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) {
    return 'Active just now';
  }
  if (diffMin < 60) {
    return `Active ${diffMin}m ago`;
  }
  if (diffHr < 24) {
    return `Active ${diffHr}h ago`;
  }
  if (diffDay === 1) {
    return 'Active yesterday';
  }
  return `Active ${diffDay}d ago`;
};

export const HomeScreen = () => {
  const { accessToken, logout, user, updatePairingStatus } = useAuthStore((state) => ({
    accessToken: state.accessToken,
    logout: state.logout,
    user: state.user,
    updatePairingStatus: state.updatePairingStatus,
  }));

  const navigateTo = useNavigationStore((state) => state.navigateTo);

  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<PartnerDetails | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Re-fetch trigger for fallback polling
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Animations
  const contentFade = useRef(new Animated.Value(0)).current;
  const contentTranslate = useRef(new Animated.Value(15)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;
  const rowScale = useRef(new Animated.Value(1)).current;

  // Pulse animation for online indicator ring
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (partner?.online === true) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(ringScale, {
              toValue: 1.5,
              duration: 1800,
              useNativeDriver: true,
            }),
            Animated.timing(ringOpacity, {
              toValue: 0,
              duration: 1800,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(ringScale, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(ringOpacity, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      anim.start();
    } else {
      ringScale.setValue(1);
      ringOpacity.setValue(0);
    }

    return () => {
      if (anim !== null) {
        anim.stop();
      }
    };
  }, [partner?.online, ringScale, ringOpacity]);

  // Load Initial Partner Profile
  useEffect(() => {
    if (accessToken === null) {
      return;
    }

    const fetchPartner = async () => {
      try {
        const data = await chatApi.getPartnerDetails(accessToken);
        setPartner(data);

        // Entrance animation
        Animated.parallel([
          Animated.timing(contentFade, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.spring(contentTranslate, {
            toValue: 0,
            damping: 20,
            stiffness: 100,
            useNativeDriver: true,
          }),
        ]).start();
      } catch {
        // Handle error silently
      } finally {
        setLoading(false);
      }
    };

    void fetchPartner();
  }, [accessToken, refreshTrigger, contentFade, contentTranslate]);

  // WebSocket Live Synchronization + Fallback status polling
  useEffect(() => {
    if (accessToken === null || partner === null) {
      return;
    }

    const socket = connectSocket(accessToken);

    const handleOnline = (payload: { userId: string; lastSeenAt: string }) => {
      if (payload.userId === partner.id) {
        setPartner((prev) =>
          prev !== null
            ? { ...prev, online: true, lastSeenAt: payload.lastSeenAt }
            : null
        );
      }
    };

    const handleOffline = (payload: { userId: string; lastSeenAt: string }) => {
      if (payload.userId === partner.id) {
        setPartner((prev) =>
          prev !== null
            ? { ...prev, online: false, lastSeenAt: payload.lastSeenAt }
            : null
        );
      }
    };

    const handleUnpaired = () => {
      updatePairingStatus(false, null, null);
    };

    socket.on('online', handleOnline);
    socket.on('offline', handleOffline);
    socket.on('unpaired', handleUnpaired);

    // Fallback status check every 12 seconds in case socket drops
    const pollInterval = setInterval(() => {
      setRefreshTrigger((prev) => prev + 1);
    }, 12000);

    return () => {
      socket.off('online', handleOnline);
      socket.off('offline', handleOffline);
      socket.off('unpaired', handleUnpaired);
      disconnectSocket();
      clearInterval(pollInterval);
    };
  }, [accessToken, partner?.id]);

  // Row Press Handler (Animations)
  const handlePressIn = () => {
    Animated.spring(rowScale, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(rowScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleChatOpen = () => {
    if (user?.chatId !== null && user?.chatId !== undefined) {
      navigateTo('chat', user.chatId);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.text} size="large" />
      </View>
    );
  }

  const partnerEmail = partner?.email ?? 'partner@ghost.app';
  const partnerName = getUsername(partnerEmail);
  const avatarBg = getAvatarColor(partnerEmail);
  const partnerInitial = partnerEmail.substring(0, 1).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Ghost</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSettingsVisible(true)}
          style={({ pressed }) => [
            styles.settingsBtn,
            pressed && styles.settingsBtnPressed,
          ]}
        >
          <View style={styles.settingsIcon}>
            <View style={styles.gearDot} />
            <View style={styles.gearDot} />
            <View style={styles.gearDot} />
          </View>
        </Pressable>
      </View>

      {/* Main Listing */}
      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        style={[
          styles.scroll,
          {
            opacity: contentFade,
            transform: [{ translateY: contentTranslate }],
          },
        ]}
      >
        <Text style={styles.sectionTitle}>Messages</Text>

        {partner === null ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Pairing data sync failed. Try re-logging.</Text>
          </View>
        ) : (
          <Animated.View style={{ transform: [{ scale: rowScale }] }}>
            <Pressable
              onPress={handleChatOpen}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={styles.chatRow}
            >
              {/* Profile Pic Column */}
              <View style={styles.avatarWrapper}>
                {/* Active Glow Ring */}
                <Animated.View
                  style={[
                    styles.glowRing,
                    {
                      borderColor: avatarBg,
                      transform: [{ scale: ringScale }],
                      opacity: ringOpacity,
                    },
                  ]}
                />
                {/* Circle Avatar */}
                <View style={[styles.avatarCircle, { backgroundColor: avatarBg }]}>
                  <Text style={styles.avatarInitial}>{partnerInitial}</Text>
                </View>
                {/* Status Dot */}
                <View
                  style={[
                    styles.statusBadge,
                    partner.online ? styles.statusBadgeOnline : styles.statusBadgeOffline,
                  ]}
                />
              </View>

              {/* Chat Info Column */}
              <View style={styles.chatDetails}>
                <Text style={styles.chatName}>{partnerName}</Text>
                <Text style={styles.messagePreview} numberOfLines={1}>
                  {partner.online ? 'Active now' : formatLastSeen(partner.lastSeenAt)}
                </Text>
              </View>

              {/* Accessory Column (Camera/Instagram style) */}
              <View style={styles.accessory}>
                <View style={styles.cameraIcon}>
                  <View style={styles.cameraLens} />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        )}
      </Animated.ScrollView>

      {/* Settings Modal (Instagram Direct actions panel style) */}
      <Modal
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
        transparent={true}
        visible={settingsVisible}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalDismissArea}
            onPress={() => setSettingsVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Settings</Text>

            <View style={styles.modalActions}>
              <GhostButton
                label="Unpair Connection"
                onPress={async () => {
                  if (accessToken !== null) {
                    try {
                      setSettingsVisible(false);
                      setLoading(true);
                      await chatApi.unpair(accessToken);
                      updatePairingStatus(false, null, null);
                    } catch {
                      // ignore
                    } finally {
                      setLoading(false);
                    }
                  }
                }}
                variant="danger"
              />
              <GhostButton
                label="Log Out"
                onPress={async () => {
                  setSettingsVisible(false);
                  await logout();
                }}
                variant="secondary"
              />
              <GhostButton
                label="Close"
                onPress={() => setSettingsVisible(false)}
                variant="primary"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 0.5,
    flexDirection: 'row',
    height: 56,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  logo: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  settingsBtn: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  settingsBtnPressed: {
    opacity: 0.6,
  },
  settingsIcon: {
    flexDirection: 'row',
    gap: 3,
  },
  gearDot: {
    backgroundColor: colors.text,
    borderRadius: 3.5,
    height: 7,
    width: 7,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  chatRow: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatarWrapper: {
    alignItems: 'center',
    height: 54,
    justifyContent: 'center',
    position: 'relative',
    width: 54,
  },
  glowRing: {
    borderRadius: 27,
    borderWidth: 2,
    height: 54,
    position: 'absolute',
    width: 54,
  },
  avatarCircle: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarInitial: {
    color: colors.background,
    fontSize: 20,
    fontWeight: '800',
  },
  statusBadge: {
    borderColor: colors.panel,
    borderRadius: 7,
    borderWidth: 2,
    bottom: 2,
    height: 14,
    position: 'absolute',
    right: 2,
    width: 14,
  },
  statusBadgeOnline: {
    backgroundColor: colors.success,
  },
  statusBadgeOffline: {
    backgroundColor: colors.muted,
  },
  chatDetails: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: spacing.md,
  },
  chatName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  messagePreview: {
    color: colors.muted,
    fontSize: 13,
  },
  accessory: {
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },
  cameraIcon: {
    alignItems: 'center',
    borderColor: colors.muted,
    borderRadius: 11,
    borderWidth: 1.8,
    height: 22,
    justifyContent: 'center',
    width: 32,
  },
  cameraLens: {
    backgroundColor: colors.muted,
    borderRadius: 3.5,
    height: 7,
    width: 7,
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  modalHandle: {
    alignSelf: 'center',
    backgroundColor: colors.border,
    borderRadius: 2.5,
    height: 5,
    marginBottom: spacing.md,
    width: 36,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  modalActions: {
    gap: spacing.md,
  },
});

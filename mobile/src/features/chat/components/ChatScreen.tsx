import { useEffect, useRef, useState, memo, useCallback } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAudioRecorder, RecordingPresets, createAudioPlayer, AudioModule, requestRecordingPermissionsAsync, type AudioPlayer } from 'expo-audio';

import { colors, radii, spacing } from '../../../shared/theme/theme';
import { useAuthStore } from '../../auth/store/auth-store';
import { useNavigationStore } from '../../../shared/store/navigation-store';
import { chatApi } from '../services/chat-api';
import { type Message } from '../types/chat.types';
import { connectSocket, disconnectSocket } from '../../../shared/services/socket-service';

// Cast FlashList to any to bypass third-party compilation type checks
const TypedFlashList = FlashList as any;

// Formatter helper for timestamp
const formatMessageTime = (isoString: string): string => {
  const date = new Date(isoString);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const formatLastSeen = (lastSeenAt: string | null): string => {
  if (lastSeenAt === null) {
    return 'Offline';
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

// Curated solid colors for custom avatar
const avatarColors = [
  '#FF5A6A', // Coral
  '#39D98A', // green
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

// Parse media envelopes [media:kind:url]
const parseMedia = (
  text: string
): { mediaKind?: 'image' | 'voice' | undefined; mediaUrl?: string | undefined; cleanText: string } => {
  const regex = /^\[media:(image|voice):(https?:\/\/[^\]]+)\]$/i;
  const match = regex.exec(text.trim());
  if (match !== null) {
    return {
      mediaKind: match[1] as 'image' | 'voice',
      mediaUrl: match[2],
      cleanText: '',
    };
  }
  return { cleanText: text };
};

// ==========================================
// VOICE BUBBLE ITEM COMPONENT
// ==========================================
type VoiceBubbleProps = {
  url: string;
  isSender: boolean;
};

const VoiceBubble = ({ url, isSender }: VoiceBubbleProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<AudioPlayer | null>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (playerRef.current !== null) {
        void playerRef.current.pause();
        void playerRef.current.release();
      }
      if (subscriptionRef.current !== null) {
        subscriptionRef.current.remove();
      }
    };
  }, []);

  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        if (playerRef.current !== null) {
          await playerRef.current.pause();
        }
        setIsPlaying(false);
      } else {
        if (playerRef.current === null) {
          const newPlayer = createAudioPlayer(url);
          playerRef.current = newPlayer;

          subscriptionRef.current = newPlayer.addListener('playbackStatusUpdate', (status: any) => {
            setIsPlaying(status.playing);
            setCurrentTime(status.currentTime || 0);
            if (status.duration) {
              setDuration(status.duration);
            }
            if (status.didJustFinish) {
              setIsPlaying(false);
              setCurrentTime(0);
            }
          });
        }

        await playerRef.current.play();
        setIsPlaying(true);
      }
    } catch {
      // Ignore audio player errors
    }
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const tintColor = isSender ? colors.background : colors.text;

  const formatAudioTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.voiceBubble}>
      <Pressable onPress={handlePlayPause} style={styles.voicePlayBtn}>
        <Text style={[styles.voicePlayIcon, { color: tintColor }]}>
          {isPlaying ? '⏸' : '▶'}
        </Text>
      </Pressable>

      <View style={styles.voiceProgressTrack}>
        <View style={[styles.voiceProgressBar, { backgroundColor: tintColor, width: `${progress * 100}%` }]} />
      </View>
      <Text style={[styles.voiceDurationText, { color: isSender ? 'rgba(0,0,0,0.5)' : colors.muted }]}>
        {formatAudioTime(currentTime)} / {formatAudioTime(duration || 5)}
      </Text>
    </View>
  );
};

// ==========================================
// SWIPE-TO-REPLY BUBBLE COMPONENT
// ==========================================
type SwipeableBubbleProps = {
  children: React.ReactNode;
  onSwipeReply: () => void;
};

const SwipeableMessageBubble = ({ children, onSwipeReply }: SwipeableBubbleProps) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const replyIconOpacity = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && gestureState.dx > 0 && Math.abs(gestureState.dy) < 8;
      },
      onPanResponderMove: (_, gestureState) => {
        const dragX = Math.min(Math.max(gestureState.dx, 0), 80);
        translateX.setValue(dragX);
        replyIconOpacity.setValue(dragX > 40 ? 1 : dragX / 40);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 50) {
          onSwipeReply();
        }
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }),
          Animated.timing(replyIconOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      },
    })
  ).current;

  return (
    <View style={styles.swipeContainer}>
      <Animated.View
        style={[
          styles.replySwipeIconWrapper,
          {
            opacity: replyIconOpacity,
            transform: [
              {
                translateX: translateX.interpolate({
                  inputRange: [0, 80],
                  outputRange: [-20, 10],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.replySwipeIcon}>↰</Text>
      </Animated.View>

      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

// ==========================================
// ANIMATED REACTION BADGE COMPONENT
// ==========================================
const ReactionBadge = ({ emoji }: { emoji: string }) => {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      tension: 120,
      friction: 6,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.reactionBadge, { transform: [{ scale }] }]}>
      <Text style={styles.reactionBadgeText}>{emoji}</Text>
    </Animated.View>
  );
};

// ==========================================
// ANIMATED REACTION PICKER TOOLBAR COMPONENT
// ==========================================
const ReactionToolbar = ({ topY, onSelectEmoji }: { topY: number; onSelectEmoji: (emoji: string) => void }) => {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.reactionToolbar, { top: topY, opacity, transform: [{ scale }] }]}>
      {['❤️', '😂', '😮', '😢', '🙏', '👍'].map((emoji) => (
        <Pressable
          key={emoji}
          onPress={() => onSelectEmoji(emoji)}
          style={({ pressed }) => [
            styles.reactionItem,
            pressed && styles.reactionItemPressed,
          ]}
        >
          <Text style={styles.reactionItemText}>{emoji}</Text>
        </Pressable>
      ))}
    </Animated.View>
  );
};

// ==========================================
// DISAPPEARING COUNTDOWN TIMER COMPONENT
// ==========================================
const DisappearingTimer = ({ deleteAt, isSender }: { deleteAt: string; isSender: boolean }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = new Date(deleteAt).getTime() - Date.now();
      setTimeLeft(Math.max(0, Math.floor(diff / 1000)));
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [deleteAt]);

  if (timeLeft <= 0) {
    return null;
  }

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  return (
    <Text style={[styles.countdownText, isSender ? styles.countdownSender : styles.countdownRecipient]}>
      ⏱ {mins}:{secs.toString().padStart(2, '0')}
    </Text>
  );
};

// ==========================================
// MESSAGE ITEM RENDER COMPONENT
// ==========================================
type MessageItemProps = {
  message: Message;
  currentUserId: string;
  partnerName: string;
  onDoubleTapReact: (messageId: string) => void;
  onLongPressReact: (messageId: string, pageY: number) => void;
  onSwipeReply: (message: Message) => void;
  onRetry: (message: Message) => void;
  replyToMessage?: Message | null | undefined;
  isDeleting: boolean;
};

const MessageItem = memo(
  ({
    message,
    currentUserId,
    partnerName,
    onDoubleTapReact,
    onLongPressReact,
    onSwipeReply,
    onRetry,
    replyToMessage,
    isDeleting,
  }: MessageItemProps) => {
    const isSender = message.senderId === currentUserId;
    const lastTap = useRef<number>(0);
    const opacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      if (isDeleting) {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }).start();
      } else {
        opacity.setValue(1);
      }
    }, [isDeleting]);

    const handleTap = () => {
      const DateNow = Date.now();
      const DOUBLE_PRESS_DELAY = 300;
      if (DateNow - lastTap.current < DOUBLE_PRESS_DELAY) {
        onDoubleTapReact(message.id);
      }
      lastTap.current = DateNow;
    };

    const handleLongPress = (event: any) => {
      const pageY = event.nativeEvent.pageY || 300;
      onLongPressReact(message.id, pageY);
    };

    const { mediaKind, mediaUrl, cleanText } = parseMedia(message.text);

    return (
      <Animated.View style={[styles.rowContainer, isSender ? styles.rowSender : styles.rowRecipient, { opacity }]}>
        {/* Retry Button on the Left for failed sender messages */}
        {isSender && message.hasSendingFailed && (
          <Pressable onPress={() => onRetry(message)} style={styles.retryBtn}>
            <Text style={styles.retryIcon}>⟳</Text>
          </Pressable>
        )}

        <View style={styles.bubbleAndTimerWrapper}>
          <SwipeableMessageBubble onSwipeReply={() => onSwipeReply(message)}>
            <Pressable
              delayLongPress={400}
              onLongPress={handleLongPress}
              onPress={handleTap}
              style={[
                styles.messageBubble,
                isSender ? styles.bubbleSender : styles.bubbleRecipient,
                message.isOptimistic === true && styles.bubbleOptimistic,
                message.hasSendingFailed === true && styles.bubbleFailed,
              ]}
            >
              {/* Reply Preview */}
              {replyToMessage !== null && replyToMessage !== undefined && (
                <View
                  style={[
                    styles.bubbleReplyPreview,
                    isSender ? styles.bubbleReplyPreviewSender : styles.bubbleReplyPreviewRecipient,
                  ]}
                >
                  <Text style={styles.replyPreviewHeader}>
                    {replyToMessage.senderId === currentUserId ? 'You' : partnerName}
                  </Text>
                  <Text numberOfLines={1} style={styles.replyPreviewText}>
                    {parseMedia(replyToMessage.text).mediaKind === 'image' || replyToMessage.localMediaUri
                      ? '📷 Photo'
                      : parseMedia(replyToMessage.text).mediaKind === 'voice'
                      ? '🎵 Voice Note'
                      : replyToMessage.text}
                  </Text>
                </View>
              )}

              {/* Bubble Content */}
              {mediaKind === 'image' || message.localMediaUri ? (
                <View style={styles.imageContentWrapper}>
                  <Image
                    source={{ uri: message.localMediaUri || mediaUrl }}
                    style={styles.imageBubbleImage}
                    resizeMode="cover"
                  />
                </View>
              ) : mediaKind === 'voice' && mediaUrl ? (
                <VoiceBubble isSender={isSender} url={mediaUrl} />
              ) : (
                <Text style={[styles.messageText, isSender ? styles.textSender : styles.textRecipient]}>
                  {cleanText}
                </Text>
              )}

              {/* Time Stamp */}
              <Text style={[styles.messageTime, isSender ? styles.timeSender : styles.timeRecipient]}>
                {formatMessageTime(message.createdAt)}
              </Text>

              {/* Reaction Badge */}
              {message.reactions.length > 0 && (
                <View style={styles.reactionsBadgeWrapper}>
                  {message.reactions.map((react, index) => (
                    <ReactionBadge key={index} emoji={react.emoji} />
                  ))}
                </View>
              )}
            </Pressable>
          </SwipeableMessageBubble>

          {/* Countdown timer right below the bubble */}
          {message.deleteAt && (
            <DisappearingTimer deleteAt={message.deleteAt} isSender={isSender} />
          )}
        </View>

        {/* Retry Button on the Right for failed recipient messages */}
        {!isSender && message.hasSendingFailed && (
          <Pressable onPress={() => onRetry(message)} style={styles.retryBtn}>
            <Text style={styles.retryIcon}>⟳</Text>
          </Pressable>
        )}
      </Animated.View>
    );
  }
);

// ==========================================
// MAIN CHAT SCREEN
// ==========================================
export const ChatScreen = () => {
  const { activeChatId, navigateTo } = useNavigationStore((state) => ({
    activeChatId: state.activeChatId,
    navigateTo: state.navigateTo,
  }));

  const { user, accessToken } = useAuthStore((state) => ({
    user: state.user,
    accessToken: state.accessToken,
  }));

  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [animatingDeleteIds, setAnimatingDeleteIds] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [localReplyTarget, setLocalReplyTarget] = useState<Message | null>(null);
  const replyTranslateY = useRef(new Animated.Value(60)).current;
  
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [reactionModal, setReactionModal] = useState<{ visible: boolean; messageId: string | null; topY: number }>({
    visible: false,
    messageId: null,
    topY: 200,
  });

  const [isRecording, setIsRecording] = useState(false);

  // Custom Camera / Gallery States
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [cameraSource, setCameraSource] = useState<'camera' | 'gallery' | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  // Voice Note Gesture Responders
  const touchStartX = useRef(0);
  const [slideCancelActive, setSlideCancelActive] = useState(false);
  const [recordingCancelled, setRecordingCancelled] = useState(false);
  const [recordingStatusText, setRecordingStatusText] = useState('Recording...');

  // Audio Recorder Hook
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Socket and Input tracking refs
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCurrentlyTyping = useRef(false);
  const listRef = useRef<any>(null);

  // Typing indicator dots bounce loop animation
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  // Recording Wave Height animations
  const barHeight1 = useRef(new Animated.Value(6)).current;
  const barHeight2 = useRef(new Animated.Value(12)).current;
  const barHeight3 = useRef(new Animated.Value(18)).current;
  const barHeight4 = useRef(new Animated.Value(10)).current;
  const barHeight5 = useRef(new Animated.Value(14)).current;
  const waveAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const startWaveAnimation = () => {
    const loop = (val: Animated.Value, min: number, max: number, duration: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: max, duration, useNativeDriver: false }),
          Animated.timing(val, { toValue: min, duration, useNativeDriver: false }),
        ])
      );
    };

    const anim = Animated.parallel([
      loop(barHeight1, 4, 18, 300),
      loop(barHeight2, 8, 24, 250),
      loop(barHeight3, 12, 32, 280),
      loop(barHeight4, 6, 20, 220),
      loop(barHeight5, 8, 22, 260),
    ]);
    waveAnimRef.current = anim;
    anim.start();
  };

  const stopWaveAnimation = () => {
    if (waveAnimRef.current) {
      waveAnimRef.current.stop();
    }
    barHeight1.setValue(6);
    barHeight2.setValue(12);
    barHeight3.setValue(18);
    barHeight4.setValue(10);
    barHeight5.setValue(14);
  };

  useEffect(() => {
    let animationLoop: any = null;
    if (isPartnerTyping) {
      const animateDot = (dot: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dot, {
              toValue: -8,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.delay(500),
          ])
        );
      };

      animationLoop = Animated.parallel([
        animateDot(dot1, 0),
        animateDot(dot2, 150),
        animateDot(dot3, 300),
      ]);
      animationLoop.start();
    } else {
      dot1.setValue(0);
      dot2.setValue(0);
      dot3.setValue(0);
    }

    return () => {
      if (animationLoop !== null) {
        animationLoop.stop();
      }
    };
  }, [isPartnerTyping, dot1, dot2, dot3]);

  // Reply preview sliding translateY transition
  useEffect(() => {
    if (replyTarget !== null) {
      setLocalReplyTarget(replyTarget);
      Animated.spring(replyTranslateY, {
        toValue: 0,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(replyTranslateY, {
        toValue: 60,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setLocalReplyTarget(null);
      });
    }
  }, [replyTarget, replyTranslateY]);

  // Mark all unread messages as seen
  const handleMarkMessagesSeen = async (unreadIds: string[]) => {
    if (accessToken === null) {
      return;
    }
    for (const msgId of unreadIds) {
      try {
        await chatApi.markSeen(msgId, accessToken);
      } catch {
        // Safe fail
      }
    }
  };

  // Fetch Partner & Message History
  useEffect(() => {
    if (accessToken === null || activeChatId === null) {
      return;
    }

    const loadChatData = async () => {
      try {
        // Fetch partner details
        const partnerDetails = await chatApi.getPartnerDetails(accessToken);
        setPartner(partnerDetails);

        // Fetch history
        const messageHistory = await chatApi.listMessages(activeChatId, accessToken, { limit: 50 });
        setMessages(messageHistory);

        // Resolve unread messages
        const unread = messageHistory.filter(
          (m) => m.senderId !== user?.id && m.status !== 'seen'
        );

        if (unread.length > 0) {
          const unreadIds = unread.map((m) => m.id);
          void handleMarkMessagesSeen(unreadIds);
        }
      } catch {
        // Safe fail
      } finally {
        setLoading(false);
      }
    };

    void loadChatData();
  }, [accessToken, activeChatId]);

  // Setup WebSockets
  useEffect(() => {
    if (accessToken === null || activeChatId === null || partner === null) {
      return;
    }

    const socket = connectSocket(accessToken);

    // Join room
    socket.emit('join-chat', { chatId: activeChatId });

    // Mark seen on join
    const unread = messages.filter((m) => m.senderId !== user?.id && m.status !== 'seen');
    if (unread.length > 0) {
      const lastUnread = unread[unread.length - 1];
      if (lastUnread !== undefined) {
        socket.emit('seen', { chatId: activeChatId, messageId: lastUnread.id });
      }
    }

    // Handlers
    const handleIncomingMessage = (message: Message) => {
      if (message.chatId !== activeChatId) {
        return;
      }
      setMessages((prev) => {
        // Skip duplicate
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });

      // Mark incoming as seen
      const currentUserId = useAuthStore.getState().user?.id;
      if (message.senderId !== currentUserId) {
        socket.emit('seen', { chatId: activeChatId, messageId: message.id });
        void chatApi.markSeen(message.id, accessToken);
      }
    };

    const handleSeen = (payload: any) => {
      const currentUserId = useAuthStore.getState().user?.id;
      setMessages((prev) =>
        prev.map((m) => (m.senderId === currentUserId ? { ...m, status: 'seen', seenAt: payload.seenAt, deleteAt: payload.deleteAt } : m))
      );
    };

    const handleDelivered = (payload: any) => {
      const currentUserId = useAuthStore.getState().user?.id;
      setMessages((prev) =>
        prev.map((m) =>
          m.senderId === currentUserId && m.status === 'sent'
            ? { ...m, status: 'delivered', deliveredAt: payload.deliveredAt }
            : m
        )
      );
    };

    const handleReaction = (payload: Message) => {
      setMessages((prev) => prev.map((m) => (m.id === payload.id ? { ...m, reactions: payload.reactions } : m)));
    };

    const handlePartnerTyping = (payload: any) => {
      if (partner !== null && payload.userId === partner.id && payload.chatId === activeChatId) {
        setIsPartnerTyping(true);
      }
    };

    const handlePartnerStopTyping = (payload: any) => {
      if (partner !== null && payload.userId === partner.id && payload.chatId === activeChatId) {
        setIsPartnerTyping(false);
      }
    };

    const handlePartnerOnline = (payload: { userId: string; lastSeenAt: string }) => {
      if (partner !== null && payload.userId === partner.id) {
        setPartner((prev: any) => prev !== null ? { ...prev, online: true, lastSeenAt: payload.lastSeenAt } : null);
      }
    };

    const handlePartnerOffline = (payload: { userId: string; lastSeenAt: string }) => {
      if (partner !== null && payload.userId === partner.id) {
        setPartner((prev: any) => prev !== null ? { ...prev, online: false, lastSeenAt: payload.lastSeenAt } : null);
      }
    };

    const handleDeleteMessageSocket = (payload: Message) => {
      setAnimatingDeleteIds((prev) => [...prev, payload.id]);
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== payload.id));
        setAnimatingDeleteIds((prev) => prev.filter((id) => id !== payload.id));
      }, 350);
    };

    socket.on('message', handleIncomingMessage);
    socket.on('reply', handleIncomingMessage);
    socket.on('seen', handleSeen);
    socket.on('delivered', handleDelivered);
    socket.on('reaction', handleReaction);
    socket.on('typing', handlePartnerTyping);
    socket.on('stop-typing', handlePartnerStopTyping);
    socket.on('online', handlePartnerOnline);
    socket.on('offline', handlePartnerOffline);
    socket.on('delete-message', handleDeleteMessageSocket);

    return () => {
      socket.emit('leave-chat', { chatId: activeChatId });
      socket.off('message', handleIncomingMessage);
      socket.off('reply', handleIncomingMessage);
      socket.off('seen', handleSeen);
      socket.off('delivered', handleDelivered);
      socket.off('reaction', handleReaction);
      socket.off('typing', handlePartnerTyping);
      socket.off('stop-typing', handlePartnerStopTyping);
      socket.off('online', handlePartnerOnline);
      socket.off('offline', handlePartnerOffline);
      socket.off('delete-message', handleDeleteMessageSocket);
      disconnectSocket();
    };
  }, [accessToken, activeChatId, partner?.id]);

  // Handle typing debounce
  const handleTextChange = (val: string) => {
    setText(val);

    const socket = connectSocket(accessToken!);
    if (!isCurrentlyTyping.current && val.trim().length > 0) {
      isCurrentlyTyping.current = true;
      socket.emit('typing', { chatId: activeChatId });
    }

    if (typingTimeoutRef.current !== null) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isCurrentlyTyping.current = false;
      socket.emit('stop-typing', { chatId: activeChatId });
    }, 1500);
  };

  // Submit Text Message wrapped in useCallback for stable references
  const handleSendMessage = useCallback(async (customText?: string, customReplyToId?: string) => {
    const textToSend = customText ?? text;
    if (textToSend.trim().length === 0 || accessToken === null || activeChatId === null) {
      return;
    }

    if (!customText) {
      setText('');
      isCurrentlyTyping.current = false;
      const socket = connectSocket(accessToken);
      socket.emit('stop-typing', { chatId: activeChatId });
      if (typingTimeoutRef.current !== null) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    const clientMsgId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: clientMsgId,
      chatId: activeChatId,
      senderId: user?.id ?? '',
      recipientId: partner?.id ?? '',
      clientMessageId: clientMsgId,
      type: 'text',
      text: textToSend,
      replyToMessageId: customReplyToId ?? replyTarget?.id ?? null,
      reactions: [],
      status: 'sent',
      deliveredAt: null,
      seenAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOptimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setReplyTarget(null);

    try {
      const messageInput: { text: string; clientMessageId: string; replyToMessageId?: string } = {
        text: textToSend,
        clientMessageId: clientMsgId,
      };
      if (optimisticMessage.replyToMessageId !== null) {
        messageInput.replyToMessageId = optimisticMessage.replyToMessageId;
      }

      const response = await chatApi.sendMessage(
        activeChatId,
        messageInput,
        accessToken
      );

      setMessages((prev) => prev.map((m) => (m.clientMessageId === clientMsgId ? response : m)));
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.clientMessageId === clientMsgId ? { ...m, isOptimistic: false, hasSendingFailed: true } : m))
      );
    }
  }, [text, replyTarget, accessToken, activeChatId, user?.id, partner?.id]);

  // Stable Double tap reaction (❤️)
  const handleDoubleTapReact = useCallback(async (messageId: string) => {
    if (accessToken === null) {
      return;
    }
    try {
      const response = await chatApi.setReaction(messageId, '❤️', accessToken);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? response : m)));
    } catch {
      // safe fail
    }
  }, [accessToken]);

  // Stable Long press emoji toolbar trigger
  const handleLongPressReact = useCallback((messageId: string, pageY: number) => {
    const calculatedY = Math.max(pageY - 70, 60);
    setReactionModal({
      visible: true,
      messageId,
      topY: calculatedY,
    });
  }, []);

  // Add Reaction from overlay toolbar
  const handleAddReaction = async (emoji: string) => {
    const { messageId } = reactionModal;
    setReactionModal({ visible: false, messageId: null, topY: 200 });

    if (messageId === null || accessToken === null) {
      return;
    }

    try {
      const response = await chatApi.setReaction(messageId, emoji, accessToken);
      setMessages((prev) => prev.map((m) => (m.id === messageId ? response : m)));
    } catch {
      // safe fail
    }
  };

  // Custom Camera Trigger
  const handleCameraPress = async () => {
    if (!cameraPermission || !cameraPermission.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert('Permission required', 'Allow camera access to capture photos.');
        return;
      }
    }
    setCameraSource('camera');
    setCameraOpen(true);
    setCapturedPhoto(null);
  };

  // Take Picture from CameraView
  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.6,
          skipProcessing: false,
        });
        if (photo && photo.uri) {
          setCapturedPhoto(photo.uri);
        }
      } catch (err: any) {
        Alert.alert('Capture Error', 'Failed to capture photo.');
      }
    }
  };

  // Confirm Send Captured Picture
  const handleSendCapturedPhoto = async () => {
    if (!capturedPhoto) {
      return;
    }
    const uri = capturedPhoto;
    setCameraOpen(false);
    setCapturedPhoto(null);
    setCameraSource(null);
    void uploadAndSendMedia('image', uri, replyTarget?.id);
  };

  // Gallery Picker with Preview Modal trigger
  const handleGalleryPress = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets?.[0];
    if (asset === undefined) {
      return;
    }

    setCameraSource('gallery');
    setCapturedPhoto(asset.uri);
    setCameraOpen(true);
  };

  // Handle uploading and sending media formatted text
  const uploadAndSendMedia = async (kind: 'image' | 'voice', fileUri: string, replyToId?: string) => {
    if (accessToken === null || activeChatId === null) {
      return;
    }
    
    // Optimistic UI immediately using localMediaUri
    const clientMsgId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: clientMsgId,
      chatId: activeChatId,
      senderId: user?.id ?? '',
      recipientId: partner?.id ?? '',
      clientMessageId: clientMsgId,
      type: 'text',
      text: `[media:${kind}:uploading]`,
      replyToMessageId: replyToId ?? null,
      reactions: [],
      status: 'sent',
      deliveredAt: null,
      seenAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isOptimistic: true,
      localMediaUri: fileUri,
    };
    
    setMessages((prev) => [...prev, optimisticMessage]);
    setReplyTarget(null);
    
    try {
      const response = await chatApi.uploadMediaFile(kind, fileUri, accessToken);
      const mediaEnvelope = `[media:${kind}:${response.secureUrl}]`;
      
      const messageInput: { text: string; clientMessageId: string; replyToMessageId?: string } = {
        text: mediaEnvelope,
        clientMessageId: clientMsgId,
      };
      if (optimisticMessage.replyToMessageId !== null) {
        messageInput.replyToMessageId = optimisticMessage.replyToMessageId;
      }

      const sentResponse = await chatApi.sendMessage(
        activeChatId,
        messageInput,
        accessToken
      );
      
      setMessages((prev) => prev.map((m) => (m.clientMessageId === clientMsgId ? sentResponse : m)));
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMsgId
            ? { ...m, isOptimistic: false, hasSendingFailed: true, localMediaUri: fileUri }
            : m
        )
      );
    }
  };

  // Stable Retry Failed Message Send / Upload
  const handleRetryMessage = useCallback(async (failedMsg: Message) => {
    setMessages((prev) => prev.filter((m) => m.id !== failedMsg.id));

    if (failedMsg.localMediaUri) {
      void uploadAndSendMedia('image', failedMsg.localMediaUri, failedMsg.replyToMessageId ?? undefined);
    } else {
      void handleSendMessage(failedMsg.text, failedMsg.replyToMessageId ?? undefined);
    }
  }, [handleSendMessage]);

  // Mic/Voice Note hold actions (Touch Responders)
  const handleMicTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
    setRecordingCancelled(false);
    setSlideCancelActive(false);
    setRecordingStatusText('Recording...');
    void handleStartRecording();
  };

  const handleMicTouchMove = (e: any) => {
    if (recordingCancelled || !isRecording) {
      return;
    }
    const currentX = e.nativeEvent.pageX;
    const diffX = touchStartX.current - currentX;
    if (diffX > 100) { // Dragged left by >100px
      setRecordingCancelled(true);
      void handleCancelRecording();
    } else if (diffX > 40) {
      setSlideCancelActive(true);
      setRecordingStatusText('Release to discard');
    } else {
      setSlideCancelActive(false);
      setRecordingStatusText('Recording...');
    }
  };

  const handleMicTouchEnd = () => {
    if (recordingCancelled) {
      return;
    }
    void handleStopAndSendRecording();
  };

  // Helper trigger to start record
  const handleStartRecording = async () => {
    try {
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Microphone access is required to record voice notes.');
        return;
      }

      await AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      await recorder.record();
      setIsRecording(true);
      startWaveAnimation();
    } catch {
      // safe fail
    }
  };

  // Helper trigger to cancel record
  const handleCancelRecording = async () => {
    try {
      await recorder.stop();
      setIsRecording(false);
      stopWaveAnimation();
      Alert.alert('Discarded', 'Voice note recording discarded.');
    } catch {
      setIsRecording(false);
      stopWaveAnimation();
    }
  };

  // Helper trigger to stop and send
  const handleStopAndSendRecording = async () => {
    if (!isRecording) {
      return;
    }

    try {
      await recorder.stop();
      setIsRecording(false);
      stopWaveAnimation();
      const uri = recorder.uri;
      if (uri) {
        void uploadAndSendMedia('voice', uri, replyTarget?.id);
      }
    } catch {
      setIsRecording(false);
      stopWaveAnimation();
    }
  };

  const activePartnerEmail = partner?.email ?? 'partner@ghost.app';
  const activePartnerName = getUsername(activePartnerEmail);
  const activePartnerBg = getAvatarColor(activePartnerEmail);

  const lastSenderMessage = [...messages].reverse().find((m) => m.senderId === user?.id);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigateTo('home')} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>

        <View style={styles.partnerInfo}>
          <View style={[styles.headerAvatarCircle, { backgroundColor: activePartnerBg }]}>
            <Text style={styles.headerAvatarInitial}>{activePartnerEmail.substring(0, 1).toUpperCase()}</Text>
          </View>
          <View style={styles.headerDetails}>
            <Text style={styles.headerName}>{activePartnerName}</Text>
            <Text style={styles.headerSubtext}>
              {partner?.online ? 'Active now' : formatLastSeen(partner?.lastSeenAt)}
            </Text>
          </View>
        </View>

        <View style={styles.headerSpacing} />
      </View>

      {/* Message Feed Feed list */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        {loading ? (
          <View style={styles.feedLoading}>
            <ActivityIndicator color={colors.text} size="large" />
          </View>
        ) : (
          <View style={styles.feedWrapper}>
            <TypedFlashList
              ref={listRef}
              data={messages}
              estimatedItemSize={90}
              drawDistance={500}
              keyExtractor={(item: Message) => item.id}
              contentContainerStyle={{
                paddingBottom: localReplyTarget ? 76 : 16,
              }}
              onContentSizeChange={() => {
                if (messages.length > 0) {
                  listRef.current?.scrollToEnd({ animated: true });
                }
              }}
              renderItem={({ item }: { item: Message }) => {
                const replyTo = item.replyToMessageId
                  ? messages.find((m) => m.id === item.replyToMessageId)
                  : null;
                const isDeleting = animatingDeleteIds.includes(item.id);
                return (
                  <MessageItem
                    currentUserId={user?.id ?? ''}
                    message={item}
                    onDoubleTapReact={handleDoubleTapReact}
                    onLongPressReact={handleLongPressReact}
                    onSwipeReply={setReplyTarget}
                    onRetry={handleRetryMessage}
                    partnerName={activePartnerName}
                    replyToMessage={replyTo}
                    isDeleting={isDeleting}
                  />
                );
              }}
            />

            {/* Live Typing indicator */}
            {isPartnerTyping && (
              <View style={styles.typingIndicatorRow}>
                <View style={[styles.typingAvatarCircle, { backgroundColor: activePartnerBg }]}>
                  <Text style={styles.typingAvatarInitial}>{activePartnerEmail.substring(0, 1).toUpperCase()}</Text>
                </View>
                <View style={typingBubbleStyle().wrapper}>
                  <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot1 }] }]} />
                  <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot2 }] }]} />
                  <Animated.View style={[styles.typingDot, { transform: [{ translateY: dot3 }] }]} />
                </View>
              </View>
            )}

            {/* Read/Seen ticks status */}
            {!isPartnerTyping && lastSenderMessage && (
              <Text style={styles.seenStatusText}>
                {lastSenderMessage.status === 'seen'
                  ? 'Seen'
                  : lastSenderMessage.status === 'delivered'
                  ? 'Delivered'
                  : 'Sent'}
              </Text>
            )}
          </View>
        )}

        {/* Bottom Section Wrapper housing absolutely translated Reply Preview */}
        <View style={styles.bottomSectionWrapper}>
          {localReplyTarget !== null && (
            <Animated.View style={[styles.replyPreviewDrawer, { transform: [{ translateY: replyTranslateY }] }]}>
              <View style={styles.replyDrawerBar} />
              <View style={styles.replyDrawerContent}>
                <Text numberOfLines={1} style={styles.replyDrawerTargetName}>
                  Replying to {localReplyTarget.senderId === user?.id ? 'yourself' : activePartnerName}
                </Text>
                <Text numberOfLines={1} style={styles.replyDrawerText}>
                  {parseMedia(localReplyTarget.text).mediaKind === 'image' || localReplyTarget.localMediaUri
                    ? '📷 Photo'
                    : parseMedia(localReplyTarget.text).mediaKind === 'voice'
                    ? '🎵 Voice Note'
                    : localReplyTarget.text}
                </Text>
              </View>
              <Pressable onPress={() => setReplyTarget(null)} style={styles.replyCloseBtn}>
                <Text style={styles.replyCloseText}>✕</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* Input Bar or Recording Wave Overlay */}
          <View style={styles.inputBar}>
            {isRecording ? (
              <View style={styles.recordingOverlayContainer}>
                <View style={styles.recordingWaveRow}>
                  <View style={styles.recordingPulseDot} />
                  <Text style={[styles.recordingStatusText, slideCancelActive && styles.recordingStatusTextCancel]}>
                    {recordingStatusText}
                  </Text>

                  <View style={styles.waveBarsContainer}>
                    <Animated.View style={[styles.waveBar, { height: barHeight1 }]} />
                    <Animated.View style={[styles.waveBar, { height: barHeight2 }]} />
                    <Animated.View style={[styles.waveBar, { height: barHeight3 }]} />
                    <Animated.View style={[styles.waveBar, { height: barHeight4 }]} />
                    <Animated.View style={[styles.waveBar, { height: barHeight5 }]} />
                  </View>
                </View>

                <Text style={styles.slideCancelIndicator}>
                  {slideCancelActive ? '✕ Discard' : '‹ Slide to cancel'}
                </Text>
              </View>
            ) : (
              <>
                <Pressable onPress={handleCameraPress} style={styles.iconBtn}>
                  <Text style={styles.inputIcon}>📷</Text>
                </Pressable>
                <Pressable onPress={handleGalleryPress} style={styles.iconBtn}>
                  <Text style={styles.inputIcon}>🖼️</Text>
                </Pressable>

                <View style={styles.inputWrapper}>
                  <TextInput
                    multiline
                    onChangeText={handleTextChange}
                    placeholder="Message..."
                    placeholderTextColor={colors.subtle}
                    style={styles.textInput}
                    value={text}
                  />
                  <Pressable style={styles.iconBtn}>
                    <Text style={styles.inputIcon}>😀</Text>
                  </Pressable>
                </View>
              </>
            )}

            {text.trim().length > 0 ? (
              <Pressable onPress={() => handleSendMessage()} style={styles.sendBtn}>
                <Text style={styles.sendText}>Send</Text>
              </Pressable>
            ) : (
              <View
                onTouchStart={handleMicTouchStart}
                onTouchMove={handleMicTouchMove}
                onTouchEnd={handleMicTouchEnd}
                style={[styles.iconBtn, isRecording && styles.iconBtnRecording]}
              >
                <Text style={styles.inputIcon}>{isRecording ? '🔴' : '🎤'}</Text>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Floating Reaction Toolbar modal */}
      {reactionModal.visible && (
        <Modal
          animationType="fade"
          onRequestClose={() => setReactionModal({ visible: false, messageId: null, topY: 200 })}
          transparent={true}
          visible={reactionModal.visible}
        >
          <Pressable
            style={styles.reactionBackdrop}
            onPress={() => setReactionModal({ visible: false, messageId: null, topY: 200 })}
          >
            <ReactionToolbar topY={reactionModal.topY} onSelectEmoji={handleAddReaction} />
          </Pressable>
        </Modal>
      )}

      {/* Immersive Camera / Gallery Preview Overlay Modal */}
      {cameraOpen && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={cameraOpen}
          onRequestClose={() => {
            setCameraOpen(false);
            setCapturedPhoto(null);
            setCameraSource(null);
          }}
        >
          <View style={styles.cameraContainer}>
            {capturedPhoto ? (
              // Photo Preview Overlay Screen (used for both Camera and Gallery)
              <View style={styles.cameraPreviewContainer}>
                <Image source={{ uri: capturedPhoto }} style={styles.cameraPreviewImage} resizeMode="cover" />

                <View style={styles.cameraPreviewOverlay}>
                  <Pressable
                    onPress={() => {
                      if (cameraSource === 'gallery') {
                        setCameraOpen(false);
                        setCapturedPhoto(null);
                        setCameraSource(null);
                      } else {
                        setCapturedPhoto(null);
                      }
                    }}
                    style={styles.cameraPreviewBtn}
                  >
                    <Text style={styles.cameraPreviewBtnText}>
                      {cameraSource === 'gallery' ? 'Cancel' : 'Retake'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={handleSendCapturedPhoto} style={[styles.cameraPreviewBtn, styles.cameraSendBtn]}>
                    <Text style={[styles.cameraPreviewBtnText, styles.cameraSendBtnText]}>Send</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              // Live Camera View Screen (only when cameraSource is 'camera')
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={cameraFacing}
              >
                <SafeAreaView style={styles.cameraSafeArea}>
                  {/* Camera Top Close controls */}
                  <View style={styles.cameraHeader}>
                    <Pressable
                      onPress={() => {
                        setCameraOpen(false);
                        setCameraSource(null);
                      }}
                      style={styles.cameraCloseBtn}
                    >
                      <Text style={styles.cameraCloseIcon}>✕</Text>
                    </Pressable>
                  </View>

                  {/* Camera Bottom Shutter controls */}
                  <View style={styles.cameraControls}>
                    <Pressable
                      onPress={() => setCameraFacing(prev => prev === 'back' ? 'front' : 'back')}
                      style={styles.cameraFlipBtn}
                    >
                      <Text style={styles.cameraFlipIcon}>🔄</Text>
                    </Pressable>

                    <Pressable onPress={handleCapture} style={styles.cameraCaptureBtnOuter}>
                      <View style={styles.cameraCaptureBtnInner} />
                    </Pressable>

                    <View style={styles.cameraSpacing} />
                  </View>
                </SafeAreaView>
              </CameraView>
            )}
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

// Helper for typing bubble styles to avoid type errors on animated values
const typingBubbleStyle = () => ({
  wrapper: [styles.typingBubble, { opacity: 1 }] as any,
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 0.5,
    flexDirection: 'row',
    height: 56,
    paddingHorizontal: spacing.md,
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 30,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '300',
    top: -4,
  },
  partnerInfo: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    paddingLeft: spacing.sm,
  },
  headerAvatarCircle: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  headerAvatarInitial: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '800',
  },
  headerDetails: {
    paddingLeft: spacing.sm,
  },
  headerName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  headerSubtext: {
    color: colors.muted,
    fontSize: 11,
  },
  headerSpacing: {
    width: 40,
  },
  feedLoading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  feedWrapper: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  rowContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.xs,
    width: '100%',
  },
  rowSender: {
    justifyContent: 'flex-end',
  },
  rowRecipient: {
    justifyContent: 'flex-start',
  },
  bubbleAndTimerWrapper: {
    flexDirection: 'column',
    maxWidth: 260,
  },
  swipeContainer: {
    flexDirection: 'row',
    position: 'relative',
  },
  replySwipeIconWrapper: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    position: 'absolute',
    width: 30,
  },
  replySwipeIcon: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '600',
  },
  messageBubble: {
    borderRadius: radii.lg,
    maxWidth: 260,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: 'relative',
    width: '100%',
  },
  bubbleSender: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleRecipient: {
    backgroundColor: colors.panel,
    borderBottomLeftRadius: 4,
  },
  bubbleOptimistic: {
    opacity: 0.6,
  },
  bubbleFailed: {
    borderColor: '#FF5A6A',
    borderWidth: 1,
    opacity: 0.85,
  },
  retryBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 90, 106, 0.15)',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
    width: 32,
  },
  retryIcon: {
    color: '#FF5A6A',
    fontSize: 18,
    fontWeight: 'bold',
    top: -1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  textSender: {
    color: colors.background,
  },
  textRecipient: {
    color: colors.text,
  },
  messageTime: {
    alignSelf: 'flex-end',
    fontSize: 9,
    marginTop: 4,
  },
  timeSender: {
    color: 'rgba(0,0,0,0.4)',
  },
  timeRecipient: {
    color: colors.subtle,
  },
  bubbleReplyPreview: {
    borderRadius: radii.sm,
    borderLeftWidth: 3,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  bubbleReplyPreviewSender: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderLeftColor: colors.background,
  },
  bubbleReplyPreviewRecipient: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderLeftColor: colors.text,
  },
  replyPreviewHeader: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 1,
  },
  replyPreviewText: {
    color: colors.text,
    fontSize: 13,
  },
  imageContentWrapper: {
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  voiceBubble: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    height: 38,
    width: 200,
  },
  voicePlayBtn: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  voicePlayIcon: {
    fontSize: 18,
  },
  voiceProgressTrack: {
    backgroundColor: 'rgba(128,128,128,0.2)',
    borderRadius: 2,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  voiceProgressBar: {
    height: '100%',
  },
  voiceDurationText: {
    fontSize: 11,
  },
  reactionsBadgeWrapper: {
    bottom: -10,
    flexDirection: 'row',
    gap: 2,
    position: 'absolute',
    right: 12,
  },
  reactionBadge: {
    backgroundColor: colors.panelRaised,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  reactionBadgeText: {
    fontSize: 11,
  },
  typingIndicatorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: spacing.xs,
    paddingLeft: spacing.xs,
  },
  typingAvatarCircle: {
    alignItems: 'center',
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  typingAvatarInitial: {
    color: colors.background,
    fontSize: 10,
    fontWeight: '800',
  },
  typingBubble: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: 4,
    height: 32,
    justifyContent: 'center',
    marginLeft: spacing.sm,
    width: 54,
  },
  typingDot: {
    backgroundColor: colors.muted,
    borderRadius: 3.5,
    height: 7,
    width: 7,
  },
  seenStatusText: {
    alignSelf: 'flex-end',
    color: colors.subtle,
    fontSize: 11,
    fontWeight: '600',
    marginRight: spacing.xs,
    marginTop: 2,
  },
  bottomSectionWrapper: {
    position: 'relative',
    zIndex: 10,
    backgroundColor: colors.background,
  },
  replyPreviewDrawer: {
    backgroundColor: colors.panel,
    borderTopColor: colors.border,
    borderTopWidth: 0.5,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    position: 'absolute',
    top: -60,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 1,
  },
  replyDrawerBar: {
    backgroundColor: colors.text,
    borderRadius: 2,
    height: '100%',
    width: 3,
  },
  replyDrawerContent: {
    flex: 1,
    paddingLeft: spacing.md,
  },
  replyDrawerTargetName: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyDrawerText: {
    color: colors.text,
    fontSize: 13,
  },
  replyCloseBtn: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  replyCloseText: {
    color: colors.muted,
    fontSize: 14,
  },
  inputBar: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 0.5,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    zIndex: 2,
  },
  iconBtn: {
    alignItems: 'center',
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  iconBtnRecording: {
    backgroundColor: 'rgba(255,90,106,0.15)',
    borderRadius: 19,
  },
  inputIcon: {
    fontSize: 20,
  },
  inputWrapper: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
  },
  textInput: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sendBtn: {
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  sendText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  reactionBackdrop: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    flex: 1,
  },
  reactionToolbar: {
    alignSelf: 'center',
    backgroundColor: colors.panelRaised,
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    position: 'absolute',
  },
  reactionItem: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  reactionItemPressed: {
    transform: [{ scale: 1.18 }],
  },
  reactionItemText: {
    fontSize: 24,
  },

  // Custom Camera Overlay Modal Styling
  cameraContainer: {
    backgroundColor: '#000',
    flex: 1,
  },
  cameraSafeArea: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  cameraCloseBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  cameraCloseIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cameraControls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  cameraFlipBtn: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  cameraFlipIcon: {
    fontSize: 22,
  },
  cameraCaptureBtnOuter: {
    alignItems: 'center',
    borderColor: '#fff',
    borderRadius: 40,
    borderWidth: 5,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  cameraCaptureBtnInner: {
    backgroundColor: '#fff',
    borderRadius: 30,
    height: 60,
    width: 60,
  },
  cameraSpacing: {
    width: 50,
  },
  cameraPreviewContainer: {
    flex: 1,
    position: 'relative',
  },
  cameraPreviewImage: {
    height: '100%',
    width: '100%',
  },
  cameraPreviewOverlay: {
    bottom: spacing.xl,
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  cameraPreviewBtn: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  cameraPreviewBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraSendBtn: {
    backgroundColor: colors.accent,
  },
  cameraSendBtnText: {
    color: colors.background,
  },
  imageBubbleImage: {
    borderRadius: radii.md,
    height: 260,
    width: 200,
  },

  // Live recording wave styling
  recordingOverlayContainer: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  recordingWaveRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  recordingPulseDot: {
    backgroundColor: '#FF5A6A',
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  recordingStatusText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  recordingStatusTextCancel: {
    color: '#FF5A6A',
  },
  waveBarsContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
    height: 36,
  },
  waveBar: {
    backgroundColor: '#FF5A6A',
    borderRadius: 1.5,
    width: 3,
  },
  slideCancelIndicator: {
    color: colors.subtle,
    fontSize: 13,
    fontWeight: '600',
  },

  // Disappearing countdown layout styling
  countdownText: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '600',
  },
  countdownSender: {
    alignSelf: 'flex-end',
    marginRight: 6,
  },
  countdownRecipient: {
    alignSelf: 'flex-start',
    marginLeft: 6,
  },
});

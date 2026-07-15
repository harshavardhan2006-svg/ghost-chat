import { useAuthStore } from '../store/auth-store';
import { useNavigationStore } from '../../../shared/store/navigation-store';
import { HomeScreen } from '../../chat/components/HomeScreen';
import { ChatScreen } from '../../chat/components/ChatScreen';
import { PairingScreen } from '../../pairing/components/PairingScreen';

export const ProtectedHomeScreen = () => {
  const user = useAuthStore((state) => state.user);
  const currentScreen = useNavigationStore((state) => state.currentScreen);

  if (user?.paired !== true) {
    return <PairingScreen />;
  }

  if (currentScreen === 'chat') {
    return <ChatScreen />;
  }

  return <HomeScreen />;
};

import { useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/features/auth/AuthContext';
import { LoginScreen } from './src/features/auth/screens/LoginScreen';
import { ProtectedHomeScreen } from './src/features/auth/screens/ProtectedHomeScreen';
import { RegisterScreen } from './src/features/auth/screens/RegisterScreen';
import { SplashScreen } from './src/features/auth/screens/SplashScreen';

type PublicScreen = 'login' | 'register';

const Root = () => {
  const auth = useAuth();
  const [publicScreen, setPublicScreen] = useState<PublicScreen>('login');

  if (auth.booting) {
    return <SplashScreen />;
  }

  if (auth.session !== null) {
    return <ProtectedHomeScreen />;
  }

  if (publicScreen === 'register') {
    return <RegisterScreen onLoginPress={() => setPublicScreen('login')} />;
  }

  return <LoginScreen onRegisterPress={() => setPublicScreen('register')} />;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="light-content" />
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

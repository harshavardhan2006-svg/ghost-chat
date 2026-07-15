import { create } from 'zustand';

type NavigationState = {
  currentScreen: 'home' | 'chat';
  activeChatId: string | null;
  navigateTo: (screen: 'home' | 'chat', chatId?: string | null) => void;
};

export const useNavigationStore = create<NavigationState>((set) => ({
  currentScreen: 'home',
  activeChatId: null,
  navigateTo: (screen, chatId = null) =>
    set({
      currentScreen: screen,
      activeChatId: chatId,
    }),
}));

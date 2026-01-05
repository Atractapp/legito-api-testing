import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/shallow';

type AIProvider = 'openai' | 'anthropic' | 'google';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  aiProvider: AIProvider;
  aiApiKey: string;
}

interface ChatActions {
  // Conversation management
  createConversation: () => string;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  clearConversation: (id: string) => void;

  // Message management
  addMessage: (message: Omit<Message, 'id'>) => void;
  updateMessage: (messageId: string, content: string) => void;

  // Settings
  setAiProvider: (provider: AIProvider) => void;
  setAiApiKey: (key: string) => void;

  // Getters
  getActiveConversation: () => Conversation | undefined;
  getActiveMessages: () => Message[];

  // Reset
  reset: () => void;
}

type ChatStore = ChatState & ChatActions;

const initialState: ChatState = {
  conversations: [],
  activeConversationId: null,
  aiProvider: 'google',
  aiApiKey: '',
};

function generateId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateTitle(content: string): string {
  // Take first 30 chars of first message as title
  const title = content.slice(0, 30).trim();
  return title.length < content.length ? `${title}...` : title;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      createConversation: () => {
        const id = generateId();
        const now = new Date().toISOString();
        const newConversation: Conversation = {
          id,
          title: 'New Chat',
          messages: [],
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          conversations: [newConversation, ...state.conversations],
          activeConversationId: id,
        }));

        return id;
      },

      deleteConversation: (id) => {
        set((state) => {
          const filtered = state.conversations.filter((c) => c.id !== id);
          const newActiveId =
            state.activeConversationId === id
              ? filtered[0]?.id || null
              : state.activeConversationId;

          return {
            conversations: filtered,
            activeConversationId: newActiveId,
          };
        });
      },

      setActiveConversation: (id) => {
        set({ activeConversationId: id });
      },

      clearConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id
              ? { ...c, messages: [], title: 'New Chat', updatedAt: new Date().toISOString() }
              : c
          ),
        }));
      },

      addMessage: (message) => {
        const messageWithId: Message = {
          ...message,
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        };

        set((state) => {
          let activeId = state.activeConversationId;

          // Create new conversation if none active
          if (!activeId) {
            const newId = generateId();
            const now = new Date().toISOString();
            const title = message.role === 'user' ? generateTitle(message.content) : 'New Chat';

            return {
              conversations: [
                {
                  id: newId,
                  title,
                  messages: [messageWithId],
                  createdAt: now,
                  updatedAt: now,
                },
                ...state.conversations,
              ],
              activeConversationId: newId,
            };
          }

          // Add to existing conversation
          return {
            conversations: state.conversations.map((c) => {
              if (c.id !== activeId) return c;

              const updatedMessages = [...c.messages, messageWithId];
              // Update title from first user message if it's still "New Chat"
              const title =
                c.title === 'New Chat' && message.role === 'user'
                  ? generateTitle(message.content)
                  : c.title;

              return {
                ...c,
                messages: updatedMessages,
                title,
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        });
      },

      updateMessage: (messageId, content) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== state.activeConversationId) return c;

            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, content } : m
              ),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      setAiProvider: (provider) => {
        set({ aiProvider: provider });
      },

      setAiApiKey: (key) => {
        set({ aiApiKey: key });
      },

      getActiveConversation: () => {
        const state = get();
        return state.conversations.find((c) => c.id === state.activeConversationId);
      },

      getActiveMessages: () => {
        const conversation = get().getActiveConversation();
        return conversation?.messages || [];
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'chat-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        aiProvider: state.aiProvider,
        // Don't persist API key for security - user re-enters on page load
        // aiApiKey: state.aiApiKey,
      }),
    }
  )
);

// Selector hooks
export const useActiveConversation = () =>
  useChatStore(useShallow((state) => {
    const id = state.activeConversationId;
    return id ? state.conversations.find((c) => c.id === id) : undefined;
  }));

export const useConversations = () =>
  useChatStore(useShallow((state) => state.conversations));

export const useActiveMessages = () =>
  useChatStore(useShallow((state) => {
    const conversation = state.conversations.find(
      (c) => c.id === state.activeConversationId
    );
    return conversation?.messages || [];
  }));

export const useChatSettings = () =>
  useChatStore(useShallow((state) => ({
    aiProvider: state.aiProvider,
    aiApiKey: state.aiApiKey,
  })));

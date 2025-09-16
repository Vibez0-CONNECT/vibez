
'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { ChatView } from './chat-view';
import { useAppShell } from './app-shell';
import { ChatList } from './chat-list';
import React from 'react';
import { useMobileKeyboardHeight } from '@/hooks/use-mobile-keyboard-height';

export function MobileChatLayout() {
  const {
    selectedChat,
    isAiReplying,
    currentUser,
    handleBack,
    messages,
    loadMoreMessages,
    hasMoreMessages,
    isLoadingMore,
  } = useAppShell();

  // Dynamically set height to visible viewport (accounts for keyboard)
  const { viewportHeight } = useMobileKeyboardHeight();

  return (
    <div
      className="flex flex-col w-full h-full overflow-hidden z-10"
      style={{ height: viewportHeight }}
    >
      {/* Top area: ChatList overlay (unchanged) */}
      {!selectedChat && (
        <motion.div
          className="absolute inset-0"
          animate={{ x: selectedChat ? '-100%' : '0%' }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          <ChatList />
        </motion.div>
      )}

      {/* Main chat area: only this scrolls! */}
      <div className="flex-1 min-h-0 relative overflow-y-auto">
        <AnimatePresence>
          {selectedChat && (
            <motion.div
              key="view"
              className="absolute inset-0"
              initial={{ x: '100%' }}
              animate={{ x: '0%' }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <ChatView
                chat={selectedChat}
                isAiReplying={isAiReplying}
                currentUser={currentUser}
                onBack={handleBack}
                messages={messages}
                loadMoreMessages={loadMoreMessages}
                hasMoreMessages={hasMoreMessages}
                isLoadingMore={isLoadingMore}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Message input is fixed at the bottom by ChatView sticky logic */}
    </div>
  );
}

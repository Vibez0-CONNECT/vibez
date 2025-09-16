
'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { ChatView } from './chat-view';
import { useAppShell } from './app-shell';
import { ChatList } from './chat-list';
import React from 'react';

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

  return (
    <div className="relative h-dvh w-full overflow-hidden z-10">
      <motion.div
        className="absolute inset-0"
        animate={{ x: selectedChat ? '-100%' : '0%' }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <ChatList />
      </motion.div>
      
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
  );
}

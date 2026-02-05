// Communication Hub Services
// Re-export all communication-related services

export * from './channels';
export * from './messages';
export * from './notifications';

// Convenience types for API responses
export interface ChannelSummary {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  type: 'public' | 'private' | 'event' | 'vendor' | 'announcement';
  participantCount: number;
  messageCount: number;
  lastActivityAt: Date | null;
  unreadCount?: number;
}

export interface MessageSummary {
  id: number;
  content: string;
  contentType: 'text' | 'system' | 'announcement';
  isPinned: boolean;
  isEdited: boolean;
  createdAt: Date;
  user: {
    id: number;
    username: string;
    avatarUrl: string | null;
  };
  replyCount: number;
  reactionCount: number;
}

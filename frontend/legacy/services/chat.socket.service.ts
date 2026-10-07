import { io, Socket } from 'socket.io-client';
import { API_URL } from "../config";

export interface IChatMessage {
  _id: string;
  matchId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
}

export interface IUserChatInfo {
  matchId: string;
  otherUserId: string;
  lastMessage?: IChatMessage;
  unreadCount: number;
  isOnline?: boolean;
}

class ChatSocketService {
  private socket: Socket | null = null;
  private onlineUsers: Set<string> = new Set();

  connect() {
    if (this.socket?.connected) {
      console.log('[CHAT SOCKET] Already connected');
      return;
    }

    this.socket = io(`${API_URL}/chat`, {
      // read on every (re)connect so a refreshed token is picked up
      auth: (cb) => cb({ token: localStorage.getItem('accessToken') }),
      withCredentials: true,
    });

    this.socket.on('connect', () => {
      console.log('[CHAT SOCKET] Connected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[CHAT SOCKET] Connection error:', error);
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.onlineUsers.clear();
  }

  registerUser(userId: string) {
    console.log('[CHAT SOCKET] Registering user:', userId);
    this.socket?.emit('register_user', userId);
  }

  joinChat(matchId: string) {
    console.log('[CHAT SOCKET] Joining chat:', matchId);
    this.socket?.emit('join_chat', matchId);
  }

  leaveChat(matchId: string) {
    console.log('[CHAT SOCKET] Leaving chat:', matchId);
    this.socket?.emit('leave_chat', matchId);
  }

  sendMessage(matchId: string, senderId: string, receiverId: string, content: string) {
    console.log('[CHAT SOCKET] Sending message:', { matchId, content });
    this.socket?.emit('send_message', { matchId, senderId, receiverId, content });
  }

  updateMessageStatus(messageId: string, status: 'delivered' | 'read') {
    console.log('[CHAT SOCKET] Updating message status:', { messageId, status });
    this.socket?.emit('update_message_status', { messageId, status });
  }

  getUserChats(userId: string) {
    console.log('[CHAT SOCKET] Getting user chats:', userId);
    this.socket?.emit('get_user_chats', userId);
  }

  onChatHistory(callback: (messages: IChatMessage[]) => void) {
    this.socket?.on('chat_history', callback);
  }

  onNewMessage(callback: (message: IChatMessage) => void) {
    this.socket?.on('new_message', callback);
  }

  onUserChats(callback: (chats: IUserChatInfo[]) => void) {
    this.socket?.on('user_chats', callback);
  }

  onError(callback: (error: { message: string }) => void) {
    this.socket?.on('error', callback);
  }

  onMessageStatusUpdated(callback: (data: { messageId: string; status: string }) => void) {
    this.socket?.on('message_status_updated', callback);
  }

  onUserStatusChanged(callback: (data: { userId: string; isOnline: boolean }) => void) {
    this.socket?.on('user_status_changed', (data) => {
      if (data.isOnline) {
        this.onlineUsers.add(data.userId);
      } else {
        this.onlineUsers.delete(data.userId);
      }
      callback(data);
    });
  }

  onOnlineUsers(callback: (users: string[]) => void) {
    this.socket?.on('online_users', (users) => {
      this.onlineUsers = new Set(users);
      callback(users);
    });
  }

  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  offChatHistory(callback: (messages: IChatMessage[]) => void) {
    this.socket?.off('chat_history', callback);
  }

  offNewMessage(callback: (message: IChatMessage) => void) {
    this.socket?.off('new_message', callback);
  }

  offUserChats(callback: (chats: IUserChatInfo[]) => void) {
    this.socket?.off('user_chats', callback);
  }

  offError(callback: (error: { message: string }) => void) {
    this.socket?.off('error', callback);
  }

  offMessageStatusUpdated(callback: (data: { messageId: string; status: string }) => void) {
    this.socket?.off('message_status_updated', callback);
  }

  offUserStatusChanged(callback: (data: { userId: string; isOnline: boolean }) => void) {
    this.socket?.off('user_status_changed', callback);
  }

  offOnlineUsers(callback: (users: string[]) => void) {
    this.socket?.off('online_users', callback);
  }
}

const chatSocketService = new ChatSocketService();
export default chatSocketService; 
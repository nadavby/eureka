import { Server, Socket } from 'socket.io';
import chatModel, { IChatMessage } from '../models/chat_model';

interface UserChatInfo {
  matchId: string;
  otherUserId: string;
  lastMessage?: IChatMessage;
  unreadCount: number;
  isOnline?: boolean;
}

interface ChatAggregation {
  _id: string;
  lastMessage: IChatMessage;
  unreadCount: number;
}

export const initChatSocket = (io: Server) => {
  // Create a namespace for chat
  const chatNamespace = io.of('/chat');
  
  // Track active users and their sockets
  const userSockets = new Map<string, Set<string>>();

  // Helper function to broadcast user status
  const broadcastUserStatus = (userId: string, isOnline: boolean) => {
    chatNamespace.emit('user_status_changed', { userId, isOnline });
  };

  chatNamespace.on('connection', (socket: Socket) => {
    console.log('[CHAT SOCKET] New connection:', socket.id);

    // Track user's active sockets
    socket.on('register_user', (userId: string) => {
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
        // Broadcast that user is online when their first socket connects
        broadcastUserStatus(userId, true);
      }
      userSockets.get(userId)?.add(socket.id);
      
      socket.data.userId = userId;

      // Send current online users to the newly connected user
      const onlineUsers = Array.from(userSockets.keys());
      socket.emit('online_users', onlineUsers);
      
      console.log(`[CHAT SOCKET] User ${userId} registered with socket ${socket.id}`);
    });

    // Join a chat room based on matchId
    socket.on('join_chat', async (matchId: string) => {
      socket.join(matchId);
      console.log(`[CHAT SOCKET] Client ${socket.id} joined chat room: ${matchId}`);

      // Load and send chat history
      try {
        const messages = await chatModel.find({ matchId })
          .sort({ timestamp: 1 })
          .limit(100)
          .lean();
        socket.emit('chat_history', messages);

        // Mark messages as delivered for this user
        if (socket.data.userId) {
          await chatModel.updateMany(
            { 
              matchId,
              senderId: { $ne: socket.data.userId },
              status: { $in: ['sent', 'delivered'] }
            },
            { status: 'delivered' }
          );
        }
      } catch (error) {
        console.error('[CHAT SOCKET] Error loading chat history:', error);
        socket.emit('error', { message: 'Failed to load chat history' });
      }
    });

    // Handle new messages
    socket.on('send_message', async (data: {
      matchId: string;
      senderId: string;
      receiverId: string;
      content: string;
    }) => {
      try {
        // Create and save the message
        const message = new chatModel({
          matchId: data.matchId,
          senderId: data.senderId,
          receiverId: data.receiverId,
          content: data.content,
          status: 'sent'
        });
        await message.save();

        // Broadcast to all clients in the room
        chatNamespace.to(data.matchId).emit('new_message', message);
      } catch (error) {
        console.error('[CHAT SOCKET] Error saving message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle message status updates
    socket.on('update_message_status', async (data: {
      messageId: string;
      status: 'delivered' | 'read';
    }) => {
      try {
        const message = await chatModel.findByIdAndUpdate(
          data.messageId,
          { status: data.status },
          { new: true }
        );
        if (message) {
          chatNamespace.to(message.matchId).emit('message_status_updated', {
            messageId: message._id,
            status: data.status
          });
        }
      } catch (error) {
        console.error('[CHAT SOCKET] Error updating message status:', error);
      }
    });

    // Get user's chats
    socket.on('get_user_chats', async (userId: string) => {
      try {
        // Find all matches where the user has messages, including resolved items
        const userChats = await chatModel.aggregate([
          { 
            $match: { 
              $or: [{ senderId: userId }, { receiverId: userId }],
            }
          },
          { $sort: { timestamp: -1 } },
          {
            $group: {
              _id: '$matchId',
              lastMessage: { $first: '$$ROOT' },
              unreadCount: {
                $sum: {
                  $cond: [
                    { 
                      $and: [
                        { $ne: ['$senderId', userId] },
                        { $in: ['$status', ['sent', 'delivered']] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ]);

        const chatInfos: UserChatInfo[] = userChats.map((chat: ChatAggregation) => ({
          matchId: chat._id,
          otherUserId: chat.lastMessage.senderId === userId 
            ? chat.lastMessage.receiverId 
            : chat.lastMessage.senderId,
          lastMessage: chat.lastMessage,
          unreadCount: chat.unreadCount,
          isOnline: userSockets.has(chat.lastMessage.senderId === userId 
            ? chat.lastMessage.receiverId 
            : chat.lastMessage.senderId)
        }));

        socket.emit('user_chats', chatInfos);
      } catch (error) {
        console.error('[CHAT SOCKET] Error getting user chats:', error);
        socket.emit('error', { message: 'Failed to load chats' });
      }
    });

    // Leave chat room
    socket.on('leave_chat', (matchId: string) => {
      socket.leave(matchId);
      console.log(`[CHAT SOCKET] Client ${socket.id} left chat room: ${matchId}`);
    });

    socket.on('disconnect', () => {
      // Remove socket from user's active sockets
      if (socket.data.userId) {
        const userSocketSet = userSockets.get(socket.data.userId);
        userSocketSet?.delete(socket.id);
        
        // If this was the user's last socket, broadcast offline status
        if (userSocketSet?.size === 0) {
          userSockets.delete(socket.data.userId);
          broadcastUserStatus(socket.data.userId, false);
        }
      }
      console.log('[CHAT SOCKET] Disconnected:', socket.id);
    });
  });

  return chatNamespace;
}; 
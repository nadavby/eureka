import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import chatSocketService, { IChatMessage, IUserChatInfo } from '../../services/chat.socket.service';
import userService, { IUser } from '../../services/user-service';
import matchService from '../../services/match-service';
import itemService, { Item } from '../../services/item-service';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faArrowLeft, faCircleNotch } from '@fortawesome/free-solid-svg-icons';
import ChatRoom from '../ChatRoom';
import './Chats.css';

interface EnhancedChatInfo extends IUserChatInfo {
  otherUserName?: string;
  userItem?: Item;
  otherItem?: Item;
}

const Chats: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<EnhancedChatInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState<EnhancedChatInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser?._id) return;

    // Connect to chat socket
    chatSocketService.connect();
    chatSocketService.registerUser(currentUser._id);

    // Listen for user status changes
    const handleUserStatus = (data: { userId: string; isOnline: boolean }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        if (data.isOnline) {
          newSet.add(data.userId);
        } else {
          newSet.delete(data.userId);
        }
        return newSet;
      });
    };

    // Get initial online users
    const handleOnlineUsers = (users: string[]) => {
      setOnlineUsers(new Set(users));
    };

    // Load initial chats
    chatSocketService.getUserChats(currentUser._id);

    // Set up event listeners
    const handleUserChats = async (userChats: IUserChatInfo[]) => {
      try {
        // Filter out any invalid chat objects
        const validChats = userChats.filter(chat => chat && chat.otherUserId && chat.matchId);
        
        // Fetch user names and match details for all chats
        const enhancedChats = await Promise.all(
          validChats.map(async (chat) => {
            try {
              const [userResponse, matchResponse] = await Promise.all([
                userService.getUserById(chat.otherUserId).request,
                matchService.getById(chat.matchId).request
              ]);

              const match = matchResponse.data;
              
              // Fetch both items
              const [item1Response, item2Response] = await Promise.all([
                itemService.getItemById(match.item1Id).request,
                itemService.getItemById(match.item2Id).request
              ]);

              const item1 = item1Response.data;
              const item2 = item2Response.data;

              // Determine which item belongs to the current user
              const userItem = item1.userId === currentUser?._id ? item1 : item2;
              const otherItem = item1.userId === currentUser?._id ? item2 : item1;

              return {
                ...chat,
                otherUserName: userResponse.data.userName,
                userItem,
                otherItem
              };
            } catch (error) {
              console.error(`Error fetching details for chat ${chat.matchId}:`, error);
              return {
                ...chat,
                otherUserName: 'Unknown User'
              };
            }
          })
        );

        setChats(enhancedChats);
        setIsLoading(false);
      } catch (error) {
        console.error('Error processing chats:', error);
        setError('Failed to load chat details');
        setIsLoading(false);
      }
    };

    const handleNewMessage = (message: IChatMessage) => {
      if (!message.senderId || !message.receiverId) return;

      // Update chats when a new message arrives
      setChats(prevChats => {
        const chatIndex = prevChats.findIndex(chat => chat.matchId === message.matchId);
        if (chatIndex === -1) {
          // If this is a new chat, add it to the list
          const newChat: EnhancedChatInfo = {
            matchId: message.matchId,
            otherUserId: message.senderId === currentUser._id ? message.receiverId : message.senderId,
            lastMessage: message,
            unreadCount: message.senderId === currentUser._id ? 0 : 1,
            isOnline: onlineUsers.has(message.senderId === currentUser._id ? message.receiverId : message.senderId)
          };
          return [...prevChats, newChat];
        }

        const updatedChats = [...prevChats];
        const chat = { ...updatedChats[chatIndex] };
        chat.lastMessage = message;
        
        if (message.senderId !== currentUser._id) {
          chat.unreadCount = (chat.unreadCount || 0) + 1;
        }

        updatedChats[chatIndex] = chat;
        return updatedChats;
      });
    };

    const handleError = (error: { message: string }) => {
      console.error('Chat error:', error);
      setError(error.message);
      setIsLoading(false);
    };

    chatSocketService.onUserChats(handleUserChats);
    chatSocketService.onNewMessage(handleNewMessage);
    chatSocketService.onError(handleError);
    chatSocketService.onUserStatusChanged(handleUserStatus);
    chatSocketService.onOnlineUsers(handleOnlineUsers);

    // Cleanup
    return () => {
      chatSocketService.offUserChats(handleUserChats);
      chatSocketService.offNewMessage(handleNewMessage);
      chatSocketService.offError(handleError);
      chatSocketService.offUserStatusChanged(handleUserStatus);
      chatSocketService.offOnlineUsers(handleOnlineUsers);
    };
  }, [currentUser?._id]);

  const filteredChats = chats.filter(chat =>
    chat.otherUserName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTimestamp = (timestamp?: Date) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isThisYear = date.getFullYear() === now.getFullYear();
    
    if (isToday) {
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    if (isThisYear) {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
    }
    
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="chats-container loading">
        <div className="loading-spinner">
          <FontAwesomeIcon icon={faCircleNotch} spin size="2x" />
          <p>Loading your chats...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chats-container error">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
        <button 
          className="btn btn-primary mt-3"
          onClick={() => navigate(-1)}
        >
          <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
          Go Back
        </button>
      </div>
    );
  }

  if (selectedChat) {
    return (
      <div className="chats-container">
        <div className="chat-header">
          <button 
            className="back-button" 
            onClick={() => setSelectedChat(null)}
          >
            <FontAwesomeIcon icon={faArrowLeft} />
          </button>
          <div className="chat-header-info">
            <h2>{selectedChat.otherUserName}</h2>
            <span className={`chat-status ${onlineUsers.has(selectedChat.otherUserId) ? 'online' : 'offline'}`}>
              {onlineUsers.has(selectedChat.otherUserId) ? 'Active Now' : 'Offline'}
            </span>
          </div>
        </div>
        <ChatRoom 
          matchId={selectedChat.matchId}
          otherUserId={selectedChat.otherUserId}
          userItem={selectedChat.userItem}
          otherItem={selectedChat.otherItem}
          onClose={() => setSelectedChat(null)}
        />
      </div>
    );
  }

  return (
    <div className="chats-container">
      <div className="chats-header">
        <div className="d-flex align-items-center gap-3">
          <button 
            className="btn btn-link text-dark p-0"
            onClick={() => navigate(-1)}
          >
            <FontAwesomeIcon icon={faArrowLeft} size="lg" />
          </button>
          <h2>Messages</h2>
        </div>
        <div className="search-container">
          <FontAwesomeIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="chats-list">
        {filteredChats.length === 0 ? (
          <div className="no-chats">
            {searchQuery ? 'No chats found' : 'No active chats'}
          </div>
        ) : (
          filteredChats.map((chat) => (
            <div
              key={chat.matchId}
              className="chat-preview"
              onClick={() => setSelectedChat(chat)}
            >
              <div className="chat-preview-avatar">
                {/* TODO: Add user avatar */}
                <div className="avatar-placeholder">
                  {chat.otherUserName?.charAt(0).toUpperCase() || '?'}
                </div>
              </div>
              <div className="chat-preview-content">
                <div className="chat-preview-header">
                  <span className="chat-preview-name">{chat.otherUserName}</span>
                  <span className="chat-preview-time">
                    {chat.lastMessage && formatTimestamp(chat.lastMessage.timestamp)}
                  </span>
                </div>
                <div className="chat-preview-message">
                  {chat.lastMessage?.content || 'No messages yet'}
                </div>
                {chat.userItem && chat.otherItem && (
                  <div className="chat-preview-items">
                    <img 
                      src={chat.userItem.imageUrl} 
                      alt="Your item"
                      className="chat-item-thumbnail"
                    />
                    <img 
                      src={chat.otherItem.imageUrl} 
                      alt="Their item"
                      className="chat-item-thumbnail"
                    />
                  </div>
                )}
              </div>
              {chat.unreadCount > 0 && (
                <div className="unread-badge">{chat.unreadCount}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Chats; 
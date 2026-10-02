import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCheckDouble } from '@fortawesome/free-solid-svg-icons';
import chatSocketService, { IChatMessage } from '../../services/chat.socket.service';
import itemService, { Item } from '../../services/item-service';
import matchService, { IMatch, IMatchResponse } from '../../services/match-service';
import { useNotifications } from '../../hooks/useNotifications';
import './ChatRoom.css';

interface ChatRoomProps {
  matchId: string;
  onClose?: () => void;
  userItem?: Item;
  otherItem?: Item;
  otherUserId?: string;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ matchId, onClose, userItem, otherItem, otherUserId }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { fetchNotifications } = useNotifications();
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [matchDetails, setMatchDetails] = useState<IMatch | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMatchDetails = async () => {
      try {
        const response = await matchService.getById(matchId).request;
        setMatchDetails(response.data);
      } catch (error) {
        console.error('Error fetching match details:', error);
      }
    };
    fetchMatchDetails();
  }, [matchId]);

  useEffect(() => {
    if (!currentUser?._id) return;

    // Connect to chat socket and join room
    chatSocketService.connect();
    chatSocketService.registerUser(currentUser._id);
    chatSocketService.joinChat(matchId);

    // Set up event listeners
    const handleChatHistory = (history: IChatMessage[]) => {
      setMessages(history);
      setIsLoading(false);
      // Mark all received messages as read
      history.forEach(msg => {
        if (msg.senderId !== currentUser._id && msg.status !== 'read') {
          chatSocketService.updateMessageStatus(msg._id, 'read');
        }
      });
    };

    const handleNewMessage = (message: IChatMessage) => {
      setMessages(prev => [...prev, message]);
      // Mark received message as read
      if (message.senderId !== currentUser._id) {
        chatSocketService.updateMessageStatus(message._id, 'read');
      }
    };

    const handleError = (error: { message: string }) => {
      console.error('Chat error:', error);
    };

    chatSocketService.onChatHistory(handleChatHistory);
    chatSocketService.onNewMessage(handleNewMessage);
    chatSocketService.onError(handleError);

    // Cleanup
    return () => {
      chatSocketService.leaveChat(matchId);
      chatSocketService.offChatHistory(handleChatHistory);
      chatSocketService.offNewMessage(handleNewMessage);
      chatSocketService.offError(handleError);
    };
  }, [matchId, currentUser?._id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser?._id || !otherUserId) return;

    chatSocketService.sendMessage(matchId, currentUser._id, otherUserId, newMessage.trim());
    setNewMessage('');
  };

  const isUserConfirmed = () => {
    if (!matchDetails || !currentUser?._id) return false;
    return currentUser._id === matchDetails.userId1 
      ? matchDetails.user1Confirmed 
      : matchDetails.user2Confirmed;
  };

  const isOtherUserConfirmed = () => {
    if (!matchDetails || !currentUser?._id) return false;
    return currentUser._id === matchDetails.userId1 
      ? matchDetails.user2Confirmed 
      : matchDetails.user1Confirmed;
  };

  const areBothConfirmed = () => {
    return matchDetails?.user1Confirmed && matchDetails?.user2Confirmed;
  };

  const handleConfirmMatch = async () => {
    if (!currentUser?._id) return;
    
    try {
      setIsConfirming(true);
      
      const response = await matchService.confirmMatch(matchId, currentUser._id).request;
      const { status, match: updatedMatch } = response.data;

      setMatchDetails(updatedMatch);

      // If both users have confirmed
      if (status === 'FULLY_CONFIRMED') {
        // Refresh notifications since they should be deleted
        await fetchNotifications();
        
        if (onClose) {
          onClose();
        }
        navigate('/', { 
          state: { 
            success: true, 
            message: 'Match confirmed! Both items have been marked as resolved.' 
          } 
        });
      }

      setIsConfirming(false);
    } catch (error) {
      console.error('Error confirming match:', error);
      setIsConfirming(false);
      // Show error message to user
      alert(error instanceof Error ? error.message : 'Failed to confirm match. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="chat-room loading">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-room">
      <div className="chat-header">
        <div className="chat-header-content">
          <h3>Chat</h3>
          {userItem && otherItem && (
            <div className="matched-items">
              <div className="matched-item">
                <img 
                  src={userItem.imageUrl} 
                  alt="Your item"
                  className="matched-item-thumbnail"
                />
                <span className="matched-item-label">Your item</span>
                {userItem.isResolved && <span className="resolved-badge">Resolved</span>}
                {isUserConfirmed() && <span className="confirmed-badge">You confirmed</span>}
              </div>
              <div className="matched-item">
                <img 
                  src={otherItem.imageUrl} 
                  alt="Their item"
                  className="matched-item-thumbnail"
                />
                <span className="matched-item-label">Their item</span>
                {otherItem.isResolved && <span className="resolved-badge">Resolved</span>}
                {isOtherUserConfirmed() && <span className="confirmed-badge">They confirmed</span>}
              </div>
            </div>
          )}
        </div>
        <div className="chat-actions">
          {userItem && otherItem && !userItem.isResolved && !otherItem.isResolved && !isUserConfirmed() && (
            <button 
              className="btn btn-success me-2" 
              onClick={handleConfirmMatch}
              disabled={isConfirming}
            >
              <FontAwesomeIcon icon={isOtherUserConfirmed() ? faCheckDouble : faCheck} className="me-2" />
              {isOtherUserConfirmed() ? 'Confirm Match (Final)' : 'Confirm Match'}
            </button>
          )}
          {onClose && (
            <button 
              className="close-button" 
              onClick={onClose}
              aria-label="Close chat"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="no-messages">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((message) => (
            <div
              key={message._id}
              className={`message ${message.senderId === currentUser?._id ? 'sent' : 'received'}`}
            >
              <div className="message-content">{message.content}</div>
              <div className="message-timestamp">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="message-input">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          disabled={areBothConfirmed()}
        />
        <button type="submit" disabled={!newMessage.trim() || areBothConfirmed()}>Send</button>
      </form>
    </div>
  );
};

export default ChatRoom; 
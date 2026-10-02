/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faExclamationTriangle,
  faEnvelope,
  faPhone,
  faUser
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../hooks/useAuth';
import itemService, { Item } from '../../services/item-service';
import matchService, { IMatch } from '../../services/match-service';
import userService, { IUser } from '../../services/user-service';
import chatSocketService from '../../services/chat.socket.service';
import { itemColors } from '../../data/itemColors';
import PhoneNumber from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import './MatchConfirmation.css';

interface MatchConfirmationProps {
  matchId?: string;
}

const MatchConfirmation: React.FC<MatchConfirmationProps> = (props) => {
  const { matchId: urlMatchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const matchId = props.matchId || urlMatchId;
  
  const [match, setMatch] = useState<IMatch | null>(null);
  const [userItem, setUserItem] = useState<Item | null>(null);
  const [otherItem, setOtherItem] = useState<Item | null>(null);
  const [otherUser, setOtherUser] = useState<IUser | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(1);

  const fetchMatchAndItems = useCallback(async () => {
    try {
      setLoading(true);
      
      // First fetch the match
      const matchResponse = await matchService.getById(matchId).request;
      const matchData = matchResponse.data;
      setMatch(matchData);
      
      // Then fetch both items and the other user's details in parallel
      const [item1Response, item2Response] = await Promise.all([
        itemService.getItemById(matchData.item1Id).request,
        itemService.getItemById(matchData.item2Id).request
      ]);
      
      const item1 = item1Response.data;
      const item2 = item2Response.data;

      // Determine which item belongs to the current user
      if (item1.userId === currentUser?._id) {
        setUserItem(item1);
        setOtherItem(item2);
        setOtherUserId(matchData.userId2);
        
        // Fetch other user's details
        const otherUserResponse = await userService.getUserById(matchData.userId2).request;
        setOtherUser(otherUserResponse.data);
      } else {
        setUserItem(item2);
        setOtherItem(item1);
        setOtherUserId(matchData.userId1);
        
        // Fetch other user's details
        const otherUserResponse = await userService.getUserById(matchData.userId1).request;
        setOtherUser(otherUserResponse.data);
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load match details');
    } finally {
      setLoading(false);
    }
  }, [matchId, currentUser?._id]);

  useEffect(() => {
    if (!matchId) {
      setError('Missing match ID');
      setLoading(false);
      return;
    }

    fetchMatchAndItems();
  }, [matchId, fetchMatchAndItems]);

  const handleNextStep = () => {
    if (!otherUserId) {
      setError('Cannot proceed: other user not found');
      return;
    }
    setConfirmStep(2);
  };

  const handleGoToChats = async () => {
    if (!currentUser?._id || !otherUserId || !match) return;

    try {
      // Connect to chat service
      chatSocketService.connect();
      chatSocketService.registerUser(currentUser._id);

      // Get user's chats to check if this chat already exists
      const existingChats = await new Promise<any[]>((resolve) => {
        const handleChats = (chats: any[]) => {
          resolve(chats);
          chatSocketService.offUserChats(handleChats);
        };
        chatSocketService.onUserChats(handleChats);
        chatSocketService.getUserChats(currentUser._id);
      });

      const chatExists = existingChats.some(chat => chat.matchId === match._id);

      // Only join and send initial message if chat doesn't exist
      if (!chatExists) {
        chatSocketService.joinChat(match._id);
        
        // Determine if current user is the finder or the owner
        const isCurrentUserFinder = userItem?.itemType === 'found';
        const initialMessage = isCurrentUserFinder
          ? "Hi, I found an item that might match the one you lost. I'd like to discuss it."
          : "Hi, I saw that you found an item that might be mine. I'd like to discuss it.";

        chatSocketService.sendMessage(
          match._id,
          currentUser._id,
          otherUserId,
          initialMessage
        );
      } else {
        // Just join the chat without sending a message
        chatSocketService.joinChat(match._id);
      }

      navigate('/chats');
    } catch (error) {
      console.error('Error handling chat creation:', error);
      navigate('/chats'); // Navigate anyway even if there's an error
    }
  };

  const formatLocation = (location: any): string => {
    if (!location) return "Unknown location";
    
    if (typeof location === 'string') return location;
    
    if (location && typeof location === 'object') {
      if (location.lat !== undefined && location.lng !== undefined) {
        return `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng.toFixed(4)}`;
      }
    }
    
    return String(location);
  };

  const getColorDisplay = (colorValue: string) => {
    // Remove any remaining spaces and convert to lowercase for comparison
    const cleanValue = colorValue.trim().toLowerCase();
    const color = itemColors.find(c => c.value.toLowerCase() === cleanValue);
    return color ? color.label : colorValue;
  };

  const getColorHex = (colorValue: string) => {
    // Remove any remaining spaces and convert to lowercase for comparison
    const cleanValue = colorValue.trim().toLowerCase();
    const color = itemColors.find(c => c.value.toLowerCase() === cleanValue);
    return color?.hexCode || '#e9ecef';
  };

  const parseColors = (colors: string | string[]): string[] => {
    if (!colors) return [];

    // If it's an array, process each element
    if (Array.isArray(colors)) {
      // Join all array elements and treat as one string to split properly
      const colorsString = colors.join(',');
      // Remove parentheses and split by comma
      return colorsString
        .replace(/[()]/g, '')
        .split(',')
        .map(color => color.trim().toLowerCase())
        .filter(color => color.length > 0);
    }

    // If it's a string
    if (typeof colors === 'string') {
      return colors
        .replace(/[()]/g, '')
        .split(',')
        .map(color => color.trim().toLowerCase())
        .filter(color => color.length > 0);
    }

    return [];
  };

  const isLightColor = (hexColor: string) => {
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminance > 0.7;
  };

  const renderItemDetails = (item: Item | null) => {
    if (!item) return null;

    return (
      <div className="card h-100">
        <div className="card-header bg-primary text-white">
          {item === userItem ? 'Your Item' : 'Matched Item'}
        </div>
        <div className="card-body">
          <div className="image-section">
            <img 
              src={item.imageUrl} 
              alt={item.description}
              className="img-fluid rounded"
            />
          </div>
          <div className="content-section">
            <p className="card-text">{item.description}</p>
            <ul className="item-details-list">
              <li>
                <strong>Type</strong>
                <p>{item.itemType === 'lost' ? 'Lost Item' : 'Found Item'}</p>
              </li>
              <li>
                <strong>Category</strong>
                <p>{item.category || <span className="missing-value">Not specified</span>}</p>
              </li>
              <li>
                <strong>Location</strong>
                <p>{formatLocation(item.location)}</p>
              </li>
              <li>
                <strong>Date</strong>
                <p>{item.date ? new Date(item.date).toLocaleDateString() : <span className="missing-value">Not specified</span>}</p>
              </li>
              {item.colors && item.colors.length > 0 && (
                <li>
                  <strong>Colors</strong>
                  <div className="colors-list">
                    {parseColors(item.colors).map((colorValue, index) => {
                      const hexColor = getColorHex(colorValue);
                      const displayName = getColorDisplay(colorValue);
                      return (
                        <span 
                          key={index} 
                          className={`color-tag ${isLightColor(hexColor) ? 'light-color' : ''}`}
                          style={{ backgroundColor: hexColor }}
                        >
                          {displayName}
                        </span>
                      );
                    })}
                  </div>
                </li>
              )}
              {item.brand && (
                <li>
                  <strong>Brand</strong>
                  <p>{item.brand}</p>
                </li>
              )}
              {item.condition && (
                <li>
                  <strong>Condition</strong>
                  <p>{item.condition}</p>
                </li>
              )}
              {item.flaws && (
                <li>
                  <strong>Notable Flaws</strong>
                  <p>{item.flaws}</p>
                </li>
              )}
              {item.material && (
                <li>
                  <strong>Material</strong>
                  <p>{item.material}</p>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="match-confirmation-container">
        <div className="loading-spinner">
          Loading match details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-4">
        <button 
          className="btn btn-outline-primary mb-3"
          onClick={() => navigate(-1)}>
          <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
          Back
        </button>


      <div className="match-confirmation-container">
        <div className="alert alert-danger">
          <FontAwesomeIcon icon={faExclamationTriangle} className="me-2" />
          {error}
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="match-confirmation-container">
        <div className="match-confirmation-header">
          <button
            className="btn btn-outline-primary mb-3 position-absolute top-0 start-0"
            onClick={() => navigate(-1)}>
            <FontAwesomeIcon icon={faArrowLeft} className="me-2" />
            Back
          </button>
          <h2>Match Confirmation</h2>
          <div className="match-confirmation-progress">
            <div className={`progress-step ${confirmStep >= 1 ? 'active' : ''}`}>
              <div className="step-number">1</div>
              <div className="step-label">Review Match</div>
            </div>
            <div className="progress-connector" />
            <div className={`progress-step ${confirmStep >= 2 ? 'active' : ''}`}>
              <div className="step-number">2</div>
              <div className="step-label">Contact Details</div>
            </div>
          </div>
        </div>

        <div className="match-confirmation-content">
          {confirmStep === 1 ? (
            <>
              <div className="row">
                {renderItemDetails(userItem)}
                {renderItemDetails(otherItem)}
              </div>
              <div className="match-confirmation-footer">
                <button
                  className="btn btn-primary"
                  onClick={handleNextStep}
                >
                  Continue to Contact Details
                </button>
              </div>
            </>
          ) : (
            <>
              {otherUser && (
                <div className="contact-details">
                  <div className="contact-info-item">
                    <FontAwesomeIcon icon={faUser} className="me-3" />
                    <div>
                      <strong>Name</strong>
                      <p>{otherUser.userName}</p>
                    </div>
                  </div>
                  <div className="contact-info-item">
                    <FontAwesomeIcon icon={faEnvelope} className="me-3" />
                    <div>
                      <strong>Email</strong>
                      <p>{otherUser.email}</p>
                    </div>
                  </div>
                  <div className="contact-info-item">
                    <FontAwesomeIcon icon={faPhone} className="me-3" />
                    <div>
                      <strong>Phone</strong>
                      {otherUser.phoneNumber ? (
                        <PhoneNumber
                          value={otherUser.phoneNumber}
                          disabled={true}
                          className="phone-display"
                          onChange={() => {}}
                        />
                      ) : (
                        <p>Not provided</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="match-confirmation-footer">
                <button
                  className="btn btn-primary"
                  onClick={handleGoToChats}
                >
                  Go to Chats
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchConfirmation; 
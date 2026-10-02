import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import { useAuth } from '../../hooks/useAuth';
import { Dropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faEnvelope, faEnvelopeOpen, faCheck, faCheckDouble, faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { INotification } from '../../services/notification-service';
import MatchDetailModal from '../MatchDetailModal';
import './styles.css';

interface NotificationProviderProps {
  children: React.ReactNode;
  notificationTrigger?: React.ReactNode;
}

const NotificationProvider: React.FC<NotificationProviderProps> = ({ children, notificationTrigger }) => {
  const { notifications, removeNotification, clearNotifications, markAsRead, markAllAsRead } = useNotifications();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<INotification | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);

  const handleToggle = (nextShow: boolean) => {
    setShow(nextShow);
  };

  const handleNotificationClick = async (notification: INotification) => {
    if (notification.type === 'MATCH_FOUND') {
      setSelectedNotification(notification);
      setShowMatchModal(true);
    }
    
    if (!notification.isRead && notification._id) {
      await markAsRead(notification._id);
    }
  };

  const handleRemoveNotification = async (e: React.MouseEvent, notification: INotification) => {
    e.stopPropagation();
    if (notification._id) {
      await removeNotification(notification._id);
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent, notification: INotification) => {
    e.stopPropagation();
    if (!notification.isRead && notification._id) {
      await markAsRead(notification._id);
    }
  };

  const handleViewDetails = () => {
    setShowMatchModal(false);
    setShow(false);
    
    if (selectedNotification?.matchId) {
      navigate(`/match-confirmation/${selectedNotification.matchId}`);
    }
  };

  const renderNotificationItem = (notification: INotification) => (
    <div 
      key={notification._id}
      className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
      onClick={() => handleNotificationClick(notification)}
    >
      <div className="notification-icon">
        {notification.isRead ? (
          <FontAwesomeIcon icon={faEnvelopeOpen} />
        ) : (
          <FontAwesomeIcon icon={faEnvelope} />
        )}
      </div>
      
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        <div className="notification-message">{notification.message}</div>
      </div>
      
      <div className="notification-actions">
        {!notification.isRead && (
          <button 
            className="action-btn read-btn"
            onClick={(e) => handleMarkAsRead(e, notification)}
            title="Mark as read"
          >
            <FontAwesomeIcon icon={faCheck} />
          </button>
        )}
        <button 
          className="action-btn delete-btn"
          onClick={(e) => handleRemoveNotification(e, notification)}
          title="Remove notification"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {isAuthenticated && (
        <Dropdown show={show} onToggle={handleToggle} align="end">
          <Dropdown.Toggle as="div" id="notification-dropdown">
            {notificationTrigger}
          </Dropdown.Toggle>

          <Dropdown.Menu className="notification-menu">
            <div className="notification-header">
              <h6 className="mb-0">Notifications ({notifications.length})</h6>
              <div className="notification-actions">
                {notifications.some(n => !n.isRead) && (
                  <button 
                    className="mark-all-read-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      markAllAsRead();
                    }}
                    title="Mark all as read"
                  >
                    <FontAwesomeIcon icon={faCheckDouble} />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button 
                    className="clear-all-btn" 
                    onClick={(e) => {
                      e.stopPropagation();
                      clearNotifications();
                    }}
                    title="Clear all notifications"
                  >
                    <FontAwesomeIcon icon={faTrashAlt} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="no-notifications">
                  No notifications
                </div>
              ) : (
                notifications.map(renderNotificationItem)
              )}
            </div>
          </Dropdown.Menu>
        </Dropdown>
      )}
      {children}

      {showMatchModal && selectedNotification && (
        <MatchDetailModal
          isOpen={showMatchModal}
          onClose={() => setShowMatchModal(false)}
          matchId={selectedNotification.matchId}
        />
      )}
    </>
  );
};

export default NotificationProvider; 
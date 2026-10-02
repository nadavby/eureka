import { FC, useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelope, faUser, faCheckCircle, faPercentage, faMapMarkerAlt, faCalendarAlt } from '@fortawesome/free-solid-svg-icons';
import './styles.css';
import itemService, { Item } from '../../services/item-service';
import matchService, { IMatch } from '../../services/match-service';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface MatchDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchId: string;
}

const MatchDetailModal: FC<MatchDetailModalProps> = ({
  isOpen,
  onClose,
  matchId
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [match, setMatch] = useState<IMatch | null>(null);
  const [userItem, setUserItem] = useState<Item | null>(null);
  const [otherItem, setOtherItem] = useState<Item | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!matchId) {
        console.log('No matchId provided');
        return;
      }
      
      console.log('Fetching match details for matchId:', matchId);
      setLoading(true);
      setError(null);
      
      try {
        // First fetch the match
        const matchResponse = await matchService.getById(matchId).request;
        const matchData = matchResponse.data;
        setMatch(matchData);
        
        // Then fetch both items
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
        } else {
          setUserItem(item2);
          setOtherItem(item1);
        }
      } catch (error: any) {
        console.error('Error fetching data:', error);
        setError(
          error.response?.data || 
          'Failed to load match details. Please try again.'
        );
      } finally {
        setLoading(false);
      }
    };
    
    if (isOpen) {
      fetchData();
    } else {
      // Clear state when modal closes
      setMatch(null);
      setUserItem(null);
      setOtherItem(null);
      setError(null);
    }
  }, [isOpen, matchId, currentUser?._id]);

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatLocation = (location: { lat: number; lng: number } | string) => {
    if (typeof location === 'string') return location;
    
    return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
  };

  const renderItem = (item: Item | null, isUserItem: boolean) => {
    if (!item) return null;
    
    return (
      <div className="match-detail-item">
        <div className="match-detail-item-image">
          {item.imageUrl && (
            <img 
              src={item.imageUrl} 
              alt={item.name} 
            />
          )}
        </div>
        <div className="match-detail-item-info">
          <h5>{item.name}</h5>
          <p className="item-description">{item.description}</p>
          <div className="item-details">
            <div className="detail-row">
              <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2" />
              {formatLocation(item.location)}
            </div>
            <div className="detail-row">
              <FontAwesomeIcon icon={faCalendarAlt} className="me-2" />
              {formatDate(item.date)}
            </div>
          </div>
          {!isUserItem && item.ownerName && (
            <div className="owner-detail mt-2">
              <FontAwesomeIcon icon={faUser} className="me-2" />
              {item.ownerName}
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleViewFullDetails = () => {
    if (match && userItem && otherItem) {
      navigate(`/match-confirmation/${matchId}`);
      onClose();
    }
  };

  return (
    <Modal show={isOpen} onHide={onClose} centered className="match-detail-modal">
      <Modal.Header closeButton>
        <Modal.Title>Match Details</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2">Loading match details...</p>
          </div>
        ) : error ? (
          <div className="alert alert-danger">
            <p className="mb-0">{error}</p>
            <small className="d-block mt-1">Match ID: {matchId}</small>
          </div>
        ) : match && userItem && otherItem ? (
          <>
            {match.matchScore && (
              <div className="match-score">
                <FontAwesomeIcon icon={faPercentage} className="me-2" />
                Match Score: <span>{Math.round(match.matchScore)}%</span>
              </div>
            )}
            
            <div className="match-detail-items">
              {renderItem(userItem, true)}
              
              <div className="match-divider">
                <div className="match-line"></div>
                <div className="match-icon">
                  <FontAwesomeIcon icon={faCheckCircle} />
                </div>
                <div className="match-line"></div>
              </div>
              
              {renderItem(otherItem, false)}
            </div>
          </>
        ) : (
          <div className="alert alert-warning">No match details available.</div>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button 
          variant="primary" 
          onClick={handleViewFullDetails}
          disabled={!match || !userItem || !otherItem}
        >
          View Full Details
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MatchDetailModal; 
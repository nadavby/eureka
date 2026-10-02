// src/pages/PublicUserProfile.tsx
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import userService, { IUser } from '../../services/user-service';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEnvelope, 
  faPhone, 
  faUser,
  faExclamationCircle 
} from '@fortawesome/free-solid-svg-icons';
import defaultAvatar from "../../assets/avatar.png";
import './styles.css';

const PublicUserProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const { request, abort } = userService.getUserById(userId);

    request
      .then((res) => {
        setUser(res.data);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "CanceledError") {
          console.error("Error loading user:", err);
          setError("Unable to load user profile");
        }
      })
      .finally(() => setLoading(false));

    return () => abort();
  }, [userId]);

  if (loading) {
    return (
      <div className="public-profile-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="public-profile-container">
        <div className="error-message">
          <FontAwesomeIcon icon={faExclamationCircle} size="2x" />
          <h2>Profile Not Found</h2>
          <p>{error || "This user profile is not available"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-profile-container">
      <div className="profile-card">
        <div className="profile-header">
          {user.imgURL ? (
            <img
              src={user.imgURL || defaultAvatar}
              alt={`${user.userName}'s profile`}
              className="profile-image"
              style={{ width: "120px", height: "120px", objectFit: "cover" }}
            />
          ) : (
            <img
              src={defaultAvatar}
              alt="Default profile"
              className="profile-image"
              style={{ width: "120px", height: "120px", objectFit: "cover" }}
            />
          )}
          <h1 className="profile-name">{user.userName}</h1>
        </div>

        <div className="profile-info">
          {user.email && (
            <div className="info-item">
              <FontAwesomeIcon icon={faEnvelope} className="info-icon" />
              <div className="info-content">
                <label>Email</label>
                <a href={`mailto:${user.email}`} className="info-value">
                  {user.email}
                </a>
              </div>
            </div>
          )}

          {user.phoneNumber && (
            <div className="info-item">
              <FontAwesomeIcon icon={faPhone} className="info-icon" />
              <div className="info-content">
                <label>Phone</label>
                <a href={`tel:${user.phoneNumber}`} className="info-value">
                  {user.phoneNumber}
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="profile-footer">
          <p>
            This is a public profile page for lost item recovery.
            If you found an item belonging to this person, please use the contact information above.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublicUserProfile;
/* eslint-disable @typescript-eslint/no-explicit-any */
/** @format */

import { FC, useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useUserItems } from "../../hooks/useItems";
import { useMatch,useMatchItems } from "../../hooks/useMatch";
import itemService, { Item } from "../../services/item-service";
import userService, { IUser } from "../../services/user-service";
import defaultAvatar from "../../assets/avatar.png";
import { Navigate, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { isValidPhoneNumber, formatPhoneNumber } from "../../utils/phoneUtils";
import { 
  faArrowLeft, 
  faImage, 
  faMapMarkerAlt,
  faCalendarAlt,
  faTag,
  faHandshake,
  faExchangeAlt,
  faCheckCircle,
  faSearch,
  faHandHoldingHeart,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, SubmitHandler } from "react-hook-form";
import "./styles.css";

interface Location {
  lat: number;
  lng: number;
}

interface UserData {
  _id: string;
  email: string;
  userName: string;
  phoneNumber?: string;
  imgURL?: string;
  password?: string;
  accessToken?: string;
  refreshToken?: string;
}

const profileFormSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  userName: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  phoneNumber: z.string().refine((val) => {
    return !val || isValidPhoneNumber(val);
  }, "Please enter a valid phone number").optional(),
  profileImage: z.instanceof(FileList).optional()
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

const UserProfile: FC = () => {
  const { currentUser, updateAuthState, isAuthenticated, loading } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localUser, setLocalUser] = useState<UserData | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [tempImageURL, setTempImageUrl] = useState<string | null>(null);
  const [matchesWithItems, setMatchesWithItems] = useState<any[]>([]);
  const navigate = useNavigate();
  
  // Get user items
  const { items: Items, setItems } = 
    useUserItems(currentUser?._id || "");

  // Get user matches
  const { matches, isLoading: matchesLoading, error: matchesError } = useMatch();

  // Get match items
  const matchIds = useMemo(() => {
    return matches.map(match => [match.item1Id, match.item2Id]).flat();
  }, [matches]);
  
  const { matchItems } = useMatchItems(matchIds);

  // Update matches with items when matchItems change
  useEffect(() => {
    if (!matches.length || !matchItems.length) {
      setMatchesWithItems([]);
      return;
    }
    const matchesWithDetails = matches.map(match => {
      const item1 = matchItems.find(item => item._id === match.item1Id);
      const item2 = matchItems.find(item => item._id === match.item2Id);

      return {
        ...match,
        item1,
        item2
      };
    });

    setMatchesWithItems(matchesWithDetails);
  }, [matches, matchItems]);

  // Transform items to match the expected structure
  const items = (Items as Item[]).map((item:Item) => ({
    _id: item._id,
    name: item.name,
    description: item.description,
    category: item.category,
    location: item.location ,
    date: item.date,
    itemType: (item.itemType) as 'lost' | 'found',
    imageUrl: item.imageUrl, 
    userId: item.userId,
    ownerName: item.ownerName,
    ownerEmail: item.ownerEmail,
    isResolved: item.isResolved ,
   matchId: item.matchedId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  }));

  const lostItems = items.filter(item => (item.itemType).toLowerCase() === 'lost');
  const foundItems = items.filter(item => (item.itemType ).toLowerCase() === 'found');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      email: currentUser?.email || "",
      userName: currentUser?.userName || "",
      password: "",
      phoneNumber: currentUser?.phoneNumber || ""
    }
  });

  const watchProfileImage = watch("profileImage");

  useEffect(() => {
    if (currentUser) {
      setLocalUser({
        _id: currentUser._id || "",
        email: currentUser.email || "",
        userName: currentUser.userName || "",
        phoneNumber: currentUser.phoneNumber,
        imgURL: currentUser.imgURL,
        password: currentUser.password,
        accessToken: currentUser.accessToken,
        refreshToken: currentUser.refreshToken
      });
    }
  }, [currentUser]);

  // Add this new effect to update form values when localUser changes or editing mode is enabled
  useEffect(() => {
    if (localUser && isEditing) {
      reset({
        email: localUser.email,
        userName: localUser.userName,
        password: "",
        phoneNumber: localUser.phoneNumber || "",
        profileImage: undefined
      });
    }
  }, [localUser, isEditing, reset]);

  useEffect(() => {
    if (watchProfileImage && watchProfileImage.length > 0) {
      const file = watchProfileImage[0];
      setSelectedImage(file);
      
      // Create and set the temporary URL for preview
      const newTempUrl = URL.createObjectURL(file);
      setTempImageUrl(newTempUrl);
      
      // Cleanup function to revoke the object URL
      return () => {
        URL.revokeObjectURL(newTempUrl);
      };
    }
  }, [watchProfileImage]);

  const onSubmit: SubmitHandler<ProfileFormData> = async (data) => {
    try {
      setIsUploading(true);
      
      const updatedUserData: Partial<IUser> = {
        email: data.email,
        userName: data.userName,
        phoneNumber: data.phoneNumber
      };
      
      if (data.password) {
        updatedUserData.password = data.password;
      }

      if (selectedImage) {
        try {
          const imageResponse = await userService.uploadImage(selectedImage);
          updatedUserData.imgURL = imageResponse.data.url;
        } catch (error) {
          console.error("Failed to upload image:", error);
          throw new Error("Failed to upload profile image");
        }
      }
      
      try {
        const { request } = userService.updateUser(localUser._id, updatedUserData);
        const updatedUser = await request;
        
        setLocalUser({
          ...localUser,
          ...updatedUser.data
        });
        
        setSelectedImage(null);
        setTempImageUrl(null);
        setIsEditing(false);
        
        await updateAuthState();
        // notify all listeners (e.g., Navigation) to refresh user data/avatar
        window.dispatchEvent(new Event('auth:updated'));
      } catch (error) {
        console.error("Failed to update user:", error);
        throw new Error("Failed to update user details");
      }
    } catch (error) {
      console.error("Failed to update user details:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelEdit = () => {
    if (localUser) {
      setValue("email", localUser.email);
      setValue("userName", localUser.userName || "");
      setValue("password", "");
      setValue("phoneNumber", localUser.phoneNumber || "");
    }
    setSelectedImage(null);
    setTempImageUrl(null);
    setIsEditing(false);
  };

  const handleDeleteAccount = async () => {
    if (!localUser || !localUser._id) return;
    
    if (window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      try {
        const { request } = userService.deleteUser(localUser._id);
        await request;
        window.location.href = "/login";
      } catch (error) {
        console.error("Failed to delete user account:", error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await userService.logout();
      window.location.href = "/login";
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  const handleDeleteItem = async (itemId?: string) => {
    if (!itemId) return;
    const confirmed = window.confirm("Are you sure you want to delete this item? This action cannot be undone.");
    if (!confirmed) return;
    try {
      const { request } = itemService.deleteItem(itemId);
      await request;
      setItems((prev) => prev.filter((it) => it._id !== itemId));
      setMatchesWithItems((prev) => prev.filter((m) => m.item1?._id !== itemId && m.item2?._id !== itemId));
    } catch (error) {
      console.error("Failed to delete item:", error);
      alert("Failed to delete item. Please try again.");
    }
  };


  const formatLocation = (location: string | Location): string => {
    if (typeof location === 'string') {
      return location;
    }
    return `${location.lat}, ${location.lng}`;
  };

  if (!loading && !isAuthenticated) return <Navigate to="/login" />;
  if (!localUser) return <div>Loading...</div>;

  

  return (
    <div className="profile-container">
      {!isAuthenticated && !loading && <Navigate to="/login" />}
      
      {/* Profile Section */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">Profile Details</h2>
        </div>

        {!isEditing ? (
          <div className="user-data-container">
            <div className="profile-picture-container">
              <img
                src={localUser?.imgURL || defaultAvatar}
                alt="Profile"
                className="profile-picture cursor-pointer"
                onClick={() => setIsEditing(true)}
                style={{
                  cursor: "pointer",
                  transition: "opacity 0.2s ease-in-out"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.opacity = "0.8";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              />
            </div>

            <div className="user-data-field">
              <span className="user-data-label">Username</span>
              <span className="user-data-value">{localUser?.userName}</span>
            </div>
            <div className="user-data-field">
              <span className="user-data-label">Email</span>
              <span className="user-data-value">{localUser?.email}</span>
            </div>
            {localUser?.phoneNumber && (
              <div className="user-data-field">
                <span className="user-data-label">Phone</span>
                <span className="user-data-value">{formatPhoneNumber(localUser.phoneNumber)}</span>
              </div>
            )}
            <div className="action-buttons">
              <button 
                className="btn btn-primary"
                onClick={() => setIsEditing(true)}
              >
                <FontAwesomeIcon icon={faImage} />
                Edit Profile
              </button>
              <button 
                className="btn btn-outline"
                onClick={handleLogout}
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                Logout
              </button>
              <button 
                className="btn btn-danger"
                onClick={handleDeleteAccount}
              >
                <FontAwesomeIcon icon={faHandshake} />
                Delete Account
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="user-data-container">
            <div className="profile-picture-container">
              <img
                src={tempImageURL || localUser?.imgURL || defaultAvatar}
                alt="Profile"
                className="profile-picture cursor-pointer"
                onClick={() => document.getElementById('profileImageInput')?.click()}
                style={{
                  cursor: "pointer",
                  transition: "opacity 0.2s ease-in-out"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.opacity = "0.8";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              />
              <input
                id="profileImageInput"
                type="file"
                className="d-none"
                accept="image/*"
                {...register("profileImage")}
              />
            </div>

            <div className="user-data-field">
              <label className="user-data-label">Username</label>
              <input
                type="text"
                className="form-input"
                {...register("userName")}
              />
              {errors.userName && (
                <span className="error-message">{errors.userName.message}</span>
              )}
            </div>
            
            <div className="user-data-field">
              <label className="user-data-label">Email</label>
              <input
                type="email"
                className="form-input"
                {...register("email")}
              />
              {errors.email && (
                <span className="error-message">{errors.email.message}</span>
              )}
            </div>
            
            <div className="user-data-field">
              <label className="user-data-label">Phone</label>
              <input
                type="tel"
                className="form-input"
                {...register("phoneNumber")}
              />
              {errors.phoneNumber && (
                <span className="error-message">{errors.phoneNumber.message}</span>
              )}
            </div>
            
            <div className="user-data-field">
              <label className="user-data-label">Password</label>
              <input
                type="password"
                className="form-input"
                {...register("password")}
                placeholder="Leave blank to keep current password"
              />
              {errors.password && (
                <span className="error-message">{errors.password.message}</span>
              )}
            </div>

            <div className="action-buttons">
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isUploading}
              >
                <FontAwesomeIcon icon={faCheckCircle} />
                {isUploading ? "Updating..." : "Save Changes"}
              </button>
              <button 
                type="button"
                className="btn btn-outline"
                onClick={handleCancelEdit}
              >
                <FontAwesomeIcon icon={faArrowLeft} />
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
      
      {/* Matches Section */}
      <div className="section-card">
        <div className="section-header">
          <h2 className="section-title">My Matches</h2>
        </div>
        
        {matchesLoading ? (
          <div className="text-center">Loading matches...</div>
        ) : matchesError ? (
          <div className="error-message">Error loading matches</div>
        ) : matchesWithItems.length === 0 ? (
          <div className="empty-state">
            <p>No matches found yet</p>
          </div>
        ) : (
          <div className="matches-grid">
            {matchesWithItems.map((match) => (
              <div key={match._id} className="match-card">
                <div className="match-items">
                  <div className="match-item">
                    <div className="match-item-image-container">
                      <img
                        src={match.item1?.imageUrl}
                        alt={match.item1?.name}
                        className="match-item-image"
                      />
                    </div>
                    <div className="match-item-details">
                      <h5>{match.item1?.name}</h5>
                      <p className="text-muted small">{match.item1?.category}</p>

                    </div>
                  </div>
                  <div className="match-connector">
                    <FontAwesomeIcon icon={faExchangeAlt} />
                  </div>
                  <div className="match-item">
                    <div className="match-item-image-container">
                      <img
                        src={match.item2?.imageUrl}
                        alt={match.item2?.name}
                        className="match-item-image"
                      />
                    </div>
                    <div className="match-item-details">
                      <h5>{match.item2?.name}</h5>
                      <p className="text-muted small">{match.item2?.category}</p>
                    </div>
                  </div>
                </div>
                <div className="match-actions">
                  <button
                    className="btn btn-outline-primary w-100"
                    onClick={() => navigate(`/match-confirmation/${match._id}`)}
                  >
                    <FontAwesomeIcon icon={faCheckCircle} className="me-2" />
                    Verify Match Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Lost Items Section */}
      <div className="section-card mb-5">
        <div className="section-header">
          <h2 className="section-title">
            <FontAwesomeIcon icon={faSearch} />
            <span>My Lost Items</span>
          </h2>
        </div>
        <div className="row g-4">
          {lostItems.map((item) => (
            <div key={item._id} className="col-sm-6 col-lg-4 col-xl-3">
              <div 
                className="item-card"
                onClick={() => navigate(`/item/${item._id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="card-img-wrapper">
                  <img 
                    src={item.imageUrl} 
                    alt={item.name || 'Unnamed Item'}
                    className="card-img-top"
                    style={{ height: "200px", objectFit: "cover" }}
                  />
                  {item.isResolved && (
                    <div className="badge-resolved">
                      Found
                    </div>
                  )}
                  <div className="card-overlay">
                    <h6 className="mb-1">{item.name}</h6>
                    <p className="mb-0 small">{item.description || 'No description'}</p>
                  </div>
                </div>
                <div className="card-body">
                  <div className="item-details">
                    <div className="detail">
                      <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2" />
                      {formatLocation(item.location) || 'Location not specified'}
                    </div>
                    <div className="detail">
                      <FontAwesomeIcon icon={faCalendarAlt} className="me-2" />
                      {new Date(item.date).toLocaleDateString()}
                    </div>
                    <div className="detail">
                      <FontAwesomeIcon icon={faTag} className="me-2" />
                      {item.category || 'Uncategorized'}
                    </div>
                  </div>
                  <div className="mt-3 d-flex justify-content-end">
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleDeleteItem(item._id); }}
                    >
                      <FontAwesomeIcon icon={faTrash} className="me-2" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {lostItems.length === 0 && (
            <div className="col-12">
              <div className="text-center py-5">
                <FontAwesomeIcon icon={faSearch} className="display-1 text-muted mb-4" />
                <p className="h4 text-muted">No lost items</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* My Found Items Section */}
      <div className="section-card mb-5">
        <div className="section-header">
          <h2 className="section-title">
            <FontAwesomeIcon icon={faHandHoldingHeart} />
            <span>My Found Items</span>
          </h2>
        </div>
        <div className="row g-4">
          {foundItems.map((item) => (
            <div key={item._id} className="col-sm-6 col-lg-4 col-xl-3">
              <div 
                className="item-card"
                onClick={() => navigate(`/item/${item._id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="card-img-wrapper">
                  <img 
                    src={item.imageUrl} 
                    alt={item.name || 'Unnamed Item'}
                    className="card-img-top"
                    style={{ height: "200px", objectFit: "cover" }}
                  />
                  {item.isResolved && (
                    <div className="badge-resolved">
                      Returned
                    </div>
                  )}
                  <div className="card-overlay">
                    <h6 className="mb-1">{item.name}</h6>
                    <p className="mb-0 small">{item.description || 'No description'}</p>
                  </div>
                </div>
                <div className="card-body">
                  <div className="item-details">
                    <div className="detail">
                      <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2" />
                      {formatLocation(item.location) || 'Location not specified'}
                    </div>
                    <div className="detail">
                      <FontAwesomeIcon icon={faCalendarAlt} className="me-2" />
                      {new Date(item.date).toLocaleDateString()}
                    </div>
                    <div className="detail">
                      <FontAwesomeIcon icon={faTag} className="me-2" />
                      {item.category || 'Uncategorized'}
                    </div>
                  </div>
                  <div className="mt-3 d-flex justify-content-end">
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleDeleteItem(item._id); }}
                    >
                      <FontAwesomeIcon icon={faTrash} className="me-2" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {foundItems.length === 0 && (
            <div className="col-12">
              <div className="text-center py-5">
                <FontAwesomeIcon icon={faHandHoldingHeart} className="display-1 text-muted mb-4" />
                <p className="h4 text-muted">No found items</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
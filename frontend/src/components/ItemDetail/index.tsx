/* eslint-disable @typescript-eslint/no-explicit-any */
/** @format */

import { GOOGLE_MAPS_API_KEY } from "../../config";
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faTag,
  faMapMarkerAlt,
  faCalendarAlt,
} from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../../hooks/useAuth';
import itemService, { Item } from '../../services/item-service';
import { 
  Map, 
  AdvancedMarker,
  Pin,
  APIProvider
} from "@vis.gl/react-google-maps";
import './ItemDetail.css';

const containerStyle = {
  width: "100%",
  height: "300px",
  borderRadius: '8px'
};

const defaultCenter = {
  lat: 32.0853,
  lng: 34.7818
};

const ItemDetail: React.FC = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemPosition, setItemPosition] = useState(defaultCenter);
  const [imageError, setImageError] = useState(false);

  const updateItemPosition = useCallback((itemData: any) => {
    if (itemData?.location?.lat && itemData?.location?.lng) {
      const lat = typeof itemData.location.lat === 'string' ? parseFloat(itemData.location.lat) : itemData.location.lat;
      const lng = typeof itemData.location.lng === 'string' ? parseFloat(itemData.location.lng) : itemData.location.lng;
      console.log('Updating item position:', { lat, lng });
      setItemPosition({ lat, lng });
    } else {
      console.log('No valid location data in item:', itemData?.location);
    }
  }, []);

  // Process image URL to ensure it's absolute
  const processImageUrl = useCallback((url: string) => {
    if (!url) return 'https://via.placeholder.com/60';
    
    // If it's already an absolute URL, return it
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If it's a relative URL starting with /public, adjust it
    if (url.startsWith('/public')) {
      return `${window.location.origin}${url}`;
    }
    
    // For other relative URLs
    return `${window.location.origin}/${url}`;
  }, []);

  // Memoize the processed image URL
  const processedImageUrl = useMemo(() => {
    return item?.imageUrl ? processImageUrl(item.imageUrl) : 'https://via.placeholder.com/60';
  }, [item?.imageUrl, processImageUrl]);

  useEffect(() => {
    console.log('Component mounted or itemId changed:', itemId);
    
    const fetchItem = async () => {
      if (!itemId) {
        console.log('No itemId provided');
        return;
      }
      
      try {
        setLoading(true);
        console.log('Fetching item data...');
        const { request } = itemService.getItemById(itemId);
        const response = await request;
        const itemData = response.data;
        console.log('Raw item data received:', itemData);
        console.log('Location from item:', itemData.location);
        
        setItem(itemData);
        updateItemPosition(itemData);
      } catch (error) {
        console.error('Error fetching item:', error);
        setError('Failed to load item details');
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [itemId, updateItemPosition]);

  // Log state changes
  useEffect(() => {
    console.log('State updated:', {
      loading,
      hasItem: !!item,
      itemPosition,
      itemLocation: item?.location
    });
  }, [loading, item, itemPosition]);

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

  if (loading) {
    return (
      <div className="item-detail-container">
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="item-detail-container">
        <div className="alert alert-danger">
          {error || 'Item not found'}
        </div>
        <button 
          className="back-button"
          onClick={() => navigate(-1)}
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Go Back</span>
        </button>
      </div>
    );
  }

  return (
    <div className="item-detail-container">
      <div className="item-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Back</span>
        </button>
        <h1 className="item-title">
          {item.itemType === 'lost' ? 'Lost' : 'Found'} Item Details
        </h1>
      </div>

      <div className="item-card">
        <div className="item-details">
          <div className="description-container">
            <h2 className="main-description">{item.description || 'No description available'}</h2>
          </div>

          <div className="details-section">
            <div className="row">
              <div className="col-md-6">
                <div className="item-image-container">
                  <img 
                    src={item.imageUrl} 
                    alt={item.description || 'Item image'}
                    className="item-image"
                  />
                </div>
              </div>

              <div className="col-md-6">
                <ul className="info-list">
                  <li className="info-item">
                    <div className="info-icon category">
                      <FontAwesomeIcon icon={faTag} />
                    </div>
                    <span className="info-label">Category</span>
                    <span className="info-value">{item.category}</span>
                  </li>
                  <li className="info-item">
                    <div className="info-icon location">
                      <FontAwesomeIcon icon={faMapMarkerAlt} />
                    </div>
                    <span className="info-label">Location</span>
                    <span className="info-value">{formatLocation(item.location)}</span>
                  </li>
                  <li className="info-item">
                    <div className="info-icon date">
                      <FontAwesomeIcon icon={faCalendarAlt} />
                    </div>
                    <span className="info-label">Date</span>
                    <span className="info-value">
                      {new Date(item.date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Map Section */}
            <div className="map-section">
              <h5>Location on Map</h5>
              <div style={{ width: "100%", margin: "0 auto" }}>
                <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                  <Map 
                    style={containerStyle} 
                    defaultCenter={itemPosition}
                    defaultZoom={15}
                    mapId="DEMO_MAP_ID"
                    gestureHandling={'greedy'}
                    disableDefaultUI={false}
                    zoomControl={true}
                    streetViewControl={false}
                    mapTypeControl={false}
                  >
                    {/* Item marker */}
                    <AdvancedMarker
                      position={itemPosition}
                      title={item.name}
                    >
                      <div style={{
                        padding: '2px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 2px 7px 1px rgba(0,0,0,0.3)',
                        width: '60px',
                        height: '60px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                      }}>
                      {!imageError ? (
                        <img
                          src={processedImageUrl}
                          alt={item.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '6px',
                          }}
                          onError={() => {
                            console.log('Marker image failed to load, using fallback');
                            setImageError(true);
                          }}
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: '#f0f0f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: '#666'
                        }}>
                          {item.name.substring(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    </AdvancedMarker>
                  </Map>
                </APIProvider>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemDetail; 
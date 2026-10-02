import { GOOGLE_MAPS_API_KEY } from "../../config";
import React, { useState, useMemo } from "react";
import { Map, AdvancedMarker, APIProvider } from "@vis.gl/react-google-maps";
import { useLostItems } from "../../hooks/useItems";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMapMarkedAlt,
  faList,
  faFilter,
  faSearch,
  faLayerGroup,
  faArrowLeft,
  faSpinner,
  faExclamationTriangle,
  faMapPin
} from "@fortawesome/free-solid-svg-icons";

const containerStyle = {
  width: "100%",
  height: "calc(100vh - 56px)" // Subtract navbar height
};

const center = {
  lat: 32.0853, // Tel Aviv
  lng: 34.7818
};

const getLatLng = (location: any) => {
  if (!location) return null;
  if (typeof location === "string") {
    const match = location.match(/Lat:\s*([\d.\-]+),\s*Lng:\s*([\d.\-]+)/);
    if (match) {
      return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
    try {
      const parsed = JSON.parse(location);
      if (parsed.lat && parsed.lng) return { lat: parsed.lat, lng: parsed.lng };
    } catch {
      return null;
    }
  }
  if (location.lat && location.lng) {
    const lat = typeof location.lat === 'string' ? parseFloat(location.lat) : location.lat;
    const lng = typeof location.lng === 'string' ? parseFloat(location.lng) : location.lng;
    return { lat, lng };
  }
  return null;
};

const LostItemsMap: React.FC = () => {
  const { items, isLoading, error } = useLostItems();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [showResolvedItems, setShowResolvedItems] = useState(true);
  const navigate = useNavigate();

  // Get unique categories from current items
  const availableCategories = useMemo(() => {
    if (!items) return [];
    const categories = items
      .map(item => item.category)
      .filter((category): category is string => 
        category !== undefined && category !== null && category !== ''
      );
    return Array.from(new Set(categories)).sort();
  }, [items]);

  const filteredItems = items.filter(item => {
    const matchesSearch = !searchTerm || 
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = !selectedCategory || 
      item.category?.toLowerCase() === selectedCategory.toLowerCase();

    const matchesResolved = showResolvedItems || !item.isResolved;

    return matchesSearch && matchesCategory && matchesResolved;
  });

  const selectedItem = selectedItemId ? items.find(item => item._id === selectedItemId) : null;

  if (!isLoading && error) {
    return (
      <div className="container-fluid d-flex align-items-center justify-content-center" style={{ height: "calc(100vh - 56px)" }}>
        <div className="text-center">
          <FontAwesomeIcon icon={faExclamationTriangle} className="display-1 text-danger mb-3" />
          <h3 className="text-danger">Error loading map</h3>
          <p className="text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="position-relative" style={{ height: "calc(100vh - 56px)" }}>
      {/* Control Panel */}
      <div className="position-absolute top-0 start-0 m-3 z-1" style={{ zIndex: 1000 }}>
        <div className="card shadow-lg" style={{ width: "300px" }}>
          <div className="card-header bg-white py-3">
            <div className="d-flex justify-content-between align-items-center">
              <h5 className="mb-0 d-flex align-items-center">
                <FontAwesomeIcon icon={faMapMarkedAlt} className="text-primary me-2" />
                Items Map
              </h5>
              <button 
                className="btn btn-sm btn-outline-secondary"
                onClick={() => navigate("/lost-items")}
              >
                <FontAwesomeIcon icon={faArrowLeft} className="me-1" />
                Back
              </button>
            </div>
          </div>
          <div className="card-body">
            {/* Search */}
            <div className="mb-3">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0">
                  <FontAwesomeIcon icon={faSearch} className="text-muted" />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Filters */}
            <div className="mb-3">
              <label className="form-label d-flex align-items-center">
                <FontAwesomeIcon icon={faFilter} className="text-muted me-2" />
                Category
              </label>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {availableCategories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            {/* Layer Toggle */}
            <div className="mb-3">
              <label className="form-label d-flex align-items-center">
                <FontAwesomeIcon icon={faLayerGroup} className="text-muted me-2" />
                Layers
              </label>
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="showResolved"
                  checked={showResolvedItems}
                  onChange={(e) => setShowResolvedItems(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="showResolved">
                  Show Returned Items
                </label>
              </div>
            </div>

            {/* Stats */}
            <div className="alert alert-light mb-0">
              <div className="d-flex justify-content-between align-items-center">
                <small className="text-muted">Items on map:</small>
                <span className="badge bg-primary">{filteredItems.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map 
          style={containerStyle} 
          defaultCenter={center}
          defaultZoom={13}
          mapId="DEMO_MAP_ID"
          gestureHandling={'greedy'}
          disableDefaultUI={false}
          zoomControl={true}
          streetViewControl={false}
          mapTypeControl={false}
        >
          {filteredItems.map((item) => {
            const pos = getLatLng(item.location);
            if (!pos) return null;

            return (
              <AdvancedMarker
                key={item._id}
                position={pos}
                title={item.name}
                onClick={() => setSelectedItemId(item._id || null)}
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
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: selectedItemId === item._id ? '2px solid #007bff' : 'none'
                }}>
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '6px',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/60';
                    }}
                  />
                  {item.isResolved && (
                    <div className="position-absolute top-0 end-0 m-1">
                      <span className="badge bg-success" style={{ fontSize: '8px' }}>
                        Returned
                      </span>
                    </div>
                  )}
                </div>
              </AdvancedMarker>
            );
          })}

          {selectedItem && selectedItemId && (
            <div 
              className="position-absolute bottom-0 start-50 translate-middle-x mb-3"
              style={{ zIndex: 1000, width: '300px' }}
            >
              <div className="card shadow-lg">
                <img 
                  src={selectedItem.imageUrl} 
                  alt={selectedItem.name}
                  className="card-img-top"
                  style={{ height: "150px", objectFit: "cover" }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150';
                  }}
                />
                <div className="card-body">
                  <h6 className="card-title">{selectedItem.name}</h6>
                  <p className="card-text small text-muted mb-2">{selectedItem.description}</p>
                  <div className="d-flex justify-content-between align-items-center">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/item/${selectedItem._id}`)}
                    >
                      Additional Details
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setSelectedItemId(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Map>
      </APIProvider>
    </div>
  );
};

export default LostItemsMap; 
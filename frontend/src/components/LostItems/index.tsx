/* eslint-disable @typescript-eslint/no-explicit-any */
/** @format */

import { FC, useState, useEffect, useMemo } from "react";
import { useLostItems } from "../../hooks/useItems";
import { useAuth } from "../../hooks/useAuth";
import { Item } from "../../services/item-service";
import { useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSearch,
  faMapMarkerAlt,
  faCalendarAlt,
  faTag,
  faPlus,
  faFilter,
  faMapMarked,
  faHandHoldingHeart,
  faLightbulb
} from "@fortawesome/free-solid-svg-icons";
import itemService from "../../services/item-service";
import EurekaParticles from './EurekaParticles';
import './styles.css';

type SortOption = 'newest' | 'oldest' | 'category';

const LostItems: FC = () => {
  const { items, isLoading, error, setItems, refreshItems } = useLostItems();
  const { isAuthenticated, loading: authLoading, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");

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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('newItem') === 'true') {
      refreshItems();
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate, refreshItems]);

  if (!authLoading && !isAuthenticated) {
    navigate("/login");
    return null;
  }

  const handleDelete = async (itemId: string) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;

    try {
      const { request } = itemService.deleteItem(itemId);
      await request;
      setItems((prevItems: Item[]) =>
        prevItems.filter((item) => item._id !== itemId)
      );
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const handleSortChange = (option: SortOption) => {
    setSortOption(option);
    setDropdownOpen(false);
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "N/A";
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObj.getTime())) {
        return "N/A";
      }
      return dateObj.toLocaleDateString();
    } catch (error) {
      console.error("Error formatting date:", date, error);
      return "N/A";
    }
  };

  const formatLocation = (location: any): string => {
    if (!location) return "Unknown location";
    
    if (typeof location === 'string') return location;
    
    if (location && typeof location === 'object') {
      if (typeof location === 'string') {
        try {
          const parsedLocation = JSON.parse(location);
          if (parsedLocation.lat && parsedLocation.lng) {
            return `Lat: ${parsedLocation.lat.toFixed(4)}, Lng: ${parsedLocation.lng.toFixed(4)}`;
          }
        } catch (e) {
            console.error("Error parsing location:", e);
        }
      }
      
      if (location.lat !== undefined && location.lng !== undefined) {
        return `Lat: ${location.lat.toFixed(4)}, Lng: ${location.lng.toFixed(4)}`;
      }
    }
    
    return String(location);
  };

  const getSortedAndFilteredItems = () => {
    if (!items) return [];
    
    let filteredItems = items;
    
    // Filter by search term
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      filteredItems = filteredItems.filter(item => {
        const name = (item.name || '').toLowerCase();
        const description = (item.description || '').toLowerCase();
        const category = (item.category || '').toLowerCase();
        const location = (item.location || '').toString().toLowerCase();
        
        return name.includes(term) || 
               description.includes(term) ||
               category.includes(term) ||
               location.includes(term);
      });
    }

    // Filter by category
    if (selectedCategory) {
      filteredItems = filteredItems.filter(item => 
        item.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }
    
    const itemsCopy = [...filteredItems];
    
    switch (sortOption) {
      case 'newest':
        return itemsCopy.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        });
      case 'oldest':
        return itemsCopy.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateA.getTime() - dateB.getTime();
        });
      case 'category':
        return itemsCopy.sort((a, b) => {
          const categoryA = a.category || '';
          const categoryB = b.category || '';
          return categoryA.localeCompare(categoryB);
        });
      default:
        return itemsCopy;
    }
  };

  const sortedAndFilteredItems = getSortedAndFilteredItems();

  return (
    <div className="lost-items-container">
      {/* Hero Section with Particle Animation */}
      <div className="hero-section">
        <EurekaParticles />
      </div>

      <div className="content-wrapper">
        <div className="lost-items-content">
          {/* Search Section */}
          <div className="search-container mb-5">
            <input
              type="text"
              className="search-bar"
              placeholder="Search for lost items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button
              className="action-button"
              onClick={() => navigate('/report-item')}
            >
              <FontAwesomeIcon icon={faPlus} />
              Report Item
            </button>
            <button
              className="action-button map-button"
              onClick={() => navigate('/map')}
            >
              <FontAwesomeIcon icon={faMapMarked} />
              Map View
            </button>
          </div>

          {/* Stats Section */}
          <div className="row g-4 mb-5">
            <div className="col-md-4">
              <div className="stats-card">
                <div className="card-body text-center">
                  <div className="stats-icon stats-primary mx-auto">
                    <FontAwesomeIcon icon={faLightbulb} />
                  </div>
                  <h3 className="h2 mb-2">{items.length}</h3>
                  <p className="text-muted mb-0">Reported Items</p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="stats-card">
                <div className="card-body text-center">
                  <div className="stats-icon stats-success mx-auto">
                    <FontAwesomeIcon icon={faHandHoldingHeart} />
                  </div>
                  <h3 className="h2 mb-2">
                    {items.filter(item => item.isResolved).length}
                  </h3>
                  <p className="text-muted mb-0">Returned Items</p>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="stats-card">
                <div className="card-body text-center">
                  <div className="stats-icon stats-warning mx-auto">
                    <FontAwesomeIcon icon={faSearch} />
                  </div>
                  <h3 className="h2 mb-2">
                    {items.filter(item => !item.isResolved).length}
                  </h3>
                  <p className="text-muted mb-0">Items in Search</p>
                </div>
              </div>
            </div>
          </div>

          {/* Items Grid */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white py-4">
              <div className="d-flex justify-content-between align-items-center">
                <h2 className="h4 mb-0">Recent Items</h2>
                <div className="d-flex gap-3">
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
                  
                  <select
                    className="form-select"
                    value={sortOption}
                    onChange={(e) => handleSortChange(e.target.value as SortOption)}
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="category">By Category</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="card-body p-4">
              {error && (
                <div className="alert alert-danger">
                  Error: {error}
                </div>
              )}

              {isLoading && (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              )}

              {!isLoading && sortedAndFilteredItems.length === 0 && (
                <div className="text-center py-5">
                  <FontAwesomeIcon icon={faHandHoldingHeart} className="display-1 text-muted mb-4" />
                  <p className="h4 text-muted">No items found</p>
                </div>
              )}

              <div className="row g-4">
                {sortedAndFilteredItems.map((item: Item) => {
                  const itemId = item._id;
                  if (!itemId) return null;
                  
                  return (
                    <div key={itemId} className="col-sm-6 col-lg-4 col-xl-3">
                      <div 
                        className="item-card"
                        onClick={() => navigate(`/item/${itemId}`)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="card-img-wrapper">
                          <img 
                            src={item.imageUrl} 
                            alt={item.name || 'Unnamed Item'}
                            className="card-img-top"
                            style={{ height: "200px", objectFit: "cover", width: "100%" }}
                            width="100%"
                          />
                          {item.isResolved && (
                            <div className="badge-resolved">
                              Returned to owner
                            </div>
                          )}
                          <div className="card-overlay">
                            <h6 className="mb-1">Additional Details</h6>
                            <p className="mb-0 small">{item.description || 'No description'}</p>
                          </div>
                        </div>
                        
                        <div className="card-body">
                          <h5 className="card-title h6 mb-3 text-truncate">
                            {item.description || 'No description available'}
                          </h5>
                          
                          <div className="card-meta mb-2">
                            <FontAwesomeIcon icon={faTag} className="text-primary" />
                            <span>{item.category || 'No category'}</span>
                          </div>
                          
                          <div className="card-meta">
                            <FontAwesomeIcon icon={faCalendarAlt} className="text-success" />
                            <span>{formatDate(item.date)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LostItems; 

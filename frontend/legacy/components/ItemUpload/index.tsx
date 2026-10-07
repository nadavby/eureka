/* eslint-disable @typescript-eslint/no-explicit-any */
/** @format */

import { GOOGLE_MAPS_API_KEY } from "../../config";
import { FC, useState, ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import itemService from "../../services/item-service";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUpload,
  faCamera,
  faArrowLeft,
  faTag,
  faMapMarkerAlt,
  faCalendarAlt,
  faLocationCrosshairs,
  faTrash
} from "@fortawesome/free-solid-svg-icons";
import { itemCategories, ItemCategoryGroup } from "../../data/itemCategories";
import { Map, AdvancedMarker, APIProvider, MapMouseEvent } from "@vis.gl/react-google-maps";
import { itemColors } from "../../data/itemColors";
import { getAvailableMaterials } from "../../data/ItemMaterials";
import "./styles.css";

interface Location {
  lat: number;
  lng: number;
}

interface ItemFormData {
  reportType: "lost" | "found";
  categoryGroup: string;
  itemType: string;
  customItemType?: string;
  itemDescription: string;
  colorSelections?: string[];
  brandName?: string;
  itemCondition?: string;
  notableDefects?: string;
  materialType?: string;
  incidentDate: string;
  location: Location | null;
}

const mapContainerStyle = {
  width: "100%",
  height: "300px",
  marginBottom: "1rem",
  borderRadius: "8px",
  border: "1px solid #e2e8f0"
};

const defaultCenter = {
  lat: 32.0853,
  lng: 34.7818
};

const MAP_ID = "8f541b0f4d9364bf";

const ItemUpload: FC = () => {
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, loading } = useAuth();
  const [apiKey] = useState(GOOGLE_MAPS_API_KEY);
  
  const [formData, setFormData] = useState<ItemFormData>({
    reportType: "lost",
    categoryGroup: "",
    itemType: "",
    customItemType: "",
    itemDescription: "",
    colorSelections: [],
    brandName: "",
    itemCondition: "",
    notableDefects: "",
    materialType: "",
    incidentDate: new Date().toISOString().split('T')[0],
    location: null
  });
  
  const [selectedCategoryGroup, setSelectedCategoryGroup] = useState<ItemCategoryGroup | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<any[]>([]);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherCategory, setOtherCategory] = useState<string>("");
  const [locationError, setLocationError] = useState<string | null>("Please select a location");

  const handleMapClick = (e: MapMouseEvent) => {
    const position = e.detail.latLng;
    if (position) {
      const newLocation = {
        lat: position.lat,
        lng: position.lng
      };
      setFormData(prev => ({
        ...prev,
        location: newLocation
      }));
      setLocationError(null);
    }
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          
          setFormData(prev => ({
            ...prev,
            location: newLocation
          }));
          setLocationError(null);
        },
        (error) => {
          console.error("Error getting location:", error);
          setError("Could not get your current location. Please select manually on the map.");
        }
      );
    } else {
      setError("Geolocation is not supported by your browser. Please select location manually on the map.");
    }
  };

  if (!loading && !isAuthenticated) {
    navigate("/login");
    return null;
  }

  const handleCategoryGroupChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const groupLabel = e.target.value;
    const group = itemCategories.find(g => g.label === groupLabel) || null;
    setSelectedCategoryGroup(group);
    setFormData(prev => ({
      ...prev,
      categoryGroup: groupLabel,
      itemType: ""
    }));
    setOtherCategory("");
    const materials = getAvailableMaterials(groupLabel);
    setAvailableMaterials(materials);
  };
  
  const handleColorChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const selectedColor = e.target.value;
    if (selectedColor && !selectedColors.includes(selectedColor)) {
      const newColors = [...selectedColors, selectedColor];
      setSelectedColors(newColors);
      setFormData(prev => ({
        ...prev,
        colorSelections: newColors
      }));
    }
    e.target.value = "";
  };
  
  const removeColor = (colorToRemove: string) => {
    const newColors = selectedColors.filter(color => color !== colorToRemove);
    setSelectedColors(newColors);
    setFormData(prev => ({
      ...prev,
      colorSelections: newColors
    }));
  };
  
  const getColorDisplay = (colorValue: string) => {
    const color = itemColors.find(c => c.value === colorValue);
    return color ? color.label : colorValue;
  };

  const getColorHex = (colorValue: string) => {
    const color = itemColors.find(c => c.value === colorValue);
    return color?.hexCode;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === "itemType") {
      setFormData(prev => ({
        ...prev,
        itemType: value
      }));
      
      if (value !== "other") {
        setOtherCategory("");
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadedImage(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!currentUser || !currentUser._id) {
      setError("You must be logged in to upload an item");
      return;
    }

    if (!formData.location) {
      setError("Please select a location on the map or use your current location");
      setLocationError("Please select a location");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const submitData = new FormData();
      
      const itemName = formData.itemType === "other" && otherCategory ? otherCategory : formData.itemType;
      submitData.append('name', itemName);
      submitData.append('description', formData.itemDescription);
      submitData.append('category', formData.categoryGroup);
      submitData.append('colors', formData.colorSelections?.join(', ') || '');
      submitData.append('brand', formData.brandName || '');
      submitData.append('condition', formData.itemCondition || '');
      submitData.append('flaws', formData.notableDefects || '');
      submitData.append('material', formData.materialType || '');
      submitData.append('location', formData.location ? JSON.stringify(formData.location) : '');
      submitData.append('date', formData.incidentDate);
      submitData.append('itemType', formData.reportType); 
      submitData.append('owner', currentUser._id);
      
      if (uploadedImage) {
        submitData.append('image', uploadedImage);
      }
      
      await itemService.addItem(submitData);


          navigate('/profile');
    } catch (err: any) {
      console.error("Error uploading item:", err);
      
      if (err.response?.status === 401) {
        setError("Authentication error: Your session may have expired. Please log in again.");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(err.response?.data?.message || "Failed to upload item");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="item-upload-container">
      <div className="item-upload-header">
        <button 
          className="back-button"
          onClick={() => navigate(-1)}
        >
          <FontAwesomeIcon icon={faArrowLeft} /> Back
        </button>
        <h1>{formData.reportType === "lost" ? "Report Lost Item" : "Report Found Item"}</h1>
      </div>

      <form onSubmit={handleSubmit} className="item-upload-form">
        <div className="form-section">
          <h2>Basic Information</h2>
          
          <div className="report-type-toggle">
            <button
              type="button"
              className={`toggle-button ${formData.reportType === "lost" ? "active" : ""}`}
              onClick={() => setFormData(prev => ({ ...prev, reportType: "lost" }))}
            >
              Lost Item
            </button>
            <button
              type="button"
              className={`toggle-button ${formData.reportType === "found" ? "active" : ""}`}
              onClick={() => setFormData(prev => ({ ...prev, reportType: "found" }))}
            >
              Found Item
            </button>
          </div>

          <div className="form-group">
            <label>
              <FontAwesomeIcon icon={faTag} />
              Category
            </label>
            <select
              name="categoryGroup"
              value={formData.categoryGroup}
              onChange={handleCategoryGroupChange}
              required
              className="form-select"
            >
              <option value="">Select a category</option>
              {itemCategories.map(group => (
                <option key={group.label} value={group.label}>
                  {group.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Item Type</label>
            <select
              name="itemType"
              value={formData.itemType}
              onChange={handleChange}
              required
              className="form-select"
              disabled={!selectedCategoryGroup}
            >
              <option value="">Select item type</option>
              {selectedCategoryGroup?.options.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
              <option value="other">Other</option>
            </select>
          </div>

          {formData.itemType === "other" && (
            <div className="form-group">
              <label>Custom Item Type</label>
              <input
                type="text"
                name="customItemType"
                value={formData.customItemType}
                onChange={handleChange}
                placeholder="Specify the item type"
                className="form-input"
                required
              />
            </div>
          )}
        </div>

        <div className="form-section">
          <h2>Item Details</h2>
          
          <div className="form-group">
            <label>Description</label>
            <textarea
              name="itemDescription"
              value={formData.itemDescription}
              onChange={handleChange}
              placeholder="Provide a detailed description of the item..."
              className="form-textarea"
              required
            />
          </div>

          <div className="form-group">
            <label>Colors</label>
            <div className="color-selection">
              <select
                onChange={handleColorChange}
                className="form-select"
              >
                <option value="">Add a color</option>
                {itemColors.map(color => (
                  <option key={color.value} value={color.value}>
                    {color.label}
                  </option>
                ))}
              </select>
              <div className="selected-colors">
                {selectedColors.map(color => (
                  <div 
                    key={color} 
                    className="color-tag"
                    style={{ backgroundColor: getColorHex(color) }}
                  >
                    {getColorDisplay(color)}
                    <button
                      type="button"
                      onClick={() => removeColor(color)}
                      className="remove-color"
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {availableMaterials.length > 0 && (
            <div className="form-group">
              <label>Material</label>
              <select
                name="materialType"
                value={formData.materialType}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">Select material</option>
                {availableMaterials.map(material => (
                  <option key={material.value} value={material.value}>
                    {material.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Brand</label>
            <input
              type="text"
              name="brandName"
              value={formData.brandName}
              onChange={handleChange}
              placeholder="Enter brand name if known"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Condition</label>
            <select
              name="itemCondition"
              value={formData.itemCondition}
              onChange={handleChange}
              className="form-select"
            >
              <option value="">Select condition</option>
              <option value="new">Like New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>
          </div>

          <div className="form-group">
            <label>Notable Defects</label>
            <textarea
              name="notableDefects"
              value={formData.notableDefects}
              onChange={handleChange}
              placeholder="Describe any damages, marks, or defects..."
              className="form-textarea"
            />
          </div>
        </div>

        <div className="form-section">
          <h2>Time and Location</h2>
          
          <div className="form-group">
            <label>
              <FontAwesomeIcon icon={faCalendarAlt} />
              Date
            </label>
            <input
              type="date"
              name="incidentDate"
              value={formData.incidentDate}
              onChange={handleChange}
              required
              className="form-input"
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="form-group">
            <label>
              <FontAwesomeIcon icon={faMapMarkerAlt} />
              Location
            </label>
            <div className="map-container">
              <APIProvider apiKey={apiKey}>
                <Map
                  style={mapContainerStyle}
                  defaultCenter={defaultCenter}
                  defaultZoom={13}
                  gestureHandling={'greedy'}
                  disableDefaultUI={false}
                  zoomControl={true}
                  streetViewControl={false}
                  mapTypeControl={false}
                  mapId={MAP_ID}
                  onClick={handleMapClick}
                >
                  {formData.location && (
                    <AdvancedMarker
                      position={formData.location}
                      draggable={true}
                      onDrag={(e) => {
                        if (e.latLng) {
                          setFormData(prev => ({
                            ...prev,
                            location: {
                              lat: e.latLng.lat(),
                              lng: e.latLng.lng()
                            }
                          }));
                          setLocationError(null);
                        }
                      }}
                    />
                  )}
                </Map>
              </APIProvider>
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                className="current-location-button"
              >
                <FontAwesomeIcon icon={faLocationCrosshairs} />
                Use Current Location
              </button>
              {locationError && (
                <div className="error-message">{locationError}</div>
              )}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Images</h2>
          
          <div className="image-upload-container">
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              id="image-upload"
              className="hidden-input"
            />
            <label htmlFor="image-upload" className="image-upload-label">
              {imagePreview ? (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                  <div className="image-overlay">
                    <FontAwesomeIcon icon={faCamera} />
                    <span>Change Image</span>
                  </div>
                </div>
              ) : (
                <>
                  <FontAwesomeIcon icon={faUpload} />
                  <span>Upload Image</span>
                </>
              )}
            </label>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        
        <button
          type="submit"
          className="submit-button"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </div>
  );
};

export default ItemUpload; 
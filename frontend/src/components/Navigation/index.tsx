import { FC, useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserCircle,
  faSearch,
  faUpload,
  faLightbulb,
  faMapMarkerAlt,
  faQrcode,
  faComments,
  faBell,
  faSignOutAlt
} from "@fortawesome/free-solid-svg-icons";
import { useNotifications } from "../../hooks/useNotifications";
import NotificationProvider from "../NotificationProvider";
import UserQRCode from "../UserQRCode";
import defaultAvatar from "../../assets/avatar.png";
import "./styles.css"; 

const Navigation: FC = () => {
  const { isAuthenticated, loading, currentUser, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isQRDropdownOpen, setIsQRDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const qrDropdownRef = useRef<HTMLDivElement>(null);
  const qrButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isQRDropdownOpen && 
          qrDropdownRef.current && 
          qrButtonRef.current && 
          !qrDropdownRef.current.contains(event.target as Node) &&
          !qrButtonRef.current.contains(event.target as Node)) {
        setIsQRDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isQRDropdownOpen]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  
  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const toggleQRDropdown = () => {
    setIsQRDropdownOpen(!isQRDropdownOpen);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrCode = document.querySelector('#qr-code')?.innerHTML;
    if (!qrCode) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Code</title>
          <style>
            body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .qr-container { text-align: center; }
          </style>
        </head>
        <body>
          <div class="qr-container">
            ${qrCode}
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleDownload = () => {
    const qrCode = document.querySelector('#qr-code canvas');
    if (!qrCode) return;

    const link = document.createElement('a');
    link.download = 'qr-code.png';
    link.href = (qrCode as HTMLCanvasElement).toDataURL();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="navbar navbar-dark bg-primary">
      <div className="container">
        <div className="navbar-left">
          <Link className="navbar-brand d-flex align-items-center" to="/lost-items" onClick={closeMenu}>
            <FontAwesomeIcon icon={faLightbulb} className="me-2" />
            <span>Eureka</span>
          </Link>
        </div>
        
        {!loading && isAuthenticated && (
          <>
            <div className="navbar-center">
              <NotificationProvider
                notificationTrigger={
                  <button 
                    className="btn btn-profile notification-button"
                    title="Notifications"
                    aria-label="View notifications"
                  >
                    <FontAwesomeIcon icon={faBell} size="lg" />
                    {unreadCount > 0 && (
                      <span className="notification-badge">{unreadCount}</span>
                    )}
                  </button>
                }
              >
                {null}
              </NotificationProvider>
            </div>

            <div className="navbar-right">
              {currentUser && (
                <div className="nav-icons-group">
                  <button 
                    className="navbar-toggler"
                    type="button"
                    onClick={toggleMenu}
                    aria-controls="navbarNav"
                    aria-expanded={isMenuOpen}
                    aria-label="Toggle navigation"
                  >
                    <span className="navbar-toggler-icon"></span>
                  </button>
                </div>
              )}
            </div>

            <div className={`navbar-collapse-container ${isMenuOpen ? 'show' : ''}`}>
              <div className="user-profile-section">
                <div className="user-info">
                  {currentUser?.imgURL ? (
                    <img
                      src={currentUser.imgURL}
                      alt={currentUser.userName}
                      className="user-avatar"
                    />
                  ) : (
                    <img
                      src={defaultAvatar}
                      alt="Default avatar"
                      className="user-avatar"
                    />
                  )}
                  <div className="user-details">
                    <span className="user-name">{currentUser?.userName || 'User'}</span>
                    <Link to="/profile" className="profile-link" onClick={closeMenu}>
                      View Profile
                    </Link>
                  </div>
                </div>
              </div>

              <ul className="navbar-nav">
                <li className="nav-item">
                  <Link
                    to="/lost-items"
                    className={`nav-link ${location.pathname === '/lost-items' ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    <FontAwesomeIcon icon={faSearch} className="me-2" />
                    Lost Items
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/report-item"
                    className={`nav-link ${location.pathname === '/report-item' ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    <FontAwesomeIcon icon={faUpload} className="me-2" />
                    Report Item
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/map"
                    className={`nav-link ${location.pathname === '/map' ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="me-2" />
                    Map
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    to="/chats"
                    className={`nav-link ${location.pathname === '/chats' ? 'active' : ''}`}
                    onClick={closeMenu}
                  >
                    <FontAwesomeIcon icon={faComments} className="me-2" />
                    Chats
                  </Link>
                </li>
              </ul>

              <div className="menu-section">
                <h6 className="menu-section-title">Tools</h6>
                <ul className="navbar-nav">
                  <li className="nav-item">
                    <button 
                      className="nav-link"
                      onClick={() => {
                        toggleQRDropdown();
                        closeMenu();
                      }}
                    >
                      <FontAwesomeIcon icon={faQrcode} className="me-2" />
                      My QR Code
                    </button>
                  </li>
                </ul>
              </div>

              <div className="menu-section">
                <h6 className="menu-section-title">Account</h6>
                <ul className="navbar-nav">
                  <li className="nav-item">
                    <button
                      className="nav-link logout-link"
                      onClick={() => {
                        closeMenu();
                        handleLogout();
                      }}
                    >
                      <FontAwesomeIcon icon={faSignOutAlt} className="me-2" />
                      Logout
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            {isQRDropdownOpen && (
              <>
                <div className="qr-modal-overlay" onClick={toggleQRDropdown}></div>
                <div 
                  ref={qrDropdownRef}
                  className="qr-modal" 
                  id="qr-dropdown"
                >
                  <div className="qr-content">
                    <button className="close-button" onClick={toggleQRDropdown}>×</button>
                    <h3 className="qr-title">Your Personal QR Code</h3>
                    <p className="qr-description">
                      Print or save this QR code to help others find you when they discover your lost items
                    </p>
                    <div id="qr-code">
                      <UserQRCode userId={currentUser._id} />
                    </div>
                    <div className="qr-actions">
                      <button 
                        className="btn btn-sm btn-outline-primary"
                        onClick={handlePrint}
                      >
                        Print QR
                      </button>
                      <button 
                        className="btn btn-sm btn-outline-primary"
                        onClick={handleDownload}
                      >
                        Save QR
                      </button>
                    </div>
                    <button 
                      className="btn btn-sm btn-link mt-2"
                      onClick={() => window.open(`${window.location.origin}/public-user/${currentUser._id}`, '_blank')}
                    >
                      Test QR Link →
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </nav>
  );
};

export default Navigation; 
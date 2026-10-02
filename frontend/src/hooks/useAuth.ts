/** @format */
import { useState, useEffect, useCallback } from "react";
import userService, { IUser } from "../services/user-service";
import { jwtDecode } from "jwt-decode";

interface DecodedToken {
  _id: string;
  email: string;
  username: string;
  exp: number;
}

export const useAuth = () => {
  const [currentUser, setCurrentUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  const logout = useCallback(() => {
    userService.logout();
    setCurrentUser(null);
    setLoading(false);
  }, []);

  const fetchUserDetails = useCallback(async () => {
    try {
      const user = await userService.getCurrentUser();
      setCurrentUser(user);
      return !!user;
    } catch (error) {
      console.error("Failed to fetch user details", error);
      logout();
      return false;
    }
  }, [logout]);

  const checkAuthState = useCallback(async () => {
    setLoading(true);
    
    const timeoutId = setTimeout(() => {
      console.warn("Auth check timed out");
      setLoading(false);
    }, 5000);
    
    let token = userService.getRefreshToken();
    if (!token) {
      token = userService.getAccessToken();
    }
    
    if (!token) {
      clearTimeout(timeoutId);
      logout();
      return false;
    }
    
    try {
      const decoded = jwtDecode<DecodedToken>(token);
      const currentTime = Date.now() / 1000;
      
      if (decoded.exp <= currentTime) {
        try {
          const refreshResult = await userService.refresh();
          if (refreshResult) {
            userService.saveTokens(
              refreshResult.accessToken,
              refreshResult.refreshToken
            );
          } else {
            throw new Error("Failed to refresh token");
          }
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          clearTimeout(timeoutId);
          logout();
          return false;
        }
      }
      
      const success = await fetchUserDetails();
      clearTimeout(timeoutId);
      setLoading(false);
      return success;
    } catch (error) {
      console.error("Error decoding token or refreshing session:", error);
      clearTimeout(timeoutId);
      logout();
      return false;
    }
  }, [logout, fetchUserDetails]);

  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  // Listen for global auth updates (e.g., profile image change) and refresh user data
  useEffect(() => {
    const handleAuthUpdated = () => {
      fetchUserDetails();
    };
    window.addEventListener('auth:updated', handleAuthUpdated);
    return () => window.removeEventListener('auth:updated', handleAuthUpdated);
  }, [fetchUserDetails]);

  return {
    currentUser,
    loading,
    isAuthenticated: !!currentUser,
    updateAuthState: checkAuthState,
    logout,
  };
};
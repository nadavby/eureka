/** @format */

import { FC } from "react";
import { Routes, Route } from "react-router-dom";
import { Login } from "./Login";
import { RegistrationForm } from "./RegristrationForm";
import UserProfile from "./UserProfile";
import { useAuth } from "../hooks/useAuth";
import LostItems from "./LostItems";
import ItemUpload from "./ItemUpload";
import ItemDetail from "./ItemDetail";
import Navigation from "./Navigation";
import { NotificationsProvider } from "../hooks/useNotifications";
import MatchConfirmation from "./MatchConfirmation";
import LostItemsMap from "./LostItemsMap";
import PublicUserProfile from "./PublicUserProfile";
import Chats from "./Chats";
import "./App.css";

const App: FC = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <p>Loading...</p>;
  
  return (
    <NotificationsProvider>
      <div className="app">
        <Navigation />
        <Routes>
          <Route
            path="/public-user/:userId"
            element={<PublicUserProfile />}
          />
          <Route
            path="/"
            element={isAuthenticated ? <LostItems /> : <Login />}
          />
          <Route
            path="/login"
            element={<Login />}
          />
          <Route
            path="/register"
            element={<RegistrationForm />}
          />
          <Route
            path="/lost-items"
            element={<LostItems />}
          />
          <Route
            path="/profile"
            element={<UserProfile />}
          />
          <Route
            path="/report-item"
            element={<ItemUpload />}
          />
          <Route
            path="/item/:itemId"
            element={<ItemDetail />}
          />
          <Route
            path="/match-confirmation/:matchId"
            element={<MatchConfirmation />}
          />
          <Route
            path="/map"
            element={<LostItemsMap />}
          />
          <Route
            path="/chats"
            element={<Chats />}
          />
        </Routes>
      </div>
    </NotificationsProvider>
  );
};

export default App;

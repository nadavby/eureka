import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import App from './components/App.tsx'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')!).render(
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>
  </GoogleOAuthProvider>
)

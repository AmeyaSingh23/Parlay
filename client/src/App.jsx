import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PublicCheckout from './pages/PublicCheckout';
import AgentCatalog from './pages/AgentCatalog';

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: '#ffffff',
                color: '#0f172a',
                border: '1px solid #e2e8f0',
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#ffffff'
                }
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#ffffff'
                }
              }
            }}
          />
          <Routes>
            <Route path="/" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            {/* Public standalone hosted checkout page for buyer payment links */}
            <Route path="/pay/:sessionId" element={<PublicCheckout />} />
            {/* Public browsable Agent Catalog & A2A Gateway Hub */}
            <Route path="/catalog" element={<AgentCatalog />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

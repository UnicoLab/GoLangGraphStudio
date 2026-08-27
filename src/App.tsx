import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { StudioLayout } from './components/layout/StudioLayout';
import { ConnectionSetup } from './components/setup/ConnectionSetup';
import { useStudioStore } from './store/useStudioStore';
import './index.css';

function App() {
  const { isConnected, darkMode } = useStudioStore();

  useEffect(() => {
    // Apply dark mode to document
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <Router>
      <div className={`App ${darkMode ? 'dark' : ''}`}>
        <Routes>
          <Route
            path="/setup"
            element={<ConnectionSetup />}
          />
          <Route
            path="/studio"
            element={<StudioLayout />}
          />
          <Route
            path="/"
            element={<Navigate to={isConnected ? "/studio" : "/setup"} replace />}
          />
        </Routes>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: darkMode ? '#374151' : '#ffffff',
            color: darkMode ? '#f9fafb' : '#111827',
            border: darkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: darkMode ? '#374151' : '#ffffff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: darkMode ? '#374151' : '#ffffff',
            },
          },
        }}
      />
    </Router>
  );
}

export default App;

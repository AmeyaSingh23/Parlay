import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const serverUrl = import.meta.env.VITE_API_URL
      ? (import.meta.env.VITE_API_URL.startsWith('http') ? import.meta.env.VITE_API_URL.replace('/api', '') : '/')
      : (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:5000' : '/');
    const s = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    s.on('connect', () => {
      console.log('[Socket.io Client] Connected with ID:', s.id);
      setConnected(true);
    });

    s.on('disconnect', () => {
      console.log('[Socket.io Client] Disconnected');
      setConnected(false);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  return context?.socket || null;
};

export const useSocketStatus = () => {
  const context = useContext(SocketContext);
  return context?.connected || false;
};

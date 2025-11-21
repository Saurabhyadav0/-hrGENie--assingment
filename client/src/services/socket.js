import { io } from 'socket.io-client';

// Get socket URL - derive from API URL to ensure same port
const getSocketURL = () => {
  // Use explicit URL if provided
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  
  // Get the API URL (same as used in api.js)
  const apiBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
  
  // Extract base URL (remove /api/v1 if present, or just get protocol + host + port)
  try {
    const url = new URL(apiBaseURL);
    // Return just the origin (protocol + host + port)
    return url.origin;
  } catch (e) {
    // Fallback: try to extract manually
    const match = apiBaseURL.match(/^(https?:\/\/[^\/]+)/);
    if (match) {
      return match[1];
    }
    // Final fallback
    return 'http://localhost:5000';
  }
};

const baseURL = getSocketURL();

export const createEditorSocket = (documentId, user) => {
  if (!documentId || !user) {
    console.error('[Socket] Missing documentId or user:', { documentId, user });
    return null;
  }

  const userId = user.id || user._id;
  if (!userId) {
    console.error('[Socket] Missing userId in user object:', user);
    return null;
  }

  console.log('[Socket] Creating socket connection:', { baseURL, documentId, userId, name: user.name });

  const socket = io(baseURL, {
    transports: ['polling', 'websocket'], // Try polling first, then websocket
    withCredentials: true,
    upgrade: true,
    rememberUpgrade: false,
    auth: {
      documentId: String(documentId),
      userId: String(userId), // Ensure it's a string
      name: user.name || 'User',
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    forceNew: false,
    // Ensure cookies are sent
    extraHeaders: {},
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to server, socket ID:', socket.id);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  return socket;
};


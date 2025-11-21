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
    const match = apiBaseURL.match(/^(http?:\/\/[^\/]+)/);
    if (match) {
      return match[1];
    }
    // Final fallback
    return 'http://localhost:5000';
  }
};

// Store active sockets to prevent multiple connections
const activeSockets = new Map();

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

  // Create a unique key for this document-user combination
  const socketKey = `${documentId}-${userId}`;
  
  // Check if a socket already exists for this document-user combination
  const existingSocket = activeSockets.get(socketKey);
  if (existingSocket && existingSocket.connected) {
    console.log('[Socket] Reusing existing socket connection:', socketKey);
    return existingSocket;
  }

  // If there's an existing socket but it's disconnected, clean it up
  if (existingSocket) {
    console.log('[Socket] Cleaning up disconnected socket:', socketKey);
    existingSocket.removeAllListeners();
    existingSocket.disconnect();
    activeSockets.delete(socketKey);
  }

  const baseURL = getSocketURL();
  console.log('[Socket] Creating new socket connection:', { baseURL, documentId, userId, name: user.name });

  const socket = io(baseURL, {
    transports: ['polling', 'websocket'], // Try polling first, then websocket
    withCredentials: true, // This ensures cookies (including accessToken) are sent
    upgrade: true,
    rememberUpgrade: false,
    auth: {
      documentId: String(documentId),
      userId: String(userId), // Ensure it's a string
      name: user.name || 'User',
      // Note: accessToken is sent via cookies automatically with withCredentials: true
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    forceNew: true, // Force new connection to avoid reuse issues
    // Ensure cookies are sent with the handshake
    extraHeaders: {},
  });

  // Store the socket for potential reuse
  activeSockets.set(socketKey, socket);

  // Clean up on disconnect
  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason, 'for key:', socketKey);
    // Only remove from map if it's a permanent disconnect
    if (reason === 'io server disconnect' || reason === 'io client disconnect') {
      activeSockets.delete(socketKey);
    }
  });

  // Remove from map if connection fails permanently
  socket.on('connect_error', (error) => {
    console.error('[Socket] Connection error:', error.message, 'for key:', socketKey);
    // Don't remove immediately - let reconnection attempts happen
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to server, socket ID:', socket.id, 'for key:', socketKey);
  });

  return socket;
};

// Helper function to clean up a specific socket
export const disconnectEditorSocket = (documentId, userId) => {
  if (!documentId || !userId) return;
  const socketKey = `${documentId}-${userId}`;
  const socket = activeSockets.get(socketKey);
  if (socket) {
    console.log('[Socket] Manually disconnecting socket:', socketKey);
    socket.removeAllListeners();
    socket.disconnect();
    activeSockets.delete(socketKey);
  }
};

// Helper function to clean up all sockets (useful for cleanup)
export const disconnectAllSockets = () => {
  console.log('[Socket] Disconnecting all sockets');
  activeSockets.forEach((socket, key) => {
    socket.removeAllListeners();
    socket.disconnect();
  });
  activeSockets.clear();
};


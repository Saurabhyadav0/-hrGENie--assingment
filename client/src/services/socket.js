import { io } from 'socket.io-client';

const baseURL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const createEditorSocket = (documentId, user) => {
  if (!documentId || !user) return null;

  return io(baseURL, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: {
      documentId,
      userId: user.id,
      name: user.name,
    },
  });
};


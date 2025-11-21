const { nanoid } = require('nanoid');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const User = require('../models/User');
const Document = require('../models/Document');
const Permission = require('../models/Permission');

const activeUsers = new Map(); // documentId -> Map(socketId, userMeta)

// Parse cookies from handshake
const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.trim().split('=');
      if (parts.length === 2) {
        cookies[parts[0]] = parts[1];
      }
    });
  }
  return cookies;
};

const initEditorSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      // Get token from cookies or auth object
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const token = cookies.accessToken || socket.handshake.auth?.token;
      
      if (!token) {
        console.log('[Socket] No token provided');
        const err = new Error('Authentication required');
        err.data = { status: 401 };
        return next(err);
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      } catch (jwtError) {
        console.log('[Socket] Invalid or expired token:', jwtError.message);
        const err = new Error('Invalid or expired token');
        err.data = { status: 401 };
        return next(err);
      }

      // Get user from database
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        console.log('[Socket] User not found');
        const err = new Error('User not found');
        err.data = { status: 401 };
        return next(err);
      }

      // Attach user to socket
      socket.user = user;
      socket.userId = String(user._id);

      // Validate documentId from auth
      const documentId = socket.handshake.auth?.documentId;
      if (!documentId) {
        console.log('[Socket] Missing documentId');
        const err = new Error('Document ID required');
        err.data = { status: 400 };
        return next(err);
      }

      // Verify user has permission to access document
      const canAccess = await Permission.findOne({ 
        document: String(documentId), 
        user: socket.userId 
      });
      
      if (!canAccess) {
        console.log(`[Socket] Access denied for userId: ${socket.userId}, documentId: ${documentId}`);
        const err = new Error('Access denied');
        err.data = { status: 403 };
        return next(err);
      }

      // Attach document info to socket
      socket.documentId = String(documentId);
      socket.userRole = canAccess.role;
      
      console.log(`[Socket] Authenticated user ${socket.userId} for document ${socket.documentId}`);
      next();
    } catch (error) {
      console.error('[Socket] Authentication error:', error);
      const err = new Error('Authentication failed');
      err.data = { status: 401 };
      next(err);
    }
  });

  io.on('connection', async (socket) => {
    // Use authenticated user data from middleware
    const normalizedUserId = socket.userId;
    const normalizedDocumentId = socket.documentId;
    const role = socket.userRole;
    const name = socket.user.name || socket.handshake.auth?.name || 'User';
    
    console.log(`[Socket] User ${normalizedUserId} (${name}) connected to document ${normalizedDocumentId} as ${role}`);

    socket.join(normalizedDocumentId);

    const canEdit = ['owner', 'editor'].includes(role);
    const userMeta = { userId: normalizedUserId, name, role, cursor: null, color: `#${nanoid(6)}` };
    if (!activeUsers.has(normalizedDocumentId)) activeUsers.set(normalizedDocumentId, new Map());
    activeUsers.get(normalizedDocumentId).set(socket.id, userMeta);

    // Broadcast presence to all users in the document (including the new user)
    const allUsers = Array.from(activeUsers.get(normalizedDocumentId).values());
    io.to(normalizedDocumentId).emit('presence', allUsers);
    console.log(`[Socket] Presence broadcasted to ${allUsers.length} users`);

    // Notify others that a new user joined
    socket.to(normalizedDocumentId).emit('user-joined', userMeta);

    socket.on('text-change', async ({ delta, content }) => {
      console.log(`[Socket] text-change received from ${normalizedUserId} (canEdit: ${canEdit})`);
      
      if (!canEdit) {
        console.log(`[Socket] Permission denied for text-change from ${normalizedUserId}`);
        socket.emit('permission-denied', { action: 'text-change' });
        return;
      }

      // Broadcast to ALL users in the document (including viewers)
      const recipientCount = io.sockets.adapter.rooms.get(normalizedDocumentId)?.size || 0;
      console.log(`[Socket] Broadcasting text-change to ${recipientCount} users in document ${normalizedDocumentId}`);
      
      socket.to(normalizedDocumentId).emit('text-change', { delta, userId: normalizedUserId });
      
      if (content === null || content === undefined) return;
      
      try {
        await Document.findByIdAndUpdate(normalizedDocumentId, {
          content,
          lastEditedBy: normalizedUserId,
          autosaveAt: new Date(),
        });
        socket.emit('document-saved');
      } catch (error) {
        console.error(`[Socket] Error saving document:`, error);
        socket.emit('document-save-error', { message: 'Failed to persist change' });
      }
    });

    socket.on('cursor-move', (cursor) => {
      const docUsers = activeUsers.get(normalizedDocumentId);
      if (docUsers?.has(socket.id)) {
        docUsers.get(socket.id).cursor = cursor;
        // Broadcast cursor to all users (including viewers)
        socket.to(normalizedDocumentId).emit('cursor-move', { userId: normalizedUserId, cursor });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User ${normalizedUserId} disconnected from document ${normalizedDocumentId}`);
      const docUsers = activeUsers.get(normalizedDocumentId);
      if (docUsers) {
        const metadata = docUsers.get(socket.id);
        docUsers.delete(socket.id);
        if (!docUsers.size) {
          activeUsers.delete(normalizedDocumentId);
        }
        socket.to(normalizedDocumentId).emit('user-left', metadata);
        io.to(normalizedDocumentId).emit('presence', docUsers ? Array.from(docUsers.values()) : []);
      }
    });
  });
};

module.exports = initEditorSocket;


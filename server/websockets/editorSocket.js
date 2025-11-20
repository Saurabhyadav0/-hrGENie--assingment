const { nanoid } = require('nanoid');
const Document = require('../models/Document');
const Permission = require('../models/Permission');

const activeUsers = new Map(); // documentId -> Map(socketId, userMeta)

const initEditorSocket = (io) => {
  io.use((socket, next) => {
    if (!socket.handshake.auth?.userId || !socket.handshake.auth?.documentId) {
      const err = new Error('Unauthorized socket connection');
      err.data = { status: 401 };
      return next(err);
    }
    return next();
  });

  io.on('connection', async (socket) => {
    const { userId, name, documentId } = socket.handshake.auth;
    const canAccess = await Permission.findOne({ document: documentId, user: userId });
    if (!canAccess) {
      socket.disconnect(true);
      return;
    }
    socket.join(documentId);

    const userMeta = { userId, name, cursor: null, color: `#${nanoid(6)}` };
    if (!activeUsers.has(documentId)) activeUsers.set(documentId, new Map());
    activeUsers.get(documentId).set(socket.id, userMeta);

    io.to(documentId).emit('presence', Array.from(activeUsers.get(documentId).values()));
    socket.to(documentId).emit('user-joined', userMeta);

    socket.on('text-change', async ({ delta, content }) => {
      socket.to(documentId).emit('text-change', { delta, userId });
      if (content === null || content === undefined) return;
      try {
        await Document.findByIdAndUpdate(documentId, {
          content,
          lastEditedBy: userId,
          autosaveAt: new Date(),
        });
        socket.emit('document-saved');
      } catch (error) {
        socket.emit('document-save-error', { message: 'Failed to persist change' });
      }
    });

    socket.on('cursor-move', (cursor) => {
      const docUsers = activeUsers.get(documentId);
      if (docUsers?.has(socket.id)) {
        docUsers.get(socket.id).cursor = cursor;
        socket.to(documentId).emit('cursor-move', { userId, cursor });
      }
    });

    socket.on('disconnect', () => {
      const docUsers = activeUsers.get(documentId);
      if (docUsers) {
        const metadata = docUsers.get(socket.id);
        docUsers.delete(socket.id);
        if (!docUsers.size) {
          activeUsers.delete(documentId);
        }
        socket.to(documentId).emit('user-left', metadata);
        io.to(documentId).emit('presence', docUsers ? Array.from(docUsers.values()) : []);
      }
    });
  });
};

module.exports = initEditorSocket;


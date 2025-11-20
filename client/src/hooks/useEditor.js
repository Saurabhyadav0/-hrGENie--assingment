import { useCallback, useEffect, useRef, useState } from 'react';
import { DocumentAPI } from '../services/api';
import { createEditorSocket } from '../services/socket';

export const useEditor = (documentId, user) => {
  const [document, setDocument] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | syncing | saved
  const socketRef = useRef(null);
  const saveTimer = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!documentId) return;
    let mounted = true;
    const fetchDocument = async () => {
      try {
        const { data } = await DocumentAPI.get(documentId);
        if (!mounted) return;
        setDocument(data.document);
        contentRef.current = data.document.content || '';
      } catch (error) {
        console.error(error);
      }
    };
    fetchDocument();
    return () => {
      mounted = false;
    };
  }, [documentId]);

  useEffect(() => {
    if (!documentId || !user) return;
    const socket = createEditorSocket(documentId, user);
    socketRef.current = socket;

    socket.on('presence', (users) => setParticipants(users));
    socket.on('user-joined', (payload) => {
      setParticipants((prev) => [...prev.filter((u) => u.userId !== payload.userId), payload]);
    });
    socket.on('user-left', (payload) => {
      setParticipants((prev) => prev.filter((u) => u.userId !== payload?.userId));
    });
    socket.on('document-saved', () => setStatus('saved'));
    socket.on('document-save-error', () => setStatus('error'));
    socket.on('cursor-move', ({ userId, cursor }) =>
      setParticipants((prev) => prev.map((participant) => (participant.userId === userId ? { ...participant, cursor } : participant)))
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [documentId, user]);

  useEffect(() => {
    if (!documentId || !user) return;
    saveTimer.current = setInterval(async () => {
      if (contentRef.current === null || contentRef.current === undefined) return;
      setStatus('syncing');
      try {
        await DocumentAPI.update(documentId, { content: contentRef.current, autosave: true });
        setStatus('saved');
      } catch (error) {
        setStatus('error');
      }
    }, 30000);

    return () => {
      clearInterval(saveTimer.current);
    };
  }, [documentId, user]);

  const updateContent = useCallback(
    (content) => {
      contentRef.current = content;
      setDocument((prev) => (prev ? { ...prev, content } : prev));
      setStatus('dirty');
    },
    [setDocument]
  );

  const emitChange = useCallback((payload) => {
    if (socketRef.current) {
      socketRef.current.emit('text-change', payload);
    }
  }, []);

  const emitCursor = useCallback((cursor) => {
    socketRef.current?.emit('cursor-move', cursor);
  }, []);

  return {
    document,
    participants,
    status,
    updateContent,
    emitChange,
    emitCursor,
    socketRef,
  };
};


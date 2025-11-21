import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import throttle from 'lodash.throttle';
import { DocumentAPI } from '../services/api';
import { createEditorSocket } from '../services/socket';

export const useEditor = (documentId, user) => {
  const [document, setDocument] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | syncing | saved
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const saveTimer = useRef(null);
  const contentRef = useRef(null);
  const canEditRef = useRef(false);

  useEffect(() => {
    if (!documentId) return;
    let mounted = true;
    const fetchDocument = async () => {
      try {
        const { data } = await DocumentAPI.get(documentId);
        if (!mounted) return;
        setDocument(data.document);
        contentRef.current = data.document.content || '';
        canEditRef.current = data.document.permissionRole !== 'viewer';
        console.log('[useEditor] Document loaded, canEdit:', canEditRef.current, 'permissionRole:', data.document.permissionRole);
      } catch (error) {
        console.error('[useEditor] Error fetching document:', error);
      }
    };
    fetchDocument();
    return () => {
      mounted = false;
    };
  }, [documentId]);

  useEffect(() => {
    const normalizedUserId = user?.id || user?._id;
    if (!documentId || !user || !normalizedUserId) {
      console.log('[Socket] Missing requirements:', { documentId, user: !!user, userId: normalizedUserId });
      return;
    }

    console.log('[Socket] Creating connection for document:', documentId, 'user:', normalizedUserId);
    const socket = createEditorSocket(documentId, user);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected successfully, socket ID:', socket.id);
      setIsConnected(true);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      setIsConnected(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('presence', (users) => {
      console.log('[Socket] Presence update:', users);
      setParticipants(users);
    });

    socket.on('user-joined', (payload) => {
      console.log('[Socket] User joined:', payload);
      setParticipants((prev) => [...prev.filter((u) => u.userId !== payload.userId), payload]);
    });

    socket.on('user-left', (payload) => {
      console.log('[Socket] User left:', payload);
      setParticipants((prev) => prev.filter((u) => u.userId !== payload?.userId));
    });

    socket.on('document-saved', () => setStatus('saved'));
    socket.on('document-save-error', () => setStatus('error'));

    socket.on('cursor-move', ({ userId, cursor }) => {
      console.log('[Socket] Cursor move:', userId, cursor);
      setParticipants((prev) => prev.map((participant) => (participant.userId === userId ? { ...participant, cursor } : participant)));
    });

    socket.on('permission-denied', (data) => {
      console.warn('[Socket] Permission denied:', data);
    });

    // Add text-change listener here too for debugging
    socket.on('text-change', (payload) => {
      console.log('[useEditor] Received text-change event (forwarding to Editor):', payload);
    });

    return () => {
      console.log('[Socket] Cleaning up connection');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [documentId, user]);

  useEffect(() => {
    const canEdit = document?.permissionRole !== 'viewer';
    canEditRef.current = canEdit;
    console.log('[useEditor] Updated canEdit:', canEdit, 'permissionRole:', document?.permissionRole);
  }, [document?.permissionRole]);

  useEffect(() => {
    if (!documentId || !user || document?.permissionRole === 'viewer') return;
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
  }, [documentId, user, document?.permissionRole]);

  const updateContent = useCallback(
    (content) => {
      contentRef.current = content;
      setDocument((prev) => (prev ? { ...prev, content } : prev));
      setStatus('dirty');
    },
    [setDocument]
  );

  const emitChange = useCallback((payload) => {
    const socket = socketRef.current;
    if (!socket) {
      console.warn('[useEditor] Cannot emit text-change: socket not available');
      return;
    }
    if (!socket.connected) {
      console.warn('[useEditor] Cannot emit text-change: socket not connected');
      return;
    }
    if (!canEditRef.current) {
      console.warn('[useEditor] Cannot emit text-change: user cannot edit');
      return;
    }
    console.log('[useEditor] Emitting text-change:', { 
      hasDelta: !!payload.delta, 
      hasContent: !!payload.content,
      socketConnected: socket.connected 
    });
    socket.emit('text-change', payload);
  }, []);

  const throttledCursorEmit = useMemo(
    () =>
      throttle((cursor) => {
        socketRef.current?.emit('cursor-move', cursor);
      }, 100),
    []
  );

  useEffect(
    () => () => {
      throttledCursorEmit.cancel();
    },
    [throttledCursorEmit]
  );

  const emitCursor = useCallback(
    (cursor) => {
      throttledCursorEmit(cursor);
    },
    [throttledCursorEmit]
  );

  return {
    document,
    participants,
    status,
    isConnected,
    updateContent,
    emitChange,
    emitCursor,
    socketRef,
  };
};


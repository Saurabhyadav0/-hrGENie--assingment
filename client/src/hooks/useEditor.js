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
    if (!socket) {
      console.error('[Socket] Failed to create socket');
      return;
    }
    
    socketRef.current = socket;

    // Define all event handlers as named functions for proper cleanup
    function onConnect() {
      console.log('[Socket] Connected successfully, socket ID:', socket.id);
      setIsConnected(true);
    }

    function onConnectError(error) {
      console.error('[Socket] Connection error:', error);
      setIsConnected(false);
    }

    function onDisconnect(reason) {
      console.log('[Socket] Disconnected:', reason);
      setIsConnected(false);
    }

    function onPresence(users) {
      console.log('[Socket] Presence update:', users);
      setParticipants((prev) => {
        // Use functional update to ensure we always get the latest state
        // Check if the update is actually different to avoid unnecessary re-renders
        const userMap = new Map(prev.map(u => [u.userId, u]));
        let hasChanges = false;
        
        users.forEach(user => {
          const existing = userMap.get(user.userId);
          if (!existing || JSON.stringify(existing) !== JSON.stringify(user)) {
            hasChanges = true;
            userMap.set(user.userId, user);
          }
        });
        
        // Remove users that are no longer present
        prev.forEach(user => {
          if (!users.find(u => u.userId === user.userId)) {
            hasChanges = true;
            userMap.delete(user.userId);
          }
        });
        
        return hasChanges ? Array.from(userMap.values()) : prev;
      });
    }

    function onUserJoined(payload) {
      console.log('[Socket] User joined:', payload);
      setParticipants((prev) => {
        const exists = prev.find(u => u.userId === payload.userId);
        if (exists && JSON.stringify(exists) === JSON.stringify(payload)) {
          return prev; // No change needed
        }
        return [...prev.filter((u) => u.userId !== payload.userId), payload];
      });
    }

    function onUserLeft(payload) {
      console.log('[Socket] User left:', payload);
      setParticipants((prev) => prev.filter((u) => u.userId !== payload?.userId));
    }

    function onDocumentSaved() {
      setStatus((prevStatus) => prevStatus !== 'saved' ? 'saved' : prevStatus);
    }

    function onDocumentSaveError() {
      setStatus('error');
    }

    function onCursorMove({ userId, cursor }) {
      console.log('[Socket] Cursor move:', userId, cursor);
      setParticipants((prev) => 
        prev.map((participant) => 
          participant.userId === userId 
            ? { ...participant, cursor } 
            : participant
        )
      );
    }

    function onPermissionDenied(data) {
      console.warn('[Socket] Permission denied:', data);
    }

    function onTextChange(payload) {
      console.log('[useEditor] Received text-change event (forwarding to Editor):', payload);
      // This event is handled in Editor component, but we log it here for debugging
    }

    // Register all event listeners
    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);
    socket.on('presence', onPresence);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('document-saved', onDocumentSaved);
    socket.on('document-save-error', onDocumentSaveError);
    socket.on('cursor-move', onCursorMove);
    socket.on('permission-denied', onPermissionDenied);
    socket.on('text-change', onTextChange);

    // Ensure socket connects if it hasn't already
    if (!socket.connected) {
      socket.connect();
    }

    // Cleanup: Remove all event listeners and disconnect
    return () => {
      console.log('[Socket] Cleaning up connection');
      
      // Remove all event listeners using the named functions
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.off('presence', onPresence);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('document-saved', onDocumentSaved);
      socket.off('document-save-error', onDocumentSaveError);
      socket.off('cursor-move', onCursorMove);
      socket.off('permission-denied', onPermissionDenied);
      socket.off('text-change', onTextChange);
      
      // Disconnect the socket
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


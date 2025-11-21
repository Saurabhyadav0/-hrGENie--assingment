import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';
import { useAuth } from '../hooks/useAuth';
import { useEditor } from '../hooks/useEditor';
import AIAssistant from './AIAssistant';
import ShareDialog from './ShareDialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { ThemeToggle } from './theme-toggle';
import { ArrowLeft, Share2, Users, Wifi, WifiOff, Menu } from 'lucide-react';
import logo from '../assets/logo.jpeg';

let cursorsRegistered = false;
let Delta;
if (typeof window !== 'undefined' && !cursorsRegistered) {
  Quill.register('modules/cursors', QuillCursors);
  Delta = Quill.import('delta');
  cursorsRegistered = true;
}

const Editor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const quillRef = useRef(null);
  const cursorModuleRef = useRef(null);
  const renderedCursorIdsRef = useRef(new Set());
  const isApplyingRemoteChangeRef = useRef(false);
  const lastContentRef = useRef('');
  const editorInitializedRef = useRef(false);
  const lastChangeTimeRef = useRef(0);
  const [selectionText, setSelectionText] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [editorValue, setEditorValue] = useState('');
  const initialContentRef = useRef('');
  const { document, participants, status, isConnected, updateContent, emitChange, emitCursor, socketRef } = useEditor(id, user);
  const userId = user?.id || user?._id;
  const isViewer = document?.permissionRole === 'viewer';
  const canEdit = !isViewer;

  // Custom toolbar modules with link handler
  const modules = useMemo(() => {
    const base = {
      cursors: {
        hideDelay: 5000,
        hideSpeed: 0,
        selectionChangeSource: null,
        transformOnTextChange: true,
      },
    };

    if (isViewer) {
      return base;
    }

    return {
      ...base,
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'blockquote', 'code-block'],
          ['clean'],
        ],
        handlers: {
          link(value) {
            if (value) {
              const href = prompt('Enter the URL');
              if (href) {
                this.quill.format('link', href);
              } else {
                this.quill.format('link', false);
              }
            } else {
              this.quill.format('link', false);
            }
          },
        },
      },
    };
  }, [isViewer]);

  // Initialize editor when document loads (remount on document change)
  useEffect(() => {
    if (document?._id && document?.content !== undefined) {
      console.log('[Editor] Document loaded, remounting editor with key:', document._id, 'content length:', (document.content || '').length);
      const newContent = document.content || '';
      initialContentRef.current = newContent;
      setEditorValue(newContent);
      setEditorKey(prev => prev + 1);
      editorInitializedRef.current = false;
    }
  }, [document?._id]);

  // Set up Quill's text-change listener for real-time collaboration (only for editors)
  useEffect(() => {
    if (!canEdit) {
      console.log('[Editor] Text-change handler not set up: user cannot edit');
      return;
    }

    // Wait for editor to be ready after remount
    const setupHandler = () => {
      if (!quillRef.current) {
        console.log('[Editor] Quill ref not available yet, retrying...');
        return false;
      }
      
      const editor = quillRef.current.getEditor();
      if (!editor) {
        console.log('[Editor] Editor instance not available yet, retrying...');
        return false;
      }

      const textChangeHandler = (delta, oldDelta, source) => {
        // Only handle user-initiated changes
        if (source !== 'user' || isApplyingRemoteChangeRef.current) {
          if (source !== 'user') {
            console.log('[Editor] Skipping text-change (not user source):', source);
          }
          return;
        }

        // Mark that we handled this change
        lastChangeTimeRef.current = Date.now();

        const content = editor.root.innerHTML;
        const socket = socketRef.current;
        console.log('[Editor] Quill text-change (local):', { 
          deltaOps: delta.ops?.length || 0,
          source,
          contentLength: content.length,
          socketConnected: socket?.connected,
          hasSocket: !!socket,
          canEdit
        });

        // Update editor value state to keep ReactQuill in sync
        setEditorValue(content);
        
        // Update content and emit change
        updateContent(content);
        emitChange({ delta: { ops: delta.ops }, content });
      };

      console.log('[Editor] Registering text-change handler, socket connected:', socketRef.current?.connected);
      editor.on('text-change', textChangeHandler);

      return () => {
        console.log('[Editor] Unregistering text-change handler');
        if (editor && editor.off) {
          editor.off('text-change', textChangeHandler);
        }
      };
    };

    // Try to set up immediately
    let cleanup = setupHandler();
    
    // If not ready, try again after a short delay
    if (!cleanup) {
      const timeoutId = setTimeout(() => {
        cleanup = setupHandler();
      }, 200);
      
      return () => {
        clearTimeout(timeoutId);
        if (cleanup) cleanup();
      };
    }

    return cleanup;
  }, [canEdit, updateContent, emitChange, socketRef, isConnected, editorKey]);

  // Listen to incoming text changes from socket (works for all users including viewers)
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) {
      console.log('[Editor] Socket not available yet (isConnected =', isConnected, ')');
      return;
    }

    // Define handler as named function for proper cleanup
    // We now trust the full HTML `content` sent by the server so that
    // remote users see exactly the same document, instead of trying
    // to reconcile Quill deltas on different local states.
    function handleTextChange({ delta, content, userId: remoteUserId }) {
      // Don't apply our own changes (they're already in the editor)
      if (String(remoteUserId) === String(userId)) {
        console.log('[Editor] Ignoring own change from:', remoteUserId);
        return;
      }

      console.log('[Editor] Applying remote change from:', remoteUserId, 'delta:', delta, 'content length:', content?.length);

      // If we didn't receive content for some reason, do nothing
      if (typeof content !== 'string') {
        console.warn('[Editor] No content provided in text-change payload, skipping apply');
        return;
      }

      // Mark that we're applying a remote change
      isApplyingRemoteChangeRef.current = true;

      try {
        // Update ReactQuill's controlled value and our document state
        setEditorValue(prevValue => (content !== prevValue ? content : prevValue));
        updateContent(content);
        
        console.log('[Editor] Successfully applied remote change from:', remoteUserId);
      } catch (error) {
        console.error('[Editor] Error applying remote change:', error, 'delta:', delta, 'content length:', content?.length);
      } finally {
        // Reset flag after a brief delay to allow Quill to process
        setTimeout(() => {
          isApplyingRemoteChangeRef.current = false;
        }, 150);
      }
    }

    console.log(
      '[Editor] Setting up text-change handler for user:',
      userId,
      'isViewer:',
      isViewer,
      'socket connected:',
      socket.connected
    );
    socket.on('text-change', handleTextChange);
    
    return () => {
      console.log('[Editor] Removing text-change handler');
      // Remove the specific handler function
      socket.off('text-change', handleTextChange);
    };
  }, [isConnected, userId, isViewer, updateContent]);

  // Handle ReactQuill onChange (fallback if text-change doesn't fire)
  const handleChange = useCallback(
    (content, delta, source) => {
      // Update the editor value state to keep it in sync
      setEditorValue(content);
      
      // Don't process if it's a remote change or not from user
      if (isApplyingRemoteChangeRef.current || source !== 'user') {
        return;
      }
      
      // If text-change event fired recently (within 100ms), skip this
      const now = Date.now();
      if (now - lastChangeTimeRef.current < 100) {
        return;
      }
      
      console.log('[Editor] ReactQuill onChange called (fallback):', { source, contentLength: content?.length });
      
      // Fallback: use onChange if text-change didn't fire
      if (quillRef.current) {
        const editor = quillRef.current.getEditor();
        if (editor) {
          updateContent(content);
          const deltaOps = delta?.ops || (delta && Array.isArray(delta) ? delta : []);
          emitChange({ delta: { ops: deltaOps }, content });
        }
      }
    },
    [updateContent, emitChange]
  );

  // Handle selection to get selected text and send cursor info
  const handleSelection = useCallback(
    (range, source, editor) => {
      if (source !== 'user') return;
      if (!range) {
        setSelectionText('');
        emitCursor({ range: null });
        return;
      }
      const text = editor.getText(range.index, range.length);
      setSelectionText(text);
      emitCursor({ range });
    },
    [emitCursor]
  );

  useEffect(() => {
    if (!quillRef.current) return;
    const editor = quillRef.current.getEditor();
    if (!editor) return;
    cursorModuleRef.current = editor.getModule('cursors');
  }, []);

  useEffect(() => {
    const cursorModule = cursorModuleRef.current || quillRef.current?.getEditor()?.getModule('cursors');
    if (!cursorModule) return;
    const remoteParticipants = participants.filter((participant) => participant.userId !== userId);
    const nextIds = new Set(remoteParticipants.map((p) => p.userId));

    renderedCursorIdsRef.current.forEach((cursorId) => {
      if (!nextIds.has(cursorId)) {
        cursorModule.removeCursor(cursorId);
        renderedCursorIdsRef.current.delete(cursorId);
      }
    });

    remoteParticipants.forEach((participant) => {
      if (!participant.cursor?.range) {
        if (renderedCursorIdsRef.current.has(participant.userId)) {
          cursorModule.removeCursor(participant.userId);
          renderedCursorIdsRef.current.delete(participant.userId);
        }
        return;
      }

      if (!renderedCursorIdsRef.current.has(participant.userId)) {
        cursorModule.createCursor(participant.userId, participant.name || 'Collaborator', participant.color || '#0ea5e9');
        renderedCursorIdsRef.current.add(participant.userId);
      }

      cursorModule.moveCursor(participant.userId, {
        index: participant.cursor.range.index ?? 0,
        length: participant.cursor.range.length ?? 0,
      });
    });
  }, [participants, userId]);

  useEffect(
    () => () => {
      const cursorModule = cursorModuleRef.current;
      if (!cursorModule) return;
      renderedCursorIdsRef.current.forEach((cursorId) => cursorModule.removeCursor(cursorId));
      renderedCursorIdsRef.current.clear();
    },
    []
  );

  const statusLabel = {
    idle: 'Idle',
    dirty: 'Unsaved changes',
    syncing: 'Saving…',
    saved: 'All changes saved',
    error: 'Autosave failed',
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Google Docs-like Header */}
      <header className="sticky top-0 z-50 flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logo} alt="Logo" className="h-6 w-6" />
            <div className="flex items-center gap-2">
              <h1 className="text-base font-medium">{document?.title || 'Untitled Document'}</h1>
              {document?.permissionRole && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {document.permissionRole}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border px-2 py-1">
              {isConnected ? (
                <Wifi className="h-3.5 w-3.5 text-green-500" title="Connected" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-red-500" title="Disconnected" />
              )}
              <span className="text-xs text-muted-foreground">{statusLabel[status] || status}</span>
            </div>
            {document?.permissionRole === 'owner' && (
              <Button
                onClick={() => setShareOpen(true)}
                size="sm"
                className="h-9"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            )}
            <div className="flex -space-x-2">
              {participants.map((participant) => (
                <div
                  key={participant.userId}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-center text-xs font-medium text-white shadow-sm"
                  title={participant.name}
                  style={{ backgroundColor: participant.color || '#0ea5e9' }}
                >
                  {participant.name?.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Editor Area - Google Docs Style */}
      <main className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="mx-auto max-w-4xl px-16 py-8">
              <div className={isViewer ? 'cursor-not-allowed opacity-90' : ''}>
                <ReactQuill
                  key={`${document?._id}-${editorKey}`}
                  ref={quillRef}
                  theme="snow"
                  modules={modules}
                  value={editorValue}
                  onChange={handleChange}
                  onChangeSelection={handleSelection}
                  readOnly={isViewer}
                  className="editor-quill"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="w-80 flex-shrink-0 border-l overflow-y-auto">
          <AIAssistant
            draftText={selectionText || document?.content}
            isReadOnly={isViewer}
            onInsert={(text) => {
              const editor = quillRef.current?.getEditor();
              if (!editor || !text) return;
              const range = editor.getSelection(true);
              const index = range?.index ?? editor.getLength();
              editor.insertText(index, `\n${text}\n`);
            }}
          />
        </div>
      </main>
      <ShareDialog
        documentId={document?._id}
        title={document?.title}
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
};

export default Editor;

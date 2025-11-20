import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useAuth } from '../hooks/useAuth';
import { useEditor } from '../hooks/useEditor';
import AIAssistant from './AIAssistant';
import ShareDialog from './ShareDialog';

const Editor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const quillRef = useRef(null);
  const [selectionText, setSelectionText] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const { document, participants, status, updateContent, emitChange, emitCursor, socketRef } = useEditor(id, user);

  // Custom toolbar modules with link handler
  const modules = useMemo(() => ({
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
        link: function (value) {
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
        // Add more custom handlers if needed here
      },
    },
  }), []);

  // Sync editor content with document content
  useEffect(() => {
    if (!document || !quillRef.current) return;
    const editor = quillRef.current.getEditor();
    if (editor && editor.root.innerHTML !== (document.content || '')) {
      editor.setContents([]);
      editor.clipboard.dangerouslyPasteHTML(document.content || '');
    }
  }, [document]);

  // Listen to incoming text changes from socket
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !quillRef.current) return;
    const handler = ({ delta }) => {
      const editor = quillRef.current.getEditor();
      editor.updateContents(delta);
    };
    socket.on('text-change', handler);
    return () => {
      socket.off('text-change', handler);
    };
  }, [socketRef]);

  // Handle local user changes
  const handleChange = useCallback(
    (content, delta, source) => {
      if (source !== 'user') return;
      updateContent(content);
      emitChange({ delta: delta?.ops ? { ops: delta.ops } : delta, content });
    },
    [updateContent, emitChange]
  );

  // Handle selection to get selected text and send cursor info
  const handleSelection = (range, source, editor) => {
    if (!range) return;
    const text = editor.getText(range.index, range.length);
    setSelectionText(text);
    emitCursor({ range });
  };

  const statusLabel = {
    idle: 'Idle',
    dirty: 'Unsaved changes',
    syncing: 'Saving…',
    saved: 'All changes saved',
    error: 'Autosave failed',
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="flex flex-wrap items-center justify-between border-b border-slate-800 px-6 py-4">
        <button onClick={() => navigate('/')} className="text-sm text-slate-400 hover:text-white">
          ← Back
        </button>
        <div>
          <p className="text-xs uppercase text-slate-500">Document</p>
          <h1 className="text-xl font-semibold">{document?.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">{statusLabel[status] || status}</span>
          {document?.permissionRole && (
            <span className="rounded-full border border-slate-800 px-3 py-1 text-xs uppercase text-slate-300">
              {document.permissionRole}
            </span>
          )}
          {document?.permissionRole === 'owner' && (
            <button
              onClick={() => setShareOpen(true)}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Share
            </button>
          )}
          <div className="flex -space-x-2">
            {participants.map((participant) => (
              <div
                key={participant.userId}
                className="h-8 w-8 rounded-full border border-slate-900 text-center text-xs leading-8"
                title={participant.name}
                style={{ backgroundColor: participant.color || '#0ea5e9' }}
              >
                {participant.name?.charAt(0)}
              </div>
            ))}
          </div>
        </div>
      </header>
      <main className="grid gap-4 px-4 py-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-2">
          <ReactQuill
            ref={quillRef}
            theme="snow"
            modules={modules}
            value={document?.content || ''}
            onChange={handleChange}
            onChangeSelection={handleSelection}
            className="min-h-[70vh] text-white"
          />
        </section>
        <AIAssistant
          draftText={selectionText || document?.content}
          onInsert={(text) => {
            const editor = quillRef.current?.getEditor();
            if (!editor || !text) return;
            const range = editor.getSelection(true);
            const index = range?.index ?? editor.getLength();
            editor.insertText(index, `\n${text}\n`);
          }}
        />
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

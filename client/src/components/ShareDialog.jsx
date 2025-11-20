import { useCallback, useEffect, useMemo, useState } from 'react';
import { DocumentAPI } from '../services/api';

const initialForm = { email: '', role: 'viewer' };

const ShareDialog = ({ documentId, title, isOpen, onClose }) => {
  const [collaborators, setCollaborators] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const documentLink = useMemo(() => {
    if (!documentId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return origin ? `${origin}/documents/${documentId}` : `/documents/${documentId}`;
  }, [documentId]);

  const resetState = () => {
    setForm(initialForm);
    setCollaborators([]);
    setFeedback(null);
    setLoading(false);
    setSubmitting(false);
  };

  const loadCollaborators = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    try {
      const { data } = await DocumentAPI.permissions(documentId);
      setCollaborators(data.permissions || []);
    } catch (error) {
      setFeedback({ type: 'error', message: error.response?.data?.message || 'Unable to load access list' });
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (isOpen) {
      loadCollaborators();
      if (typeof window !== 'undefined') {
        const handleKey = (event) => {
          if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => {
          window.removeEventListener('keydown', handleKey);
        };
      }
      return () => {};
    }
    resetState();
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, loadCollaborators]);

  if (!isOpen || !documentId) return null;

  const handleInvite = async (event) => {
    event.preventDefault();
    if (!form.email.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await DocumentAPI.shareByEmail(documentId, { email: form.email.trim(), role: form.role });
      setFeedback({ type: 'success', message: 'Invitation sent' });
      setForm(initialForm);
      await loadCollaborators();
    } catch (error) {
      setFeedback({ type: 'error', message: error.response?.data?.message || 'Unable to send invite' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (userId) => {
    if (!window.confirm('Remove this collaborator?')) return;
    try {
      await DocumentAPI.revokePermission(documentId, userId);
      await loadCollaborators();
    } catch (error) {
      setFeedback({ type: 'error', message: error.response?.data?.message || 'Unable to remove collaborator' });
    }
  };

  const handleCopyLink = async () => {
    try {
      if (!documentLink) throw new Error('No link');
      if (!navigator?.clipboard) {
        throw new Error('Clipboard API not available');
      }
      await navigator.clipboard.writeText(documentLink);
      setFeedback({ type: 'success', message: 'Link copied to clipboard' });
    } catch {
      setFeedback({ type: 'error', message: 'Unable to copy link' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Share document</p>
            <h3 className="text-xl font-semibold text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <p className="text-xs uppercase text-slate-500">Link</p>
            <div className="mt-2 flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 md:flex-row md:items-center">
              <span className="flex-1 truncate text-sm text-slate-200">{documentLink}</span>
              <button
                onClick={handleCopyLink}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-800"
              >
                Copy link
              </button>
            </div>
          </div>

          <form onSubmit={handleInvite} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm font-medium text-white">Invite people</p>
            <div className="mt-3 flex flex-col gap-3 md:flex-row">
              <input
                type="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-white"
                required
              />
              <select
                value={form.role}
                onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {submitting ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm font-medium text-white">People with access</p>
            {loading ? (
              <p className="mt-3 text-sm text-slate-400">Loading collaborators…</p>
            ) : collaborators.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">Only you have access right now.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {collaborators.map((collab) => (
                  <li key={collab.user?._id || collab.id} className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{collab.user?.name || 'Unknown user'}</p>
                      <p className="text-sm text-slate-400">{collab.user?.email || 'Deleted account'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase text-slate-300">
                        {collab.role}
                      </span>
                      {collab.role !== 'owner' && collab.user?._id && (
                        <button
                          onClick={() => handleRevoke(collab.user._id)}
                          className="text-xs text-red-400 hover:text-red-200"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {feedback && (
            <p
              className={`text-sm ${
                feedback.type === 'error' ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {feedback.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareDialog;


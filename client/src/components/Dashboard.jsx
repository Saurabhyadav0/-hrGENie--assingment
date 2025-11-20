import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/helpers';
import ShareDialog from './ShareDialog';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [activeShareDoc, setActiveShareDoc] = useState(null);

  const fetchDocuments = async () => {
    try {
      const { data } = await DocumentAPI.list();
      setDocuments(data.documents);
    } catch (err) {
      setError('Unable to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const { data } = await DocumentAPI.create({ title });
      setDocuments((prev) => [data.document, ...prev]);
      setTitle('');
    } catch (err) {
      setError('Failed to create document');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document?')) return;
    await DocumentAPI.remove(id);
    setDocuments((prev) => prev.filter((doc) => doc._id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="flex items-center justify-between border-b border-slate-800 px-8 py-4">
        <div>
          <p className="text-sm text-slate-400">Welcome back</p>
          <h1 className="text-2xl font-semibold">{user?.name}</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-slate-800 px-3 py-1 text-sm">{user?.role}</span>
          <button onClick={logout} className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">
            Logout
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:flex-row">
          <input
            className="flex-1 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-2"
            placeholder="New document title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <button className="rounded-xl bg-primary px-6 py-2 font-medium text-white">Create</button>
        </form>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        <section className="mt-8 space-y-4">
          {loading ? (
            <p className="text-sm text-slate-400">Loading documents…</p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-slate-400">No documents yet.</p>
          ) : (
            documents.map((doc) => {
              const isOwner = doc.permissionRole === 'owner';
              return (
                <div
                  key={doc._id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">{doc.title}</h3>
                      <p className="text-sm text-slate-400">Updated {formatDate(doc.updatedAt)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full border border-slate-800 px-3 py-1 text-xs uppercase text-slate-300">
                        {doc.permissionRole || 'viewer'}
                      </span>
                      <button
                        onClick={() => navigate(`/documents/${doc._id}`)}
                        className="rounded-lg bg-primary/90 px-4 py-2 text-sm font-medium hover:bg-primary"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => isOwner && setActiveShareDoc(doc)}
                        disabled={!isOwner}
                        className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-500"
                      >
                        Share
                      </button>
                      <button
                        onClick={() => handleDelete(doc._id)}
                        className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>
      <ShareDialog
        documentId={activeShareDoc?._id}
        title={activeShareDoc?.title}
        isOpen={Boolean(activeShareDoc)}
        onClose={() => setActiveShareDoc(null)}
      />
    </div>
  );
};

export default Dashboard;


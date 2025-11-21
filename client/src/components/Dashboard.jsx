import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentAPI } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/helpers';
import ShareDialog from './ShareDialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ThemeToggle } from './theme-toggle';
import { Trash2, Share2, FileText, Plus, MoreVertical, Clock } from 'lucide-react';
import logo from '../assets/logo.jpeg';

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
    <div className="min-h-screen bg-background">
      {/* Google Docs-like Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="h-8 w-8" />
            <span className="text-lg font-medium">Docs</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout} className="h-8">
              {user?.name}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Create New Document Section */}
        <div className="mb-8">
          <form onSubmit={handleCreate} className="flex items-center gap-3">
            <Button
              type="submit"
              size="lg"
              className="h-12 w-12 rounded-full p-0"
              disabled={!title.trim()}
            >
              <Plus className="h-5 w-5" />
            </Button>
            <Input
              className="h-12 flex-1 text-base"
              placeholder="Start a new document"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>

        {/* Documents Grid - Google Docs Style */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Loading documents…</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <FileText className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-medium">No documents yet</h3>
            <p className="text-sm text-muted-foreground">Create your first document to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {documents.map((doc) => {
              const isOwner = doc.permissionRole === 'owner';
              return (
                <Card
                  key={doc._id}
                  className="group cursor-pointer transition-all hover:shadow-lg"
                  onClick={() => navigate(`/documents/${doc._id}`)}
                >
                  <CardContent className="p-4">
                    <div className="mb-3 flex h-32 items-center justify-center rounded bg-muted/50">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h3 className="mb-1 truncate font-medium">{doc.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(doc.updatedAt)}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t pt-3">
                      <Badge variant="outline" className="text-xs">
                        {doc.permissionRole || 'viewer'}
                      </Badge>
                      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            isOwner && setActiveShareDoc(doc);
                          }}
                          disabled={!isOwner}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(doc._id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
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


import { useCallback, useEffect, useMemo, useState } from 'react';
import { DocumentAPI } from '../services/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Copy, X, UserMinus } from 'lucide-react';

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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Link</Label>
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                value={documentLink}
                readOnly
                className="flex-1"
              />
              <Button onClick={handleCopyLink} variant="outline" size="sm">
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Invite people</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleInvite} className="space-y-3">
                <div className="flex flex-col gap-3 md:flex-row">
                  <Input
                    type="email"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="flex-1"
                    required
                  />
                  <Select
                    value={form.role}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger className="w-full md:w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Sending…' : 'Send'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>People with access</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading collaborators…</p>
              ) : collaborators.length === 0 ? (
                <p className="text-sm text-muted-foreground">Only you have access right now.</p>
              ) : (
                <ul className="space-y-3">
                  {collaborators.map((collab) => (
                    <li key={collab.user?._id || collab.id} className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{collab.user?.name || 'Unknown user'}</p>
                        <p className="text-sm text-muted-foreground">{collab.user?.email || 'Deleted account'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="uppercase">
                          {collab.role}
                        </Badge>
                        {collab.role !== 'owner' && collab.user?._id && (
                          <Button
                            onClick={() => handleRevoke(collab.user._id)}
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <UserMinus className="mr-2 h-4 w-4" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {feedback && (
            <p
              className={`text-sm ${
                feedback.type === 'error' ? 'text-destructive' : 'text-emerald-500'
              }`}
            >
              {feedback.message}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;


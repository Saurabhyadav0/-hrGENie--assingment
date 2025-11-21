import { useState } from 'react';
import { AIAPI } from '../services/api';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';

const actions = {
  grammar: { label: 'Grammar', handler: AIAPI.grammar },
  enhance: { label: 'Enhance', handler: AIAPI.enhance },
  summarize: { label: 'Summarize', handler: AIAPI.summarize },
  complete: { label: 'Complete', handler: AIAPI.complete },
  suggestions: { label: 'Suggest', handler: AIAPI.suggestions },
};

const htmlToPlain = (value = '') => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const AIAssistant = ({ draftText, onInsert, isReadOnly = false }) => {
  const [active, setActive] = useState('grammar');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  const runAction = async (type) => {
    if (isReadOnly) return;
    const payload = htmlToPlain(draftText) || draftText;
    if (!payload?.trim()) return;
    setActive(type);
    setLoading(true);
    setError('');
    try {
      const { data } = await actions[type].handler(payload);
      setResponse(data.result);
    } catch (err) {
      setError('AI request failed. Please try later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Assistant
          </CardTitle>
          <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
            Gemini
          </Badge>
        </div>
        <CardDescription>
          {isReadOnly ? 'Viewing only — editing actions are disabled.' : 'Highlight or type text to receive contextual suggestions.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(actions).map(([key, action]) => (
            <Button
              key={key}
              onClick={() => runAction(key)}
              disabled={loading || isReadOnly}
              variant={active === key ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
            >
              {action.label}
            </Button>
          ))}
        </div>
        <div className="flex-1 whitespace-pre-wrap rounded-lg border bg-muted/50 p-3 text-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking…
            </div>
          ) : (
            <div>
              {response || 'Select an action to begin.'}
              {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            </div>
          )}
        </div>
        <Button
          onClick={() => onInsert?.(response)}
          disabled={!response || isReadOnly || loading}
          className="w-full"
          size="sm"
        >
          {isReadOnly ? 'Unavailable in view-only mode' : 'Insert into doc'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AIAssistant;


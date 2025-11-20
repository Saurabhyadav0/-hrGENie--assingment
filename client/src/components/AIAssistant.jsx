import { useState } from 'react';
import { AIAPI } from '../services/api';

const actions = {
  grammar: { label: 'Grammar', handler: AIAPI.grammar },
  enhance: { label: 'Enhance', handler: AIAPI.enhance },
  summarize: { label: 'Summarize', handler: AIAPI.summarize },
  complete: { label: 'Complete', handler: AIAPI.complete },
  suggestions: { label: 'Suggest', handler: AIAPI.suggestions },
};

const htmlToPlain = (value = '') => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const AIAssistant = ({ draftText, onInsert }) => {
  const [active, setActive] = useState('grammar');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');

  const runAction = async (type) => {
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
    <aside className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">AI Assistant</h2>
        <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs text-emerald-300">Gemini</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">Highlight or type text to receive contextual suggestions.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {Object.entries(actions).map(([key, action]) => (
          <button
            key={key}
            onClick={() => runAction(key)}
            disabled={loading}
            className={`rounded-lg border px-2 py-1 text-xs ${
              active === key ? 'border-primary bg-primary/20 text-primary' : 'border-slate-800 text-slate-300'
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="mt-4 flex-1 whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
        {loading ? <p className="text-slate-400">Thinking…</p> : response || 'Select an action to begin.'}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
      <button
        onClick={() => onInsert?.(response)}
        disabled={!response}
        className="mt-3 rounded-xl bg-primary/90 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        Insert into doc
      </button>
    </aside>
  );
};

export default AIAssistant;


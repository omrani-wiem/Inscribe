import { useState } from 'react';
import { API_URL } from '../api';

export default function SubmitPage() {
  const [text, setText] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const submit = async () => {
    if (!text.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch(`${API_URL}/api/public/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, rating, name: name.trim() || null }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  const box: React.CSSProperties = {
    maxWidth: 480, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif',
    display: 'flex', flexDirection: 'column', gap: 16,
  };
  const field: React.CSSProperties = {
    width: '100%', padding: 12, fontSize: 16, borderRadius: 8,
    border: '1px solid #bbb', boxSizing: 'border-box',
  };

  if (status === 'done') {
    return (
      <div style={{ ...box, textAlign: 'center', paddingTop: 80 }}>
        <h1>Merci ! 🙏</h1>
        <p>Votre avis a bien été envoyé.</p>
      </div>
    );
  }

  return (
    <div style={box}>
      <h1>Votre avis nous intéresse</h1>

      <div>
        <p style={{ margin: '0 0 8px' }}>Votre note</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onClick={() => setRating(n)}
              aria-label={`${n} sur 5`}
              style={{
                fontSize: 32, background: 'none', border: 'none', cursor: 'pointer',
                color: rating !== null && n <= rating ? '#f5a623' : '#ccc',
              }}
            >★</button>
          ))}
        </div>
      </div>

      <textarea
        style={{ ...field, minHeight: 140 }}
        placeholder="Dites-nous ce que vous avez pensé…"
        maxLength={2000}
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <input
        style={field}
        placeholder="Votre prénom (facultatif)"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <button
        onClick={submit}
        disabled={!text.trim() || status === 'sending'}
        style={{ ...field, background: '#1a73e8', color: '#fff', border: 'none', cursor: 'pointer' }}
      >
        {status === 'sending' ? 'Envoi…' : 'Envoyer'}
      </button>
      {status === 'error' && <p style={{ color: 'crimson' }}>L'envoi a échoué, réessayez.</p>}
    </div>
  );
}
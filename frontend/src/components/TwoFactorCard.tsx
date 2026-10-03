import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../api';

export default function TwoFactorCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.me().then(m => setEnabled(m.totpEnabled)).catch(() => setEnabled(false));
  }, []);

  const reset = () => { setCode(''); setPassword(''); setError(''); };

  const start = async () => {
    reset(); setMsg('');
    try {
      const s = await api.twoFaSetup();
      const qr = await QRCode.toDataURL(s.otpauthUri, { width: 200, margin: 1 });
      setSetup({ secret: s.secret, qr });
    } catch (e: any) { setError(e.message); }
  };

  const confirm = async () => {
    try {
      await api.twoFaEnable(code);
      setEnabled(true); setSetup(null); reset();
      setMsg('Double authentification activée.');
    } catch (e: any) { setError(e.message); }
  };

  const disable = async () => {
    try {
      await api.twoFaDisable(password, code);
      setEnabled(false); reset();
      setMsg('Double authentification désactivée.');
    } catch (e: any) { setError(e.message); }
  };

  const input: React.CSSProperties = {
    padding: 10, fontSize: 16, borderRadius: 8, boxSizing: 'border-box',
    border: '1px solid var(--md-sys-color-outline)', background: 'var(--md-sys-color-surface-container-low)',
    color: 'var(--md-sys-color-on-surface)',
  };
  const btn: React.CSSProperties = {
    padding: '10px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
    background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)',
  };

  if (enabled === null) return null;

  return (
    <div style={{ border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: 16,
                  background: 'var(--md-sys-color-surface)', padding: 24, display: 'flex',
                  flexDirection: 'column', gap: 12, color: 'var(--md-sys-color-on-surface)' }}>
      <h2 style={{ margin: 0 }}>Double authentification (2FA)</h2>
      <p style={{ margin: 0 }}>
        {enabled
          ? 'Activée : un code de votre application est demandé à chaque connexion.'
          : 'Ajoutez une protection : en plus du mot de passe, un code à 6 chiffres généré par une application (Google Authenticator, Microsoft Authenticator, Authy…).'}
      </p>

      {!enabled && !setup && <button style={{ ...btn, alignSelf: 'flex-start' }} onClick={start}>Activer la 2FA</button>}

      {setup && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
          <p style={{ margin: 0 }}>1. Scannez ce QR code avec votre application.</p>
          <img src={setup.qr} alt="QR code 2FA" width={200} height={200} />
          <p style={{ margin: 0, fontSize: 13 }}>Ou saisissez la clé manuellement : <code>{setup.secret}</code></p>
          <p style={{ margin: 0 }}>2. Entrez le code affiché pour confirmer.</p>
          <input style={input} inputMode="numeric" maxLength={6} placeholder="000000" value={code}
                 onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={btn} onClick={confirm}>Confirmer</button>
            <button style={{ ...btn, background: 'transparent', color: 'inherit', border: '1px solid var(--md-sys-color-outline)' }}
                    onClick={() => { setSetup(null); reset(); }}>Annuler</button>
          </div>
        </div>
      )}

      {enabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
          <p style={{ margin: 0 }}>Pour désactiver, entrez votre mot de passe et un code actuel.</p>
          <input style={input} type="password" placeholder="Mot de passe" value={password}
                 onChange={e => setPassword(e.target.value)} />
          <input style={input} inputMode="numeric" maxLength={6} placeholder="000000" value={code}
                 onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
          <button style={btn} onClick={disable}>Désactiver la 2FA</button>
        </div>
      )}

      {msg && <p style={{ margin: 0, color: 'var(--sentiment-positive)' }}>{msg}</p>}
      {error && <p style={{ margin: 0, color: 'var(--sentiment-negative)' }}>{error}</p>}
    </div>
  );
}
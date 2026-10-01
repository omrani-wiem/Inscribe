import { useState, useEffect } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import { api, getToken, setToken, clearToken } from '../api';
import type { AuthResult } from '../api';

type View = 'login' | 'register' | 'verify' | 'mfa' | 'forgot' | 'reset';

const TITLES: Record<View, string> = {
  login: 'Connexion',
  register: 'Créer un compte',
  verify: 'Vérifiez votre e-mail',
  mfa: 'Double authentification',
  forgot: 'Mot de passe oublié',
  reset: 'Nouveau mot de passe',
};

export default function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'login' | 'ok'>(getToken() ? 'checking' : 'login');
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [shopName, setShopName] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState('');

  // Session déjà ouverte : on vérifie le jeton
  useEffect(() => {
    if (!getToken()) return;
    api.me()
      .then(m => { setMe(m.email); setState('ok'); })
      .catch(() => { clearToken(); setState('login'); });
  }, []);

  // Session expirée pendant l'utilisation
  useEffect(() => {
    const onLogout = () => setState('login');
    window.addEventListener('inkscribe:logout', onLogout);
    return () => window.removeEventListener('inkscribe:logout', onLogout);
  }, []);

  const go = (v: View) => { setView(v); setError(''); setInfo(''); setCode(''); };

  const finish = (r: AuthResult) => {
    if (r.status === 'OK') {
      setToken(r.token); setMe(r.email); setState('ok');
    } else if (r.status === 'VERIFY_EMAIL') {
      setEmail(r.email); go('verify');
      setInfo(`Un code à 6 chiffres a été envoyé à ${r.email}.`);
    } else {
      setMfaToken(r.mfaToken); go('mfa');
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setError(''); setBusy(true);
    try { await fn(); }
    catch (e: any) { setError(e instanceof TypeError ? 'Serveur injoignable.' : e.message); }
    finally { setBusy(false); }
  };

  const checkNewPassword = () => {
    if (pass.length < 8) throw new Error('Mot de passe : 8 caractères minimum.');
    if (pass !== pass2) throw new Error('Les mots de passe ne correspondent pas.');
  };

  const primary = () => run(async () => {
    switch (view) {
      case 'login': return finish(await api.login(email, pass));
      case 'register':
        checkNewPassword();
        return finish(await api.register(email, pass, shopName));
      case 'verify': return finish(await api.verifyEmail(email, code));
      case 'mfa': return finish(await api.login2fa(mfaToken, code));
      case 'forgot':
        await api.forgot(email);
        go('reset');
        return setInfo('Si un compte existe pour cet e-mail, un code vient d\'être envoyé.');
      case 'reset':
        checkNewPassword();
        await api.resetPassword(email, code, pass);
        go('login'); setPass(''); setPass2('');
        return setInfo('Mot de passe modifié. Vous pouvez vous connecter.');
    }
  });

  const resend = () => run(async () => {
    await api.resendCode(email);
    setInfo('Si le délai d\'une minute est passé, un nouveau code a été envoyé.');
  });

  const logout = () => { clearToken(); window.location.reload(); };

  if (state === 'ok') {
    return (
      <>
        {children}
        <button onClick={logout} title={me}
          style={{ position: 'fixed', top: 8, right: 8, zIndex: 1000, padding: '6px 12px',
                   borderRadius: 8, border: '1px solid #bbb', background: '#fff', cursor: 'pointer' }}>
          Déconnexion
        </button>
      </>
    );
  }
  if (state === 'checking') return <p style={{ padding: 24 }}>Connexion…</p>;

  const field: CSSProperties = {
    width: '100%', padding: 12, fontSize: 16, borderRadius: 8,
    border: '1px solid #bbb', boxSizing: 'border-box',
  };
  const link: CSSProperties = { background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', padding: 4 };
  const enter = (e: React.KeyboardEvent) => e.key === 'Enter' && !busy && primary();
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);

  const showEmail = ['login', 'register', 'forgot', 'reset'].includes(view);
  const showPass = ['login', 'register', 'reset'].includes(view);
  const showPass2 = ['register', 'reset'].includes(view);
  const showCode = ['verify', 'mfa', 'reset'].includes(view);
  const label: Record<View, string> = {
    login: 'Se connecter', register: "S'inscrire", verify: 'Valider',
    mfa: 'Valider', forgot: 'Envoyer le code', reset: 'Changer le mot de passe',
  };

  return (
    <div style={{ maxWidth: 380, margin: '60px auto', padding: 24, fontFamily: 'system-ui, sans-serif',
                  display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0 }}>InkScribe AI</h1>
      <h3 style={{ margin: 0 }}>{TITLES[view]}</h3>

      {view === 'mfa' && <p style={{ margin: 0 }}>Entrez le code à 6 chiffres affiché par votre application d'authentification.</p>}
      {info && <p style={{ margin: 0, color: '#1b7f3b' }}>{info}</p>}

      {view === 'register' && (
        <input style={field} placeholder="Nom de votre établissement" value={shopName}
               onChange={e => setShopName(e.target.value)} />
      )}
      {showEmail && (
        <input style={field} type="email" placeholder="E-mail" value={email}
               onChange={e => setEmail(e.target.value)} onKeyDown={enter} />
      )}
      {showCode && (
        <input style={{ ...field, letterSpacing: 6, textAlign: 'center' }} inputMode="numeric"
               autoComplete="one-time-code" placeholder="000000" value={code}
               onChange={e => setCode(digits(e.target.value))} onKeyDown={enter} />
      )}
      {showPass && (
        <input style={field} type="password" onKeyDown={enter}
               placeholder={view === 'login' ? 'Mot de passe' : 'Nouveau mot de passe (8 caractères min.)'}
               value={pass} onChange={e => setPass(e.target.value)} />
      )}
      {showPass2 && (
        <input style={field} type="password" placeholder="Confirmez le mot de passe" value={pass2}
               onChange={e => setPass2(e.target.value)} onKeyDown={enter} />
      )}

      <button style={{ ...field, background: '#1a73e8', color: '#fff', border: 'none',
                       cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}
              disabled={busy} onClick={primary}>
        {busy ? 'Patientez…' : label[view]}
      </button>
      {error && <p style={{ color: 'crimson', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {view === 'login' && (<>
          <button style={link} onClick={() => go('forgot')}>Mot de passe oublié ?</button>
          <button style={link} onClick={() => go('register')}>Pas de compte ? Créer un compte</button>
        </>)}
        {view === 'register' && <button style={link} onClick={() => go('login')}>Déjà un compte ? Se connecter</button>}
        {view === 'verify' && <button style={link} onClick={resend} disabled={busy}>Renvoyer le code</button>}
        {['verify', 'mfa', 'forgot', 'reset'].includes(view) && (
          <button style={link} onClick={() => go('login')}>Retour à la connexion</button>
        )}
      </div>
    </div>
  );
}
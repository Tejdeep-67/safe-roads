import { useState } from 'react';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import Sheet from './Sheet';

interface Props {
  reason?: string;
  onDone: () => void;
  onClose: () => void;
}

export default function AuthPanel({ reason, onDone, onClose }: Props) {
  const { signIn, signUp, status } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email, password);
      else await signUp(name, email, password);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (m: 'in' | 'up') => {
    setMode(m);
    setError(null);
  };

  return (
    <Sheet label="Sign in" title={mode === 'in' ? 'Sign in' : 'Create your account'} subtitle={reason} onClose={onClose}>
      <div className="mb-4 grid grid-cols-2 rounded-full bg-sunken p-1 text-sm font-medium" role="tablist">
        {(['in', 'up'] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchTo(m)}
            className={`rounded-full py-2 transition ${mode === m ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
          >
            {m === 'in' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>
      {status === 'offline' && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          The server isn't reachable right now, so signing in won't work until it is.
        </p>
      )}
      <form onSubmit={submit} className="space-y-3" noValidate={false}>
        {mode === 'up' && (
          <div>
            <label className="field-label" htmlFor="auth-name">
              Name
            </label>
            <input id="auth-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={40} />
          </div>
        )}
        <div>
          <label className="field-label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            className="input"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            maxLength={254}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="auth-password">
            Password
          </label>
          <div className="relative">
            <input
              id="auth-password"
              className="input pr-12"
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              required
              minLength={mode === 'up' ? 8 : undefined}
              maxLength={128}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-1 my-auto h-10 rounded-full px-3 text-muted hover:text-ink"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {mode === 'up' && <p className="mt-1 text-xs text-faint">At least 8 characters.</p>}
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full py-3 text-[15px]" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {mode === 'in' ? 'New here? ' : 'Already have an account? '}
        <button className="font-medium text-brand-600 hover:underline dark:text-brand-200" onClick={() => switchTo(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-faint">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Only your name and email are stored. Your password is hashed (scrypt) on the server and never saved as text. Others only see your first name on your reports.
      </p>
    </Sheet>
  );
}

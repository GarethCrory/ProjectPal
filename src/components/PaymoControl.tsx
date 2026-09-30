import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export function PaymoControl({ onSynced }: { onSynced: (result: { clients: number; projects: number; tasks: number }) => void }) {
  const [session, setSession] = useState<Session | null>(null); const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const client = supabase;
  useEffect(() => { if (!client) return; void client.auth.getSession().then(({ data }) => setSession(data.session)); const { data: listener } = client.auth.onAuthStateChange((_event, next) => setSession(next)); return () => listener.subscription.unsubscribe(); }, [client]);
  if (!client) return <span className="text-xs text-amber-200">Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to `.env.local`, then restart Vite.</span>;
  if (!session) return <form className="flex gap-2" onSubmit={async e => { e.preventDefault(); setBusy(true); const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } }); setMessage(error?.message ?? 'Check your email for the sign-in link.'); setBusy(false); }}><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-40 rounded-lg border border-white/15 bg-white/5 px-2 text-sm" /><button disabled={busy} className="glass-card px-3 py-2 text-sm">{busy ? 'Sending…' : 'Sign in to sync'}</button>{message && <span className="max-w-48 text-xs text-amber-100">{message}</span>}</form>;
  return <div className="flex items-center gap-2"><button onClick={async () => { setBusy(true); setMessage(''); const { data, error } = await client.functions.invoke('paymo-sync', { method: 'POST' }); setBusy(false); if (error) { const context = error.context; const detail = context instanceof Response ? await context.text() : ''; setMessage(detail || error.message); } else { onSynced(data); setMessage(`Synced ${data.tasks} tasks`); } }} disabled={busy} className="glass-card px-3 py-2 text-sm disabled:opacity-50">{busy ? 'Syncing…' : '↻ Sync Paymo'}</button><button onClick={() => void client.auth.signOut()} className="text-xs text-slate-400">Sign out</button>{message && <span className="text-xs text-amber-100">{message}</span>}</div>;
}

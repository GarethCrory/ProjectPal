import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const key = (name: 'SUPABASE_PUBLISHABLE_KEYS' | 'SUPABASE_SECRET_KEYS') => JSON.parse(Deno.env.get(name) ?? '{}').default;
const paymoHeaders = () => ({ Authorization: `Basic ${btoa(`${Deno.env.get('PAYMO_API_KEY')}:X`)}`, Accept: 'application/json' });
const list = <T>(value: unknown, property: string): T[] => (value as Record<string, T[]>)[property] ?? [];
const priority = (value?: number): 1 | 2 | 3 => value == null ? 2 : value >= 75 ? 1 : value >= 50 ? 2 : 3;

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'POST only' }, 405);
  const apiKey = Deno.env.get('PAYMO_API_KEY');
  if (!apiKey) return json({ error: 'PAYMO_API_KEY is not configured' }, 500);
  const url = Deno.env.get('SUPABASE_URL')!;
  const authorization = request.headers.get('Authorization') ?? '';
  const auth = createClient(url, key('SUPABASE_PUBLISHABLE_KEYS') ?? Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return json({ error: 'Sign in before syncing Paymo.' }, 401);
  const db = createClient(url, key('SUPABASE_SECRET_KEYS') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const base = 'https://app.paymoapp.com/api';
    const [clientResponse, projectResponse, taskResponse] = await Promise.all(['/clients?where=active=true', '/projects?where=active=true', '/tasks?where=complete=false'].map(path => fetch(`${base}${path}`, { headers: paymoHeaders() })));
    if (!clientResponse.ok || !projectResponse.ok || !taskResponse.ok) throw new Error(`Paymo request failed (${clientResponse.status}/${projectResponse.status}/${taskResponse.status})`);
    const clients = list<{ id: number; name: string }>(await clientResponse.json(), 'clients');
    const projects = list<{ id: number; name: string; client_id?: number; active?: boolean }>(await projectResponse.json(), 'projects');
    const tasks = list<{ id: number; name: string; project_id: number; complete?: boolean; priority?: number; due_date?: string; description?: string }>(await taskResponse.json(), 'tasks');
    const clientIds = new Map<number, string>(); const projectIds = new Map<number, string>();
    for (const item of clients) { const { data, error } = await db.from('clients').upsert({ user_id: user.id, paymo_id: String(item.id), name: item.name }, { onConflict: 'paymo_id' }).select('id').single(); if (error) throw error; clientIds.set(item.id, data.id); }
    for (const item of projects) { const clientId = item.client_id ? clientIds.get(item.client_id) : undefined; if (!clientId) continue; const { data, error } = await db.from('projects').upsert({ user_id: user.id, paymo_id: String(item.id), client_id: clientId, name: item.name, status: item.active === false ? 'Archived' : 'Active' }, { onConflict: 'paymo_id' }).select('id').single(); if (error) throw error; projectIds.set(item.id, data.id); }
    let syncedTasks = 0;
    for (const item of tasks) { const projectId = projectIds.get(item.project_id); if (!projectId) continue; const { data: existing, error: readError } = await db.from('tasks').select('in_focus,focus_note,priority,estimated_minutes,logged_minutes,time_block').eq('paymo_id', String(item.id)).maybeSingle(); if (readError) throw readError; const local = existing ?? { in_focus: false, focus_note: null, priority: priority(item.priority), estimated_minutes: null, logged_minutes: 0, time_block: null }; const { error } = await db.from('tasks').upsert({ ...local, user_id: user.id, project_id: projectId, paymo_id: String(item.id), name: item.name, status: item.complete ? 'Done' : 'To Do', due_date: item.due_date ?? null, notes: item.description ?? null }, { onConflict: 'paymo_id' }); if (error) throw error; syncedTasks++; }
    return json({ clients: clientIds.size, projects: projectIds.size, tasks: syncedTasks });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Paymo sync failed' }, 500); }
});

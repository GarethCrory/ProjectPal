import type { Task } from '../types/database';
type PaymoClient = { id: string | number; name: string };
type PaymoProject = { id: string | number; name: string; client_id?: string | number | null; active?: boolean };
type PaymoTask = { id: string | number; name: string; project_id: string | number; complete?: boolean; completed?: boolean; due_date?: string | null; description?: string | null; priority?: number };
type SupabaseAdmin = { from(table: string): any };
const baseUrl = 'https://app.paymoapp.com/api';
const records = <T>(payload: unknown, key: string): T[] => Array.isArray(payload) ? payload as T[] : ((payload as Record<string, T[]>)[key] ?? []);
const paymo = async (path: string, init: RequestInit = {}) => { const key = process.env.PAYMO_API_KEY; if (!key) throw new Error('PAYMO_API_KEY is required'); const auth = Buffer.from(`${key}:x`).toString('base64'); const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { Authorization: `Basic ${auth}`, Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers } }); if (!response.ok) throw new Error(`Paymo ${path} failed (${response.status})`); return response.status === 204 ? null : response.json(); };
const mapPaymoPriority = (priority?: number): 1 | 2 | 3 => priority == null ? 2 : priority >= 75 ? 1 : priority >= 50 ? 2 : 3;

export async function fetchPaymoSnapshot() { const [clients, projects, tasks, entries] = await Promise.all(['/clients', '/projects', '/tasks', '/entries'].map(path => paymo(path))); return { clients: records<PaymoClient>(clients, 'clients'), projects: records<PaymoProject>(projects, 'projects'), tasks: records<PaymoTask>(tasks, 'tasks'), entries: records(entries, 'entries') }; }

/** Pull clients → projects → tasks. Local planning/time values are never sourced from Paymo. Use a server-only service-role Supabase client. */
export async function syncPaymo(supabase: SupabaseAdmin, userId: string) {
  const snapshot = await fetchPaymoSnapshot(); const clientMap: Record<string, string> = {}; const projectMap: Record<string, string> = {};
  for (const client of snapshot.clients) { const { data, error } = await supabase.from('clients').upsert({ user_id: userId, paymo_id: String(client.id), name: client.name }, { onConflict: 'paymo_id' }).select('id').single(); if (error) throw error; clientMap[String(client.id)] = data.id; }
  for (const project of snapshot.projects) { const clientId = project.client_id == null ? undefined : clientMap[String(project.client_id)]; if (!clientId) continue; const { data, error } = await supabase.from('projects').upsert({ user_id: userId, paymo_id: String(project.id), client_id: clientId, name: project.name, status: project.active === false ? 'Archived' : 'Active' }, { onConflict: 'paymo_id' }).select('id').single(); if (error) throw error; projectMap[String(project.id)] = data.id; }
  let tasks = 0;
  for (const remote of snapshot.tasks) { const projectId = projectMap[String(remote.project_id)]; if (!projectId) continue; const { data: existing, error: readError } = await supabase.from('tasks').select('in_focus,focus_note,priority,estimated_minutes,logged_minutes,time_block').eq('paymo_id', String(remote.id)).maybeSingle(); if (readError) throw readError; const preserved = existing ?? { in_focus: false, focus_note: null, priority: mapPaymoPriority(remote.priority), estimated_minutes: null, logged_minutes: 0, time_block: null }; const { error } = await supabase.from('tasks').upsert({ ...preserved, user_id: userId, project_id: projectId, paymo_id: String(remote.id), name: remote.name, due_date: remote.due_date ?? null, notes: remote.description ?? null, status: (remote.complete ?? remote.completed) ? 'Done' : 'To Do' }, { onConflict: 'paymo_id' }); if (error) throw error; tasks++; }
  return { clients: Object.keys(clientMap).length, projects: Object.keys(projectMap).length, tasks };
}
export async function pushLoggedTimeToPaymo(task: Pick<Task, 'paymo_id'>, minutes: number, date = new Date().toISOString().slice(0, 10), description = 'Logged from Focus Board') { if (!task.paymo_id) return null; return paymo('/entries', { method: 'POST', body: JSON.stringify({ task_id: Number(task.paymo_id), duration: minutes * 60, date, description }) }); }

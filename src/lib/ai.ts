import type { Task, TimeBlock } from '../types/database';

const roundToQuarter = (value: number) => Math.max(15, Math.min(480, Math.round(value / 15) * 15));
/** Call only from a server route/function: this keeps the provider key out of the browser. */
export async function estimateTaskMinutes(taskName: string, projectContext: string, apiKey = process.env.OPENAI_API_KEY): Promise<number> {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required');
  const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini', temperature: 0.2, messages: [{ role: 'system', content: 'Estimate software/project tasks. Respond with only an integer number of minutes, from 15 through 480 in increments of 15.' }, { role: 'user', content: `Task: ${taskName}\nProject context: ${projectContext}` }] }) });
  if (!response.ok) throw new Error(`OpenAI estimation failed (${response.status})`);
  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  return roundToQuarter(Number(data.choices?.[0]?.message?.content?.match(/\d+/)?.[0]) || 60);
}

export type ScheduleItem = { taskId: string; time_block: Exclude<TimeBlock, 'Late'>; estimated_minutes: number };
export function makeAssertiveSchedule(tasks: Pick<Task, 'id' | 'priority' | 'estimated_minutes'>[]): { items: ScheduleItem[]; overbooked: boolean } {
  let morning = 0, afternoon = 0; const items: ScheduleItem[] = [];
  for (const task of tasks.filter(task => task.priority === 1)) {
    const minutes = task.estimated_minutes ?? 60;
    const block: Exclude<TimeBlock, 'Late'> = morning + minutes <= 240 ? 'Morning' : 'Afternoon';
    if (block === 'Morning') morning += minutes; else afternoon += minutes;
    items.push({ taskId: task.id, time_block: block, estimated_minutes: minutes });
  }
  return { items, overbooked: morning > 240 || afternoon > 240 };
}

/** Server-only AI scheduling. Use its result in the modal; never expose the key to a client bundle. */
export async function generateDailyStandup(tasks: Pick<Task, 'id' | 'name' | 'priority' | 'estimated_minutes'>[], apiKey = process.env.OPENAI_API_KEY): Promise<{ items: ScheduleItem[]; overbooked: boolean }> {
  if (!apiKey) throw new Error('OPENAI_API_KEY is required');
  const priorityOne = tasks.filter(t => t.priority === 1);
  const response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'You are an assertive project manager. Schedule all priority-1 tasks into Morning or Afternoon, no more than 240 estimated minutes per block where possible. Reply JSON: {"items":[{"taskId":"","time_block":"Morning|Afternoon","estimated_minutes":15}],"overbooked":boolean}.' }, { role: 'user', content: JSON.stringify(priorityOne) }] }) });
  if (!response.ok) throw new Error(`OpenAI scheduling failed (${response.status})`);
  const content = (await response.json() as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content;
  const parsed = JSON.parse(content || '{}');
  const allowed = new Set(priorityOne.map(t => t.id));
  const items = Array.isArray(parsed.items) ? parsed.items.filter((x: ScheduleItem) => allowed.has(x.taskId) && ['Morning', 'Afternoon'].includes(x.time_block)).map((x: ScheduleItem) => ({ ...x, estimated_minutes: roundToQuarter(Number(x.estimated_minutes)) })) : [];
  return { items, overbooked: Boolean(parsed.overbooked) };
}

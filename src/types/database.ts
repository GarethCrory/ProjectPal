export type ProjectStatus = 'Active' | 'Paused' | 'Completed' | 'Archived';
export type TaskStatus = 'To Do' | 'In Progress' | 'Blocked' | 'Done' | 'Archived';
export type TimeBlock = 'Morning' | 'Afternoon' | 'Late';
export type Priority = 1 | 2 | 3;

export interface Client { id: string; user_id: string; name: string; paymo_id: string | null; created_at: string; updated_at: string }
export interface Project { id: string; user_id: string; client_id: string; name: string; status: ProjectStatus; paymo_id: string | null; created_at: string; updated_at: string }
export interface Task {
  id: string; user_id: string; project_id: string; name: string; status: TaskStatus; assignee: string | null;
  due_date: string | null; notes: string | null; priority: Priority; in_focus: boolean; focus_note: string | null;
  estimated_minutes: number | null; logged_minutes: number; time_block: TimeBlock | null; paymo_id: string | null;
  created_at: string; updated_at: string;
}
export interface FocusTask extends Task { project: Pick<Project, 'id' | 'name' | 'status'> & { client: Pick<Client, 'id' | 'name'> } }

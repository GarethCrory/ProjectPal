import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
/** Null in local-only mode; secrets never enter the browser bundle. */
export const supabase = url && key ? createClient(url, key) : null;

# Taskboard

Apply `supabase/migrations/20260929000000_taskboard.sql` through the Supabase CLI before connecting the UI.

The React components expect an `updateTask(id, patch)` function supplied by the app's authenticated Supabase client. `estimateTaskMinutes`, `generateDailyStandup`, and Paymo functions are server-only; call them from a server route/function with `OPENAI_API_KEY` and/or `PAYMO_API_KEY` present in that route's environment.

Install the UI's peer dependency before building:

```sh
npm install @dnd-kit/core react react-dom
```

## Paymo setup

1. Apply both migrations to your Supabase project.
2. Put the Paymo key in `supabase/functions/.env` for local function development (copy `supabase/functions/.env.example`; this file is ignored by Git).
3. For production, run `supabase secrets set PAYMO_API_KEY=...` and deploy with `supabase functions deploy paymo-sync`.

The function is [paymo-sync](/Users/garethcrory/ProjectPal/ProjectPal/supabase/functions/paymo-sync/index.ts). It requires a signed-in Supabase user and protects the Paymo key from the browser.

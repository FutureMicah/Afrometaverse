# AfroMetaverse — your own Supabase project

## 1. Create the project
1. Go to https://supabase.com/dashboard → New project
2. Pick org, name (e.g. afrometaverse), region close to players, set a DB password
3. Wait until the project is healthy

## 2. Run SQL (all tables + RLS + realtime)
1. Dashboard → SQL Editor → New query
2. Paste the entire contents of `supabase/setup/FULL_SETUP.sql`
3. Run once
4. Confirm tables: citizens, town_posts, presence, city_events, vote_proposals, citizen_votes

## 3. Auth
1. Authentication → Providers → Email → enable
2. (Optional) Google: enable and add Client ID / Secret; add redirect URLs for your app host
3. URL config: add your Lovable / Netlify / localhost origins under Redirect URLs

## 4. Realtime
1. Database → Publications (or Replication)
2. Ensure `town_posts` and `presence` are on `supabase_realtime`
   (FULL_SETUP.sql already tries to add them)

## 5. Env vars in the app (Lovable or local)
From Project Settings → API, copy into the app env (see ENV.example):

- VITE_SUPABASE_URL = Project URL
- VITE_SUPABASE_PUBLISHABLE_KEY = anon public key
- SUPABASE_URL = same Project URL
- SUPABASE_PUBLISHABLE_KEY = same anon key
- SUPABASE_SERVICE_ROLE_KEY = service_role (server only)
- VITE_SUPABASE_PROJECT_ID / SUPABASE_PROJECT_ID = project ref

Restart the dev server / redeploy after changing env.

## 6. Smoke test
1. Open the game → Sign in (email magic link or password)
2. A `citizens` row should appear automatically (trigger on auth.users)
3. Town Square should load posts; presence updates while you roam

## 7. Optional: Avatar 3D edge function
Only if you use photo→avatar AI:
- Deploy `supabase/functions/avatar-3d`
- Set function secrets: SUPABASE_URL, SUPABASE_ANON_KEY, and LOVABLE_API_KEY if required

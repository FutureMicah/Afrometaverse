# Roadmap — AfroMetaverse

## Batch 1 — Playable city-day prototype (complete)
- [x] Review the Port Harcourt game brief
- [x] Generate city artwork (src/assets/port-harcourt-city.jpg)
- [x] Build AfroMetaverseGame component (city map, work, market, civic vote, social feed, learn)
- [x] Wire the `/` route with proper head metadata
- [x] Write the warm Port Harcourt game theme in src/styles.css
- [x] Verify in the preview (build clean + Playwright walkthrough)

## Batch 2 — Persistent city (in progress)
- [x] Schema: `citizens` table + RLS + signup trigger (drizzle/migrations/0001_citizens.sql)
- [x] Typed Supabase client + drizzle schema for citizens
- [x] useCitizenAuth hook (session, email/password, Google, load/save progress)
- [x] AuthModal UI (email + Google) with am-* styles
- [x] Game wires save on work / market / vote / learn / likes
- [ ] Run SQL migration in Lovable Cloud / Supabase
- [ ] Enable Google provider in Supabase Auth settings
- [ ] End-to-end test: sign up → play → reload → progress restored

## Batch 3 — A living city (not started)
- [ ] Real-time social feed / multiplayer presence
- [ ] Scheduled city events and vote outcomes

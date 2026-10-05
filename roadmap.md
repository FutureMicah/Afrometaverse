# Roadmap — AfroMetaverse

## Design note (Batch 4+)
Open-city *feel* inspired by GTA-style free roam (third-person move, go-to-district missions, transport types).
This is a **civic Port Harcourt sandbox**, not a crime/violence clone. No weapons or wanted-level violence.

## Batch 1 — Playable city-day prototype (complete)
- [x] Review the Port Harcourt game brief
- [x] Generate city artwork (src/assets/port-harcourt-city.jpg)
- [x] Build AfroMetaverseGame component (city map, work, market, civic vote, social feed, learn)
- [x] Wire the `/` route with proper head metadata
- [x] Write the warm Port Harcourt game theme in src/styles.css
- [x] Verify in the preview (build clean + Playwright walkthrough)

## Batch 2 — Persistent city (in progress)
- [x] Schema + auth + saves (code)
- [ ] Run SQL migration in Lovable Cloud / Supabase
- [ ] Enable Google provider
- [ ] E2E save test

## Batch 3 — A living city (in progress)
- [x] Live feed, presence, events, vote outcomes (code)
- [ ] Run 0002_living_city.sql + Realtime tables

## Batch 4 — Free roam + missions (in progress)
- [x] roamStore: walk mode, transport speeds, mission steps
- [x] 3D player avatar + WASD + follow camera
- [x] District proximity glow + transport chips (foot / okada / taxi / ferry)
- [x] Jobs as missions: travel to district → complete shift on site
- [x] Quick-complete still available for fast play
- [ ] Polish collision / map bounds / minimap
- [ ] Optional: NPC pedestrians on paths

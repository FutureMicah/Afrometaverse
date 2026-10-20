# Roadmap — AfroMetaverse

## Done
- [x] Free roam, nested missions, heat, gear, minimap
- [x] Dense PH market + de-boxed city fabric
- [x] Animals, traffic, click hotspots
- [x] Vehicle enter/exit: foot, bike, scooter, keke, okada, taxi, ferry
- [x] Safehouses cool heat
- [x] NPC pedestrians
- [x] Wanted patrols (spot player at 2+ stars)
- [x] Extra street detail (wheelbarrow, drums, nets, bumps)
- [x] Client persist heat/gear (localStorage)
- [x] Batch 3 living-city schema + Realtime (town_posts, presence, city_events, votes)

## Open
- [ ] Run 0002_living_city.sql in Lovable Cloud / Supabase (see instructions below)
- [ ] Cloud citizen fields for heat/gear
- [ ] Building interiors
- [ ] GLTF photoreal assets
- [ ] Mobile touch controls

## How to activate Living City (Batch 3)

1. Open your Lovable Cloud / Supabase project → **SQL Editor**
2. Paste and run the entire contents of:
   `drizzle/migrations/0002_living_city.sql`
3. Confirm tables exist:
   - town_posts
   - presence
   - city_events
   - vote_proposals
   - citizen_votes
4. (Optional) In Supabase Dashboard → **Database → Replication**, verify
   `town_posts` and `presence` are listed under the `supabase_realtime` publication.
5. Reload the game — signed-in citizens will see the live feed and online presence.

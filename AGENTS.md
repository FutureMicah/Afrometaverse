<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# AfroMetaverse

- The playable simulation lives in the `/` route (src/routes/index.tsx)
  rendering src/components/afrometaverse/AfroMetaverseGame.tsx.
  Batch 2 adds optional auth + per-citizen saves via Lovable Cloud (citizens table).
  Guests still play fully offline; signed-in citizens sync wallet, day, jobs, votes, courses.
  Keep multiplayer / real-time feed for Batch 3.
- All game styling uses custom `am-*` classes defined in src/styles.css. Never
  hardcode hex colors or Tailwind color utilities inside the game component.
- The game must keep its honesty disclaimers visible: City Coins have no
  real-world value, and the civic vote is not connected to real elections.

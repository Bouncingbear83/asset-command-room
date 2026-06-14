## Why it's not visible

Two problems:

1. **Not rendered.** `src/components/CommandTab.tsx` no longer imports or renders `<LayerReviewCalendar />` (likely lost in a later edit). `CapitalQueue` is still on line 188, but the calendar block that was supposed to sit beneath it isn't there.
2. **Not readable by the client.** `layer_review_schedule` has only one RLS policy — `FOR ALL TO authenticated` — and the app uses the anon key behind `PasswordGate` (no Supabase auth session). So even once the component is mounted, `select` returns zero rows.

## Changes

1. **Migration** — add anon read policy (keep the existing authenticated-write policy as-is):
   ```sql
   CREATE POLICY "Public can read layer reviews"
     ON public.layer_review_schedule
     FOR SELECT TO anon, authenticated
     USING (true);
   GRANT SELECT ON public.layer_review_schedule TO anon;
   ```
   Writes (`markComplete`, action-item toggles) currently go through the anon client too, so also add:
   ```sql
   CREATE POLICY "Public can update layer reviews"
     ON public.layer_review_schedule
     FOR UPDATE TO anon, authenticated
     USING (true) WITH CHECK (true);
   GRANT UPDATE ON public.layer_review_schedule TO anon;
   ```
   (Matches the access pattern of the other dashboard tables in this project.)

2. **`src/components/CommandTab.tsx`** — re-add:
   ```tsx
   import LayerReviewCalendar from "@/components/LayerReviewCalendar";
   ```
   and render `<LayerReviewCalendar />` directly after the `<CapitalQueue ... />` block (~line 188).

No changes to `LayerReviewCalendar.tsx` or `useLayerReviews.ts` — they already exist and are correct.

## Verification

- Reload Command tab → calendar card renders below Capital Queue with the 7 Q3-2026 rows.
- Confirm no console "permission denied" or empty-array on the `layer_review_schedule` query.
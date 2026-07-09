## Goal
Retire the shared SHA-256 `PasswordGate` and put the app behind real Lovable Cloud auth, restricted to your single account. Email/password + Google sign-in, no profiles table.

## Steps

1. **Backend config**
   - Enable Google as a social provider (Lovable-managed credentials).
   - Disable public signup and disable anonymous users so no one else can create an account.
   - Leave email/password enabled; enable HIBP leaked-password protection.

2. **Auth UI**
   - New `src/pages/Auth.tsx` with two flows: email/password sign-in and "Continue with Google" (`lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`).
   - Style to match the current gate (dark void, gold accent, Cormorant/DM Mono) so the look is preserved.
   - Show inline errors; no signup form (signup is disabled backend-side). Include a small "Forgot password?" link → `resetPasswordForEmail` with `redirectTo: ${origin}/reset-password`.
   - New `src/pages/ResetPassword.tsx` that detects `type=recovery` and calls `supabase.auth.updateUser({ password })`.

3. **Session gate**
   - New `src/components/AuthGate.tsx` replaces `PasswordGate` in `App.tsx`.
   - Registers `onAuthStateChange` synchronously, then hydrates via `getSession()`.
   - If no session → render `<Auth />`. If session → render children.
   - Add a small "Sign out" control in the header (`supabase.auth.signOut()`).

4. **Route wiring** (`App.tsx`)
   - Remove `<PasswordGate>` wrapper.
   - Add `/auth` and `/reset-password` as public routes outside `AuthGate`.
   - Wrap `/` and `/preview/intelligence-row` in `AuthGate`.

5. **Bootstrap your account** (one-time)
   - Since signup will be disabled, before flipping the switch: create your user via the backend Users panel (email + password you choose), or temporarily allow signup, create the account, then disable. I'll walk you through whichever you prefer at implementation time.

6. **Cleanup**
   - Delete `src/components/PasswordGate.tsx`.
   - Remove the `stellar-auth` sessionStorage key usage.

## Out of scope
- No `profiles` table, no roles table (single-user app).
- No custom auth email templates (default Lovable emails are fine unless you ask later).
- No changes to existing Supabase RLS on data tables (they currently allow anon reads — flag: if you want to tighten those to `authenticated` only, that's a follow-up).

## Files touched
- Add: `src/pages/Auth.tsx`, `src/pages/ResetPassword.tsx`, `src/components/AuthGate.tsx`
- Edit: `src/App.tsx`, `src/pages/Index.tsx` (add sign-out button in header)
- Delete: `src/components/PasswordGate.tsx`
- Backend: auth config (disable signup, enable Google, enable HIBP)

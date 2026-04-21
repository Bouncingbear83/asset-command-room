

## Goal
Add a simple password gate in front of the entire app. No email, no signup, no Supabase Auth — just one shared password you set, checked on load.

## Approach

A lightweight client-side gate component that wraps the app. On first load it shows a password screen; on correct entry it sets a flag in `sessionStorage` and renders the app. Closing the tab clears the flag — next session re-prompts.

### How the password is stored

The password is stored as a **SHA-256 hash** in an environment variable (`VITE_APP_PASSWORD_HASH`), not in source. The gate hashes the typed input via the browser's built-in `crypto.subtle.digest` and compares against the env hash. No plaintext password ever lives in the bundle or git.

### What this is (and isn't)

- This is a **deterrent**, not real security. The hash ships in the JS bundle; a determined attacker with devtools could bypass it. But against casual access (someone opening the URL), it's effective and invisible.
- Real security would mean Supabase Auth (single-user email + password). You explicitly don't want that — noted.
- All Supabase data fetches remain governed by existing RLS / anon-key policies, unchanged.

## Implementation

### 1. New file: `src/components/PasswordGate.tsx`
- Full-screen centered card matching the dark void aesthetic (#0a0a1a bg, gold #c9a84c accent, Cormorant Garamond title, DM Mono input).
- Single password input + submit button. Enter key submits.
- On submit: SHA-256 the input, compare to `import.meta.env.VITE_APP_PASSWORD_HASH`. If match → `sessionStorage.setItem("stellar-auth", "1")` and re-render children. If not → shake + "Access denied" message.
- On mount: check `sessionStorage.getItem("stellar-auth") === "1"` → render children directly, skip the prompt.
- Title: "STELLAR COMMAND" with subtitle "Authorisation required".

### 2. Wrap the app in `src/App.tsx`
- Wrap the existing `<BrowserRouter>` (or the `Routes`) with `<PasswordGate>`.
- Keeps `QueryClientProvider`, `TooltipProvider`, toasters at the outer level so they're available everywhere, including the gate screen if needed.

### 3. Set the password (one-time, by you)
- After approval I'll provide a tiny one-liner you paste into your browser console to compute the hash for whatever password you choose, e.g.:
  ```js
  crypto.subtle.digest("SHA-256", new TextEncoder().encode("your-password"))
    .then(b => console.log(Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,"0")).join("")))
  ```
- You then add `VITE_APP_PASSWORD_HASH=<hash>` via the Lovable env var UI. The `.env` file is auto-managed; I won't edit it.
- Until the env var is set, the gate falls back to a hard-coded placeholder hash for the password `stellar` so you're not locked out during setup. A console warning will flag this.

## Out of scope
- No Supabase Auth, no `auth.users`, no profiles table, no email flow.
- No password reset (you control the env var).
- No per-route protection — it's all-or-nothing at app root.
- No rate limiting (single-user, casual deterrent).

## Files touched
- `src/components/PasswordGate.tsx` — new.
- `src/App.tsx` — wrap routes with `<PasswordGate>`.


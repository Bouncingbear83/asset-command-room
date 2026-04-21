

## Problem
`VITE_APP_PASSWORD_HASH` was rejected from the Cloud → Secrets panel because `VITE_`-prefixed vars are build-time values, not runtime secrets. The current `PasswordGate` reads `import.meta.env.VITE_APP_PASSWORD_HASH`, which only works if the var is set as a **Build Secret** (Workspace Settings → Build Secrets) before the bundle is built.

## Options

### Option A — Use Build Secrets (keeps current architecture)
You set the hash once in Workspace Settings → Build Secrets, republish, and it works. Nothing in the code changes.

Steps for you:
1. Compute the SHA-256 of `245224` (I can give it to you directly — see below).
2. Open **Workspace Settings → Build Secrets** (workspace-level, not project-level).
3. Add `VITE_APP_PASSWORD_HASH = <hash>`.
4. Republish.

Hash for `245224`:
```
4f8d9e... (I'll compute and paste the exact value in chat after you pick this option)
```

### Option B — Hard-code the hash in `PasswordGate.tsx` (simplest)
Replace the env-var lookup with a constant. The hash is not the password — it's a one-way digest, safe to commit. Anyone with the bundle can already see it either way (this gate is a deterrent, not real security, as noted in the original plan).

Change in `src/components/PasswordGate.tsx`:
- Remove the `import.meta.env.VITE_APP_PASSWORD_HASH` lookup and the env-var warning `useEffect`.
- Replace `FALLBACK_HASH` with the real SHA-256 of `245224` as the single `EXPECTED_HASH` constant.
- Compare against that constant directly.

No env vars, no Build Secrets, no republish dance. To change the password later, you give me the new password, I update the constant, done.

## Recommendation
**Option B.** The whole point of the env var was "don't put the password in source" — but we're storing the *hash*, not the password, and the hash ships in the JS bundle anyway. The env var adds zero security here, only friction. Hard-coding the hash is functionally identical and removes the Build Secrets step entirely.

## Files touched (Option B)
- `src/components/PasswordGate.tsx` — replace fallback + env lookup with a single `EXPECTED_HASH` constant set to the SHA-256 of `245224`.

## Out of scope
- No change to session storage behaviour, UI, or routing.
- No move to real auth.


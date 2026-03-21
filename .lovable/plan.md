

## Fix: Claude Quick Commands don't pre-fill the prompt

### Problem

The current URL format is:
```
https://claude.ai/project/019ca3a9-aefe-77ea-af76-db62fd96f4e1?q=encoded_prompt
```

The `/project/{id}` route does NOT support the `?q=` parameter — it just opens the project landing page and ignores the query string. The `?q=` parameter only works on `https://claude.ai/new?q=...`.

### Fix

**`src/components/CommandTab.tsx`** — Update `getClaudeUrl` to use `/new` with both `?q=` and `&project_uuid=` parameters:

```typescript
function getClaudeUrl(prompt: string) {
  if (!prompt) {
    return `https://claude.ai/project/${PROJECT_ID}`;
  }
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}&project_uuid=${PROJECT_ID}`;
}
```

When there's a prompt, use `/new?q=...&project_uuid=...` so the prompt is pre-filled AND the project context is attached. When there's no prompt (the "Open Stellar Intelligence" button), navigate directly to the project page.

If `project_uuid` isn't a supported parameter, fall back to just `/new?q=...` — at minimum the prompt will be pre-filled.

### Files
- `src/components/CommandTab.tsx` — update `getClaudeUrl` function (line 41-44)


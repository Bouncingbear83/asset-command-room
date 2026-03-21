

## Fix: Quick Commands don't open inside the Claude project

### Problem

The current URL format is:
```
https://claude.ai/new?project=019ca3a9-aefe-77ea-af76-db62fd96f4e1&q=...
```

`?project=` is not a recognized Claude URL parameter. This opens a generic new chat with the prompt pre-filled, but NOT inside the specific project context.

### Fix

**`src/components/CommandTab.tsx`** — Update `getClaudeUrl` to use the correct URL path format:

```typescript
function getClaudeUrl(prompt: string) {
  const encodedPrompt = prompt ? `?q=${encodeURIComponent(prompt)}` : "";
  return `https://claude.ai/project/${PROJECT_ID}${encodedPrompt}`;
}
```

This navigates to the project page first (`/project/{id}`), with the prompt pre-filled via `?q=`. The user lands inside the project and can submit the prompt there.

### Files
- `src/components/CommandTab.tsx` — change URL from `/new?project=ID` to `/project/ID`


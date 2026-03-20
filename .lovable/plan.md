

## Fix: Quick Commands blocked by Claude.ai

### Problem

The Lovable preview runs inside an iframe. When `window.open(url, "_blank")` is called from within that iframe, Claude.ai rejects the connection (`ERR_BLOCKED_BY_RESPONSE`) because it sets headers that prevent loading from embedded contexts.

### Fix

Change `launchClaude` to use `window.top.open()` instead of `window.open()`, which opens the URL from the top-level browser window rather than from the iframe context. Add a fallback for cases where `window.top` is inaccessible due to cross-origin restrictions.

### File

**`src/components/CommandTab.tsx`** (line 54-58):

```typescript
function launchClaude(prompt: string) {
  const encodedPrompt = encodeURIComponent(prompt);
  const url = `https://claude.ai/new?project=${PROJECT_ID}&q=${encodedPrompt}`;
  try {
    (window.top || window).open(url, "_blank");
  } catch {
    window.open(url, "_blank");
  }
}
```

This single-line change should resolve the blocking issue. If it still fails in the preview (because Lovable's iframe sandbox may restrict `window.top` access), it will work correctly on the published URL where there's no parent iframe.


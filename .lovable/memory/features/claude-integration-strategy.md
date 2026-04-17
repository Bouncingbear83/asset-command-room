---
name: Claude Integration Strategy
description: Canonical Claude deep-link URL pattern and project ID for all dashboard buttons
type: feature
---
Strategic research and trade logging are integrated with a dedicated Claude project (ID: `019ca3a9-aefe-77ea-af76-db62fd96f4e1`).

**Canonical deep-link URL pattern (use for ALL Claude buttons):**
```
https://claude.ai/project/019ca3a9-aefe-77ea-af76-db62fd96f4e1?prompt=<URL_ENCODED_PROMPT>
```

Do NOT use the legacy `claude.ai/new?q=…&project_uuid=…` pattern, and never use `#hash` anchors (Claude ignores them). Open via `(window.top || window).open(url, '_blank')` to bypass iframe CSP.

The Lovable project ID (`be2a318a-707e-4e8d-ae4b-23f3eab50633`) is NOT the Claude project ID — never use it in Claude links.

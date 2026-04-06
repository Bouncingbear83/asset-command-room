

## Fix: Show Deep Dive Button on Mobile in Scores Tab

### Problem
The Deep Dive (🔬) button in the Scores tab action column is wrapped in `{!isMobile && ...}` (line 320), so it's completely hidden on mobile viewports. The action column itself renders, but only shows the action badge — no button.

### Fix
Remove the `!isMobile &&` guard on the Deep Dive button (line 320). The button is small enough to fit in the action cell on mobile. Optionally reduce padding slightly for mobile.

### File changed
- `src/components/ScoresTab.tsx` — line 320: remove `!isMobile &&` condition wrapping the Deep Dive button


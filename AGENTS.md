
- Action surface routing (lanes, dedupe, rule checks) lives in pure functions in src/lib/actionSurface.ts with thresholds in src/config/signalRules.ts; UI components only render its output — keeps display rules testable and out of score/IRR-BB maths.

The expanded row is showing `Quartet set 5d ago` because the quartet date is present, but the four target columns are not being parsed into `bullBase`, `bullStretch`, `bearThesisWeak`, and `bearSubstrateFail`.

Plan:
1. Fix score-sheet header normalization so spaced quartet headers like `BULL BASE`, `BULL STRETCH`, `BEAR THESIS WEAK`, and `BEAR SUBSTRATE FAIL` resolve to the same canonical fields as the underscore versions.
2. Extend the score parser fallbacks to read both underscore and spaced forms for all quartet target fields and the quartet date.
3. Change the expanded-row drift wording so it only says `Quartet set Xd ago` when at least one actual target value is present; otherwise it should say the targets are missing/incomplete.
4. Add debug visibility for parsed quartet counts so we can verify the app sees the target values, not just the date.

Technical files:
- `src/hooks/usePortfolioData.ts` — fix parsing at the source.
- `src/components/CommandTab.tsx` — fix the misleading drift text/debug output only.
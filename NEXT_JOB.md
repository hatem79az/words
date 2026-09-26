# Next job

This file is the handoff point for the next coding session. **Every pull request that changes the app must update this file before it is merged.** Move finished work to the short completed list, place the next unfinished deliverable at the top, and update its acceptance checks. The full scope lives in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Next deliverable: memory cards

Build a memory matching game from the same saved lesson pairs. A small face-down board should contain one prompt card and one answer card for each selected pair, shuffled without showing a term before its flip. Keep the current language direction and exclude ambiguous repeated terms.

Acceptance checks:

1. At least four unambiguous pairs are needed; the readiness message explains when a lesson is too small.
2. Cards reveal by click, Enter, or Space. A correct pair stays visible; a mismatch flips back after an understandable pause without accepting a third card.
3. Attempts, matches, and completion feedback are accurate. The board works at narrow widths, respects RTL term direction and reduced motion, and keeps keyboard focus usable.
4. Update this file before merging the PR. Keep the browser acceptance item below open until it is exercised on Windows.

## Open browser acceptance gate

On the intended Windows browser, attach pictures and recordings, save, close/reopen, export, import on another browser/computer, and play with the network disconnected. Confirm the JSON contains WebP and audio bytes rather than source paths. Review desktop and narrow widths, keyboard focus, Arabic RTL, and reduced motion visually and fix any defects found. The cloud browser blocked the local `file://` app, so code review and local checks do not close this gate.

## Completed in code

- Initial offline HTML/CSS/JavaScript starter: named lessons, four languages, JSON backup, flashcards.
- Activity roadmap and shared text-game foundation: multiple choice, matching pairs, typed spelling, restrained feedback motion and sound, mute control.
- Version 2 portable media: WebP conversion, per-language audio, IndexedDB working copy, self-contained JSON, old export migration, picture choice, and listen and choose. Ambiguous duplicate media clues are excluded. The layout, focus path, responsive game screens, progress bars, reduced-motion behavior, and synthesized feedback cues received a code-level polish pass. Windows browser acceptance remains open above.
- First Unicode spelling games: letter tiles, missing letters, and listen-and-type use the shared lesson, preserve grapheme clusters, skip unsuitable words, allow keyboard play, and offer a retry before revealing the answer. Listen-and-type requires an answer-language recording and starts it only when Play is pressed.
- Letter guess uses a bounded mistake count and target grapheme tiles, including marked Arabic letters. Word search uses 3–5 short Polish, German, or English words, supports keyboard selection of endpoints, and has a guaranteed solvable placement fallback. Arabic answer words receive a clear availability message for word search.
- Crossword generates a connected grid of 3–5 short unique answer words with actual crossings and numbered across/down clues. It preserves Polish and German letters, supports keyboard selection and editable answer drafts, and explains the Arabic answer-language and insufficient-grid gates.

## After this job

Finish true or false, picture labels, category sort, sentence order, and sentence completion; then learner progress and the complete browser acceptance pass. **One-click Windows packaging is phase 2 only.**

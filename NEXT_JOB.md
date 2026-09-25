# Next job

This file is the handoff point for the next coding session. **Every pull request that changes the app must update this file before it is merged.** Move finished work to the short completed list, place the next unfinished deliverable at the top, and update its acceptance checks. The full scope lives in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Next deliverable: first Unicode spelling games

Build letter tiles, missing letters, and listen-and-type from the shared lesson data. Split tiles into Unicode grapheme clusters so Polish accents, German umlauts and ß, and Arabic script stay intact. Skip unsuitable terms with visible guidance. These are the first three of the six remaining spelling modes in [the full 18-activity inventory](docs/BUILD_PLAN.md).

Acceptance checks:

1. All three modes use the saved lesson, explain when clues are insufficient, and work from a keyboard.
2. Combining characters and Arabic letters remain intact; accents remain significant when checking a typed answer.
3. Listen-and-type starts recordings only after the learner presses Play and handles unsupported audio clearly.
4. Update this file before merging the spelling PR. Keep the browser acceptance item below open until it is exercised on Windows.

## Open browser acceptance gate

On the intended Windows browser, attach pictures and recordings, save, close/reopen, export, import on another browser/computer, and play with the network disconnected. Confirm the JSON contains WebP and audio bytes rather than source paths. Review desktop and narrow widths, keyboard focus, Arabic RTL, and reduced motion visually and fix any defects found. The cloud browser blocked the local `file://` app, so code review and local checks do not close this gate.

## Completed in code

- Initial offline HTML/CSS/JavaScript starter: named lessons, four languages, JSON backup, flashcards.
- Activity roadmap and shared text-game foundation: multiple choice, matching pairs, typed spelling, restrained feedback motion and sound, mute control.
- Version 2 portable media: WebP conversion, per-language audio, IndexedDB working copy, self-contained JSON, old export migration, picture choice, and listen and choose. Ambiguous duplicate media clues are excluded. The layout, focus path, responsive game screens, progress bars, reduced-motion behavior, and synthesized feedback cues received a code-level polish pass. Windows browser acceptance remains open above.

## After this job

Finish letter guess, word search, crossword, and the other activities in the build plan; then learner progress and the complete browser acceptance pass. **One-click Windows packaging is phase 2 only.**

# Next job

This file is the handoff point for the next coding session. **Every pull request that changes the app must update this file before it is merged.** Move finished work to the short completed list, place the next unfinished deliverable at the top, and update its acceptance checks. The full scope lives in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Next deliverable: letter guess and word search

Build letter guess and word search from the same saved lesson data. Reuse grapheme splitting and skip unsuitable terms or scripts with visible guidance. Word search must generate a solvable grid, preserve Polish and German characters, and avoid visually broken Arabic letter sequences; if Arabic cannot be presented readably in a grid, mark that mode unavailable for Arabic while keeping letter guess available.

Acceptance checks:

1. Both games use the saved lesson, explain when clues or suitable words are insufficient, and work from a keyboard.
2. Guessing keeps combining marks attached to letters; accents remain significant. The grid is readable and every target can actually be found.
3. Wrong attempts provide useful feedback and a fair retry; the learner can complete a round without a mouse.
4. Update this file before merging the PR. Keep the browser acceptance item below open until it is exercised on Windows.

## Open browser acceptance gate

On the intended Windows browser, attach pictures and recordings, save, close/reopen, export, import on another browser/computer, and play with the network disconnected. Confirm the JSON contains WebP and audio bytes rather than source paths. Review desktop and narrow widths, keyboard focus, Arabic RTL, and reduced motion visually and fix any defects found. The cloud browser blocked the local `file://` app, so code review and local checks do not close this gate.

## Completed in code

- Initial offline HTML/CSS/JavaScript starter: named lessons, four languages, JSON backup, flashcards.
- Activity roadmap and shared text-game foundation: multiple choice, matching pairs, typed spelling, restrained feedback motion and sound, mute control.
- Version 2 portable media: WebP conversion, per-language audio, IndexedDB working copy, self-contained JSON, old export migration, picture choice, and listen and choose. Ambiguous duplicate media clues are excluded. The layout, focus path, responsive game screens, progress bars, reduced-motion behavior, and synthesized feedback cues received a code-level polish pass. Windows browser acceptance remains open above.
- First Unicode spelling games: letter tiles, missing letters, and listen-and-type use the shared lesson, preserve grapheme clusters, skip unsuitable words, allow keyboard play, and offer a retry before revealing the answer. Listen-and-type requires an answer-language recording and starts it only when Play is pressed.

## After this job

Finish crossword and the other activities in the build plan; then learner progress and the complete browser acceptance pass. **One-click Windows packaging is phase 2 only.**

# Next job

This file is the handoff point for the next coding session. **Every pull request that changes the app must update this file before it is merged.** Move finished work to the short completed list, place the next unfinished deliverable at the top, and update its acceptance checks. The full scope lives in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Next deliverable: category sort

Let the teacher assign vocabulary items to named categories within a lesson, then let the learner sort terms into those groups. Category names and memberships must survive save, duplicate, export, and import.

Acceptance checks:

1. The teacher can create at least two distinct named groups and assign items to them without copying lesson words into a separate game list.
2. Groups and membership survive save, duplicate, export, and import. Older JSON files still open, and ambiguous or incomplete categories are rejected or explained.
3. The learner sorts with click or keyboard, receives clear feedback, and sees accurate progress in each selected language direction, including RTL.
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
- Memory cards uses four to six unique saved pairs, shuffles both sides face down, and keeps matched cards visible. A mismatch pauses the board and then covers both cards; attempts and matches are tracked separately. The board supports keyboard activation, narrow widths, RTL terms, and reduced motion.
- True or false uses an even number of unique lesson prompts (up to ten), half correct and half deliberately incorrect, with a distinct answer from another pair for each false proposal. It reports the actual matching answer after an error and supports all four language directions.
- Picture labels adds up to eight teacher-positioned markers to an attached scene image, with normalized coordinates and references to lesson items. Version 3 JSON preserves them and migrates older exports; duplicates remap item IDs. A learner chooses terms and numbered markers with mouse or keyboard, and the activity explains when a picture lacks enough eligible labels.

## After this job

Finish sentence order and sentence completion; then learner progress and the complete browser acceptance pass. **One-click Windows packaging is phase 2 only.**

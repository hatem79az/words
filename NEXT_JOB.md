# Next job

This file is the handoff point for the next coding session. **Every pull request that changes the app must update this file before it is merged.** Move finished work to the short completed list, place the next unfinished deliverable at the top, and update its acceptance checks. The full scope lives in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Next deliverable: Windows browser acceptance and quality pass

Exercise the complete browser app on the intended Windows machine with the network disconnected. Fix any defects found in lesson authoring, all activities, media transfer, learner progress, responsive layout, and accessibility before beginning Windows packaging.

Acceptance checks:

1. On Windows, create a lesson with four-language text, categories, examples, image markers, pictures, and recordings. Save, close/reopen, export, import on another browser/computer, and confirm all content and media bytes survive without network access.
2. Play every eligible activity using mouse and keyboard in multiple language directions. Review narrow widths, Arabic RTL, Polish and German marks, focus order, sound mute, and reduced motion. Fix any defects found.
3. Complete scored rounds and flashcard passes, inspect per-lesson progress, clear it, delete a lesson, and confirm teacher JSON exports contain no progress. Exercise blocked or full browser storage without breaking practice.
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
- Category sort adds up to 30 localized lesson groups and optional item membership in version 4 JSON. Older exports migrate, duplicates remap category IDs, and invalid/ambiguous names or broken references are rejected. Rounds draw two pairs from each of two to four eligible groups, with keyboard-friendly choices and one retry.
- Sentence order adds optional 3–12 ordered chunks per language to each lesson word in version 5 JSON. Older exports migrate and duplicates deep-copy examples. The learner uses the front-language sentence to rebuild a target sentence from clickable, keyboard-accessible tiles, including repeated chunks and Arabic RTL; an incorrect attempt offers a retry, then the approved sentence.
- Sentence completion adds a teacher-selected gap index per language in version 6 JSON; the selected sentence chunk is the approved answer. Older exports migrate, duplicates preserve the choice, invalid indexes and punctuation-only answers are rejected, and duplicate visible questions are excluded. The learner types a missing chunk against a front-language example with one retry, answer reveal, and RTL presentation.
- Learner progress records completed scored rounds and unscored flashcard passes in a separate local browser store, capped at 500 attempts. Each lesson shows aggregate scored answers and five recent results with activity, direction, and time; a confirmed clear removes its records. Deletion and replacement imports prune orphaned records. Progress stays out of teacher JSON backups, and storage failure leaves practice playable.

## After this job

Once the complete browser acceptance and accessibility pass succeeds, start the one-click Windows wrapper and second-laptop test. **Packaging remains phase 2.**

# Next job

This file is the handoff point for the next coding session. **Every pull request that changes the app must update this file before it is merged.** Move the finished work to the short completed list, put the next unfinished deliverable at the top, and update its acceptance checks. The full scope lives in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## Next deliverable: portable images and pronunciation audio

Build a managed media library for the browser phase, with an explicit export/import format that includes images and recordings. Keep lessons independent of absolute file paths. Add image and audio fields to the lesson editor, previews, playback controls, and a migration path from schema version 1. Then make picture choice and listen-and-choose playable when the lesson has suitable media.

Acceptance checks:

1. A lesson with words in two languages, local images, and optional per-language audio can be saved, exported, imported on another computer, and played with no internet connection.
2. A missing or unsupported file produces a useful error without losing lesson text. Replacing an image or audio file does not delete the original source file.
3. Old version 1 JSON lessons import successfully. New exports contain the media bytes or a documented self-contained package; no absolute source path is required to play.
4. Picture choice and listen-and-choose explain when there are too few usable items. Audio playback is controlled by the learner; it never starts unexpectedly.
5. Run the model tests and manually exercise the export/import flow in a browser, including Arabic and Polish text.

## Completed

- Initial offline HTML/CSS/JavaScript starter: named lessons, four languages, JSON backup, flashcards.
- Activity roadmap and shared text-game foundation: multiple choice, matching pairs, typed spelling, restrained feedback motion and sound, mute control.

## After this job

Finish the remaining activities in the order in the build plan, improve lesson authoring and progress, and test the complete browser app. **Windows packaging is phase 2 only.**

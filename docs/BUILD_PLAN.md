# Words build plan

## Product goal

One teacher-created lesson feeds many genuinely different practice activities. A lesson may contain English, Polish, Arabic, and German terms, images, optional recordings, categories, and short contextual sentences. The learner can choose a language direction and play whenever the activity has enough suitable items. The application works locally without an account or network connection.

The core rule is **edit a word once, update every eligible activity**. Games never keep their own editable copies of the lesson. A game that lacks data explains what the teacher can add.

## Two phases

### Phase 1: finish the browser app

Build the lesson editor, shared content model, all agreed activities, image/audio import, animation and sound design, accessibility, progress, durable export/import, and error handling in plain HTML/CSS/JavaScript. Run it from local files. Test on the intended Windows browser, with the network disconnected. Do not start desktop packaging until the complete app passes the phase 1 checks.

### Phase 2: one-click Windows app

Wrap the completed browser app for Windows only, supply a portable or installed build, give lessons and media reliable local folder storage, and test a copy on a second Windows laptop. The learner must open it by clicking an app icon without installing developer tools. Keep the phase 1 content format migratable. No Mac or web deployment target is planned.

## Activity inventory

The release target includes these modes. A language pair means a prompt language and an answer language chosen by the learner. Repeated or ambiguous translations are excluded from games that need unique pairs. Small lessons show readiness guidance instead of broken rounds.

| Group | Activity | What the learner does | Data gate |
| --- | --- | --- | --- |
| Recall | Flashcards | Reveal the answer, optionally play its audio, and advance. | One language pair. |
| Recognition | Multiple choice | Select the translation from four distinct answers. | Four unambiguous pairs. |
| Recognition | Match pairs | Match prompts to answers across several short rounds. | Four unique pairs. |
| Recognition | Memory cards | Turn over cards and remember pairs. | Four unique pairs. |
| Recognition | True or false | Judge a deliberately correct or incorrect word pair. | Several unique pairs; balanced rounds. |
| Spelling | Type the answer | Recall and type the complete target word or short phrase. | A clear prompt and target term. |
| Spelling | Letter tiles | Put the target graphemes in order. | A suitable word; tiles use Unicode graphemes. |
| Spelling | Missing letters | Complete a word with a few hidden graphemes. | A suitable word; enough visible context. |
| Spelling | Letter guess | Guess letters with a limited mistake count and a visible clue. | A suitable word; no ambiguous clue. |
| Spelling | Word search | Find target words in a grid. | Several short words and an eligible alphabet/script. |
| Spelling | Crossword | Fill intersecting word clues with keyboard input. | Several suitable words with a valid generated grid. |
| Listening | Listen and choose | Hear a recording and choose the matching word or image. | Four items with relevant recordings and distinct answers. |
| Listening | Listen and type | Hear a recording and type the target term. | Recording and teacher-approved answer. |
| Visual | Picture choice | Choose the term for an image. | Four distinct images and target terms. |
| Visual | Label the picture | Place terms on teacher-marked parts of an image. | An image with at least two labelled hotspots. |
| Sorting | Category sort | Put words into labelled groups. | Two or more categories with enough examples. |
| Context | Sentence order | Rebuild a short sentence from word chunks. | Teacher-entered example and approved chunk order. |
| Context | Complete the sentence | Choose or type a missing word in context. | Teacher-entered sentence with a validated gap and answer. |

These 18 modes are the complete phase 1 release list. Timed rounds, a random wheel, and a gameshow look can be optional presentation settings, not separate learning mechanics. The current build includes flashcards, multiple choice, match pairs, memory cards, true or false, typed spelling, picture choice, listen and choose, letter tiles, missing letters, listen and type, letter guess, word search, and crossword. The other four rows remain planned work.

### Language-specific answer rules

- Preserve Polish diacritics, German umlauts and ß, and Arabic letters. Use Unicode NFC normalization and case folding appropriate to the target language; do not silently remove accents or Arabic marks. A teacher may add accepted alternatives later.
- Letter games split text into **grapheme clusters**, not JavaScript string positions, so combining marks stay with their base character. The teacher can disable a spelling mode for an unsuitable word or script.
- The current letter tiles and missing letters accept distinct single words of suitable length. They use [Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter) for grapheme splitting; if it is unavailable, the game explains why it cannot run instead of breaking letters apart. Listen-and-type uses a recording in the answer language and requires an explicit Play action.
- Letter guess accepts 3–10 graphemes and includes target graphemes in its choice set, with six allowed mistakes. Word search accepts 3–5 distinct answer words of 3–8 graphemes, lays them horizontally or vertically, and accepts endpoint selection in either direction. A bounded placement attempt falls back to guaranteed separate rows. Word search currently supports English, Polish, and German answer words; Arabic answer words are explicitly gated until a readable grid is designed.
- Crossword selects up to five eligible 3–8 grapheme answer words and requires at least three with real intersections. It assigns clue numbers from final start positions, checks complete answers while preserving marked letters, and keeps wrong drafts for editing. It supports English, Polish, and German answer words; Arabic answer words are gated until the grid and entry flow can show them readably.
- Memory cards selects four to six unique lesson pairs and shuffles both sides face down. It keeps matching pairs visible, briefly shows mismatches before covering them, counts complete attempts, and supports all four languages with each revealed term's direction.
- Avoid distractors with the same meaning or identical written answer. Do not turn a reading or listening comprehension task into a mere translation prompt when richer context is available.
- Scores are game attempts, kept apart from lesson source content. Wrong answers lead to a retry or review opportunity.

## Lesson and storage model

Version 1 stores one collection with lessons; each item has `terms` keyed by `en`, `pl`, `ar`, and `de`, plus reserved media slots. Version 2 embeds assets in a self-contained JSON export. Item media references stable asset IDs: one WebP picture and optional recordings keyed by language. Imported PNG/JPG/WebP pictures are resized to at most 1024 pixels per side and encoded as WebP. Audio is copied as MP3, WAV, OGG, WebM, or M4A when the browser supports it. The app never edits the source files or stores absolute paths. Version 1 imports migrate to version 2 in memory. Later schema work adds categories, accepted answers, contextual examples, and picture hotspots.

In phase 1, JSON import/export is the durable transfer path. IndexedDB stores the working copy when available; the earlier localStorage cache is imported when present. Browser storage is a convenience because behavior on `file://` pages varies and quota can be exceeded. Save the lesson before exporting; the JSON includes media bytes. Images are limited to a 12 MB source and roughly 1.65 MB encoded WebP, recordings to 4 MB each, and the total asset data to about 24 MB. In phase 2, a Windows app will use an ordinary writable content folder and a separate per-computer progress location.

## Motion and sound direction

Aim for clear, playful feedback rather than constant motion. Cards enter with a short opacity/transform transition; correct answers give a gentle lift or glow, wrong answers a brief restrained nudge, and completed rounds a small celebratory flourish. Keep most feedback under about 300 ms and make the screen usable before and after the animation. Do not use flashing, full-screen shaking, or animations that delay the next answer.

Use CSS transitions/keyframes for ordinary states and the Web Animations API for short, cancellable feedback effects. Animate mainly `transform` and `opacity`. Honor `prefers-reduced-motion` and provide a static state that conveys the same result. Keep RTL layout logical and test motion in both directions. Keep the browser build dependency free and fully offline; a downloaded animation library adds weight without solving the current screens. Revisit only if later game mechanics need coordinated timelines.

Use quiet, distinct local sounds for correct, incorrect, and completion feedback. Start audio only after a learner action, offer a clearly visible mute setting, and persist it locally when possible. The first milestone synthesizes small cues with Web Audio so the app remains self-contained; replace or supplement them with licensed local sound assets if listening tests show they improve the experience. Pronunciation recordings are a separate learning asset and must never be confused with game feedback. No remote audio service is required.

Technical references: [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API), [reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion), [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices), and [canvas WebP export and fallback behavior](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL). If the browser cannot encode WebP, the editor must reject the image clearly rather than silently storing a different format.

## Work order and gates

| Milestone | Deliverable | Done when |
| --- | --- | --- |
| 1. Shared text games | Game eligibility, chooser, multiple choice, match pairs, typed spelling, feedback effects. | The same edited lesson drives four working modes; small lessons and ambiguous pairs are handled visibly. |
| 2. Portable media | Image/audio authoring, self-contained JSON import/export, picture choice, listen and choose. | Code is present; Windows browser transfer and offline play remain an open acceptance gate. |
| 3a. First spelling games | Tiles, missing letters, listen and type. | Code and local Unicode checks are present; Windows browser interaction and RTL visual acceptance remain open. |
| 3b. More spelling | Letter guess, word search, crossword. | Code and local generator checks are present for all three; Windows browser acceptance remains open. |
| 4. More practice | Memory, true/false, categories, sentence order, sentence completion, picture labels. | Memory cards and true/false have code and local checks; the other activities remain open. Games use shared data and clearly state their requirements. |
| 5. Quality and progress | Learner progress, retries, backups, accessibility, visual/audio polish, complete browser acceptance pass. | All listed activities work offline on Windows in the browser with keyboard support and reduced motion. |
| 6. Windows wrapper | App icon, local content folder, portable Windows build and second-laptop test. | Click to open; copy lessons/media; play offline; no VS Code or Node.js for the learner. |

Every merged app change updates [NEXT_JOB.md](../NEXT_JOB.md) with the next specific deliverable and checks. A milestone is complete only when its behavior is implemented and exercised; a checked box in this plan is not evidence by itself.

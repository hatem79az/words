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
| Listening | Listen and choose | Hear a recording and choose the matching word or image. | Four items with relevant recordings and distinct answers. |
| Listening | Listen and type | Hear a recording and type the target term. | Recording and teacher-approved answer. |
| Visual | Picture choice | Choose the term for an image. | Four distinct images and target terms. |
| Sorting | Category sort | Put words into labelled groups. | Two or more categories with enough examples. |
| Context | Sentence order | Rebuild a short sentence from word chunks. | Teacher-entered example and approved chunk order. |

Timed rounds are an optional setting for several modes, not a separate activity. We will not count cosmetic reskins of the same mechanic as new games. The first shared-game milestone adds multiple choice, matching pairs, and typed spelling beside flashcards. The remaining rows are phase 1 work, not features we claim to have shipped yet.

### Language-specific answer rules

- Preserve Polish diacritics, German umlauts and ß, and Arabic letters. Use Unicode NFC normalization and case folding appropriate to the target language; do not silently remove accents or Arabic marks. A teacher may add accepted alternatives later.
- Letter games split text into **grapheme clusters**, not JavaScript string positions, so combining marks stay with their base character. The teacher can disable a spelling mode for an unsuitable word or script.
- Avoid distractors with the same meaning or identical written answer. Do not turn a reading or listening comprehension task into a mere translation prompt when richer context is available.
- Scores are game attempts, kept apart from lesson source content. Wrong answers lead to a retry or review opportunity.

## Lesson and storage model

Version 1 stores one collection with lessons; each item has `terms` keyed by `en`, `pl`, `ar`, and `de`, plus reserved media slots. Next version adds stable media identifiers, optional audio per language, categories, accepted answers, and contextual examples. Migrations are explicit and tested using old exports. Source images and recordings are copied into an owned, portable package rather than referenced by absolute paths.

In phase 1, JSON import/export is the durable transfer path. Browser storage is a convenience cache because behavior on `file://` pages varies. The media milestone will define a self-contained bundle before accepting attached files. In phase 2, a Windows app will use an ordinary writable content folder and a separate per-computer progress location.

## Motion and sound direction

Aim for clear, playful feedback rather than constant motion. Cards enter with a short opacity/transform transition; correct answers give a gentle lift or glow, wrong answers a brief restrained nudge, and completed rounds a small celebratory flourish. Keep most feedback under about 300 ms and make the screen usable before and after the animation. Do not use flashing, full-screen shaking, or animations that delay the next answer.

Use CSS transitions/keyframes for ordinary states and the Web Animations API for short, cancellable feedback effects. Animate mainly `transform` and `opacity`. Honor `prefers-reduced-motion` and provide a static state that conveys the same result. Keep RTL layout logical and test motion in both directions.

Use quiet, distinct local sounds for correct, incorrect, and completion feedback. Start audio only after a learner action, offer a clearly visible mute setting, and persist it locally when possible. The first milestone synthesizes small cues with Web Audio so the app remains self-contained; replace or supplement them with licensed local sound assets if listening tests show they improve the experience. Pronunciation recordings are a separate learning asset and must never be confused with game feedback. No remote audio service is required.

Technical references: [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API), [reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion), and [Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

## Work order and gates

| Milestone | Deliverable | Done when |
| --- | --- | --- |
| 1. Shared text games | Game eligibility, chooser, multiple choice, match pairs, typed spelling, feedback effects. | The same edited lesson drives four working modes; small lessons and ambiguous pairs are handled visibly. |
| 2. Portable media | Image/audio authoring, package import/export, picture choice, listen and choose. | Lesson moves to another computer with working media and old JSON imports. |
| 3. More spelling | Tiles, missing letters, letter guess, word search, listen and type. | Unicode and RTL cases work; each mode has a meaningful clue and feedback. |
| 4. More practice | Memory, true/false, categories, sentence order. | Games use shared data and clearly state their data requirements. |
| 5. Quality and progress | Learner progress, retries, backups, accessibility, visual/audio polish, complete browser acceptance pass. | All listed activities work offline on Windows in the browser with keyboard support and reduced motion. |
| 6. Windows wrapper | App icon, local content folder, portable Windows build and second-laptop test. | Click to open; copy lessons/media; play offline; no VS Code or Node.js for the learner. |

Every merged app change updates [NEXT_JOB.md](../NEXT_JOB.md) with the next specific deliverable and checks. A milestone is complete only when its behavior is implemented and exercised; a checked box in this plan is not evidence by itself.

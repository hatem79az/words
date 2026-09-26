# Words

An offline vocabulary lesson starter built with plain HTML, CSS, and JavaScript. It supports content and interface text in English, Polish, Arabic, and German. No account, server, package manager, or internet connection is required to use this first version.

## Run it

Download the repository as a ZIP, extract it, and open `index.html` in a current browser. Keep the `index.html`, `css`, and `js` files together. A development editor such as VS Code is optional.

## What works now

- Create, edit, duplicate, and delete named lessons.
- Add vocabulary entries with terms in any of the four languages. An entry needs at least two terms to be usable as a flashcard.
- Choose a front and back language, then practise with flashcards, multiple choice, matching pairs, memory cards, true or false, typed spelling, letter tiles, missing letters, letter guess, word search, crossword, picture choice, picture labels, category sort, sentence order, sentence completion, listen and choose, or listen and type. Games show when a lesson lacks suitable items and skip ambiguous repeated pictures or recordings.
- Letter tiles and missing letters accept suitable single words and keep combined Unicode letters intact. Listen-and-type uses a recording in the answer language; press Play to hear it. Typed spelling, tiles, missing letters, and listen-and-type allow one retry before showing the answer.
- Letter guess allows six mistakes and supports Polish, German, and Arabic answer words. Word search uses 3–5 short English, Polish, or German answer words; select the first and last grid cell of a listed word. Arrow keys move through the grid, and Enter selects a cell. Arabic word search stays unavailable until a readable grid is designed.
- Crossword uses up to five distinct short English, Polish, or German answer words when at least three can make a connected grid. Pick an across or down clue, type its answer, and check it; arrow keys move through grid cells and Enter selects a clue. Correct answers reveal crossing letters. Wrong answers stay editable. Arabic answer words receive a clear availability message.
- Memory cards use four to six unambiguous lesson pairs. Flip two cards to match a prompt and answer; mismatches turn back after a short pause. Tab, Enter, and Space work on the board, including with Arabic terms.
- True or false presents an even set of correct and incorrect word pairs (up to ten rounds). Incorrect proposals use another distinct answer in the lesson, and feedback shows the actual matching answer after an error.
- Picture labels uses a teacher-marked scene image. In the picture attachment, choose a lesson word and click its location or enter position percentages; repeat for at least two different words, then save. During play, choose a term and its numbered marker. Correct labels stay placed, and the activity works with click or keyboard in all four language directions.
- Category sort lets the teacher name groups in the languages they use and assign words in the lesson editor. A round uses two to four groups with two unambiguous word pairs each; group names must exist in the answer language. Choose a group for each prompt with click or keyboard. One retry is allowed before the correct group is shown.
- Sentence order uses example sentences entered on a lesson word. Open **Example sentences** in that word, and separate three to twelve ordered chunks with `|` in each language you want to pair, keeping punctuation with its word. The front-language example is the clue; select answer-language chunks to assemble it. Repeated chunks remain separate tiles. Remove a placed chunk or clear the whole sentence, then check; one retry is allowed before the approved sentence appears.
- Sentence completion uses those same examples. In **Example sentences**, choose one existing word or phrase chunk as the gap in a language; its text becomes the approved answer, with terminal sentence punctuation left visible. Add an example in the other selected language as the clue. The learner sees that clue and the answer-language sentence with one blank, types the missing chunk, and gets one retry before the answer is shown. Identical visible questions are excluded.
- A saved lesson shows learner progress below practice: completed rounds, scored answers, and the five most recent attempts with activity, language direction, result, and time. Completing a flashcard pass records cards viewed without treating them as scored answers. **Clear progress** removes that lesson's local results after confirmation. Deleting a lesson removes its results; a duplicated lesson starts fresh.
- Attach one picture to a word and optional pronunciation recordings for each language. WebP, PNG, and JPG images are copied into the lesson as resized WebP. Audio may be MP3, WAV, OGG, WebM, or M4A when the browser supports that file. The original files stay in place.
- Hear short local feedback cues for answers and mute them at any time. Reduced-motion system preferences are respected.
- Change the interface language. Arabic uses a right-to-left layout; individual term fields retain their correct writing direction.
- Export all lessons with embedded media to one JSON file and import it on this or another computer. Older version 1–5 exports migrate on import.

Lessons are also saved in the browser's IndexedDB when available, with the earlier localStorage cache as a fallback. **Save the lesson, then export regularly**: storage for pages opened with `file://` can behave differently between browsers and may disappear if browser data is cleared. The app warns if browser storage fails. JSON import/export is the reliable transfer and backup route in this stage. The app never uploads lessons. The media flow still needs hands-on acceptance on the intended Windows browser; see [NEXT_JOB.md](NEXT_JOB.md).

Learner progress is stored separately in this browser's localStorage, with the most recent 500 attempts retained across all lessons. It is **not** in lesson JSON exports or transferred to another computer. If progress storage fails, play continues and the current session's results remain visible until the page closes.

## Project structure

```text
index.html       Main screen and accessible controls
css/style.css    Responsive and RTL styling
js/model.js      Versioned lesson data, validation, and flashcard selection
js/i18n.js       English, Polish, Arabic, and German interface strings
js/games.js      Shared game eligibility, choices, matching rounds, spelling comparison
js/effects.js    Local feedback sound and reduced-motion-aware animation
js/media.js      Image conversion, audio import, and explicit playback
js/storage.js    IndexedDB working copy and legacy cache fallback
js/progress.js   Separate local learner results and summaries
js/app.js        Browser interactions and local file import/export
tests/           Data model checks (development only)
docs/            Two-phase build plan and activity inventory
NEXT_JOB.md      The next concrete task, updated with every merged app change
```

The lesson format uses language codes as keys, for example:

```json
{
  "id": "item-id",
  "terms": { "en": "cat", "pl": "kot", "ar": "قطة", "de": "Katze" },
  "categoryId": "animals-or-null",
  "sentences": { "en": ["I", "see", "a cat."], "pl": ["Widzę", "małego", "kota."], "ar": [], "de": [] },
  "completionGaps": { "en": null, "pl": 2, "ar": null, "de": null },
  "media": { "image": "asset-id-or-null", "audio": { "pl": "recording-asset-id" }, "hotspots": [] }
}
```

The version 6 collection has an `assets` object. Each asset contains a MIME type and a base64 data URL; the item stores its asset ID. A picture's optional `hotspots` list holds up to eight `{ "itemId": "lesson-word-id", "x": 0.25, "y": 0.6 }` markers with normalized positions. Each lesson also has `categories` with stable IDs and names keyed by language; item `categoryId` refers to one of those IDs. Item `sentences` holds teacher-approved ordered chunks per language. `completionGaps` identifies the zero-based chunk to hide; the answer is derived from the saved chunk while terminal sentence punctuation stays visible, so editing a sentence updates both activities. No absolute Pictures-folder paths are required. Images are limited to a 12 MB source and roughly 1.65 MB after WebP conversion; audio files to 4 MB each. A compact export can still be much larger than a text-only lesson.

## Development

There are no runtime dependencies or build step. The local model checks can be run with `node --test tests/*.test.cjs` if Node.js is installed. Open `index.html` in the intended Windows browser to review the interface and media import/export.

## Next stage

Follow [NEXT_JOB.md](NEXT_JOB.md). The full 18-activity inventory and quality gates are in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md). Windows packaging is phase 2 and has intentionally not started.

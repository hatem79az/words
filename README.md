# Words

An offline vocabulary lesson starter built with plain HTML, CSS, and JavaScript. It supports content and interface text in English, Polish, Arabic, and German. No account, server, package manager, or internet connection is required to use this first version.

## Run it

Download the repository as a ZIP, extract it, and open `index.html` in a current browser. Keep the `index.html`, `css`, and `js` files together. A development editor such as VS Code is optional.

## What works now

- Create, edit, duplicate, and delete named lessons.
- Add vocabulary entries with terms in any of the four languages. An entry needs at least two terms to be usable as a flashcard.
- Choose a front and back language, then practise with flashcards, multiple choice, matching pairs, typed spelling, letter tiles, missing letters, picture choice, listen and choose, or listen and type. Games show when a lesson lacks suitable items and skip ambiguous repeated pictures or recordings.
- Letter tiles and missing letters accept suitable single words and keep combined Unicode letters intact. Listen-and-type uses a recording in the answer language; press Play to hear it. Spelling rounds allow one retry before showing the answer.
- Attach one picture to a word and optional pronunciation recordings for each language. WebP, PNG, and JPG images are copied into the lesson as resized WebP. Audio may be MP3, WAV, OGG, WebM, or M4A when the browser supports that file. The original files stay in place.
- Hear short local feedback cues for answers and mute them at any time. Reduced-motion system preferences are respected.
- Change the interface language. Arabic uses a right-to-left layout; individual term fields retain their correct writing direction.
- Export all lessons with embedded media to one JSON file and import it on this or another computer. Old version 1 text-only exports migrate on import.

Lessons are also saved in the browser's IndexedDB when available, with the earlier localStorage cache as a fallback. **Save the lesson, then export regularly**: storage for pages opened with `file://` can behave differently between browsers and may disappear if browser data is cleared. The app warns if browser storage fails. JSON import/export is the reliable transfer and backup route in this stage. The app never uploads lessons. The media flow still needs hands-on acceptance on the intended Windows browser; see [NEXT_JOB.md](NEXT_JOB.md).

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
  "media": { "image": "asset-id-or-null", "audio": { "pl": "recording-asset-id" } }
}
```

The version 2 collection has an `assets` object. Each asset contains a MIME type and a base64 data URL; the item stores its asset ID. No absolute Pictures-folder paths are required. Images are limited to a 12 MB source and roughly 1.65 MB after WebP conversion; audio files to 4 MB each. A compact export can still be much larger than a text-only lesson.

## Development

There are no runtime dependencies or build step. The local model checks can be run with `node --test tests/*.test.cjs` if Node.js is installed. Open `index.html` in the intended Windows browser to review the interface and media import/export.

## Next stage

Follow [NEXT_JOB.md](NEXT_JOB.md). The full 18-activity inventory and quality gates are in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md). Windows packaging is phase 2 and has intentionally not started.

# Words

An offline vocabulary lesson starter built with plain HTML, CSS, and JavaScript. It supports content and interface text in English, Polish, Arabic, and German. No account, server, package manager, or internet connection is required to use this first version.

## Run it

Download the repository as a ZIP, extract it, and open `index.html` in a current browser. Keep the `index.html`, `css`, and `js` files together. A development editor such as VS Code is optional.

## What works now

- Create, edit, duplicate, and delete named lessons.
- Add vocabulary entries with terms in any of the four languages. An entry needs at least two terms to be usable as a flashcard.
- Choose a front and back language, then practise with flashcards, multiple choice, matching pairs, or typed spelling. Games show when a lesson lacks enough distinct pairs.
- Hear short local feedback cues for answers and mute them at any time. Reduced-motion system preferences are respected.
- Change the interface language. Arabic uses a right-to-left layout; individual term fields retain their correct writing direction.
- Export all lessons to a JSON file and import that file on this or another computer.

Lessons are also cached in the browser's local storage when that browser permits it. **Export your lessons regularly**: storage for pages opened with `file://` can behave differently between browsers and may disappear if browser data is cleared. JSON import/export is the reliable transfer and backup route in this stage. The app never uploads lessons.

## Project structure

```text
index.html       Main screen and accessible controls
css/style.css    Responsive and RTL styling
js/model.js      Versioned lesson data, validation, and flashcard selection
js/i18n.js       English, Polish, Arabic, and German interface strings
js/games.js      Shared game eligibility, choices, matching rounds, spelling comparison
js/effects.js    Local feedback sound and reduced-motion-aware animation
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
  "media": { "image": null, "audio": null }
}
```

The media fields are reserved for the next stage. This starter is text only. We will design image/audio import and portable media storage before adding them, so lessons do not depend on fragile absolute paths to a Pictures folder.

## Development

There are no runtime dependencies or build step. If Node.js is installed, run `node --test tests/*.test.cjs` for the model checks. Open `index.html` to review the interface.

## Next stage

Follow [NEXT_JOB.md](NEXT_JOB.md). The full activity inventory and quality gates are in [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md). Windows packaging is phase 2 and has intentionally not started.

const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../js/model.js');

function lesson() {
  const result = model.createLesson('Animals');
  const cat = model.createItem();
  cat.terms = { en: 'cat', pl: 'kot', ar: 'قطة', de: 'Katze' };
  const dog = model.createItem();
  dog.terms = { en: 'dog', pl: 'pies', ar: '', de: 'Hund' };
  result.items = [cat, dog];
  return result;
}

test('a saved lesson survives a JSON export and import with all four scripts', () => {
  const original = model.saveLesson(model.newCollection(), lesson());
  const imported = model.validateCollection(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(imported, original);
  assert.equal(imported.lessons[0].items[0].terms.ar, 'قطة');
});

test('flashcards use the selected language pair and skip incomplete entries', () => {
  const saved = lesson();
  assert.equal(model.cardsFor(saved, 'en', 'ar').length, 1);
  assert.equal(model.cardsFor(saved, 'pl', 'de').length, 2);
  assert.deepEqual(model.cardsFor(saved, 'ar', 'ar'), []);
});

test('duplicating a lesson gives independent lesson and item identifiers', () => {
  const original = lesson();
  const copy = model.duplicateLesson(original);
  assert.notEqual(copy.id, original.id);
  assert.notEqual(copy.items[0].id, original.items[0].id);
  copy.items[0].terms.pl = 'inna nazwa';
  assert.equal(original.items[0].terms.pl, 'kot');
});

test('invalid imports are rejected before they replace existing lessons', () => {
  const valid = model.saveLesson(model.newCollection(), lesson());
  assert.throws(() => model.validateCollection({ ...valid, schemaVersion: 99 }), /invalidCollection/);
  assert.throws(() => model.validateCollection({ ...valid, lessons: [valid.lessons[0], valid.lessons[0]] }), /duplicateId/);
  const incomplete = structuredClone(valid);
  incomplete.lessons[0].items[0].terms = { en: 'cat', pl: '', ar: '', de: '' };
  assert.throws(() => model.validateCollection(incomplete), /twoLanguages/);
  assert.equal(valid.lessons[0].items[0].terms.pl, 'kot');
});

test('old text-only exports migrate to version 6 without losing terms', () => {
  const oldLesson = lesson();
  oldLesson.items.forEach(item => { item.media = { image: null, audio: null }; delete item.completionGaps; });
  const upgraded = model.validateCollection({ schemaVersion: 1, lessons: [oldLesson] });
  assert.equal(upgraded.schemaVersion, 6);
  assert.deepEqual(upgraded.lessons[0].categories, []);
  assert.equal(upgraded.lessons[0].items[0].categoryId, null);
  assert.deepEqual(upgraded.lessons[0].items[0].sentences.en, []);
  assert.deepEqual(upgraded.lessons[0].items[0].completionGaps, { en: null, pl: null, ar: null, de: null });
  assert.deepEqual(upgraded.assets, {});
  assert.equal(upgraded.lessons[0].items[0].terms.ar, 'قطة');
  assert.deepEqual(upgraded.lessons[0].items[0].media.audio, {});
  assert.deepEqual(upgraded.lessons[0].items[0].media.hotspots, []);
});

test('portable image and audio survive export, while missing references are rejected', () => {
  const value = lesson();
  value.items[0].media = { image: 'photo', audio: { pl: 'voice' } };
  const assets = {
    photo: { mime: 'image/webp', data: 'data:image/webp;base64,UklGRg==' },
    voice: { mime: 'audio/mpeg', data: 'data:audio/mpeg;base64,SUQz' },
    unused: { mime: 'audio/mpeg', data: 'data:audio/mpeg;base64,SUQz' }
  };
  const saved = model.saveLesson(model.newCollection(), value, assets);
  assert.deepEqual(Object.keys(saved.assets).sort(), ['photo', 'voice']);
  assert.deepEqual(model.validateCollection(JSON.parse(JSON.stringify(saved))), saved);
  assert.throws(() => model.validateCollection({ ...saved, assets: { photo: assets.photo } }), /missingMedia/);
});

test('replacing media near the collection limit prunes old files before checking quota', () => {
  const value = lesson();
  value.items = Array.from({ length: 6 }, (_, index) => {
    const item = model.createItem();
    item.terms = { en: `word ${index}`, pl: `słowo ${index}` };
    item.media.audio.en = `voice${index}`;
    return item;
  });
  const recording = { mime: 'audio/mpeg', data: `data:audio/mpeg;base64,${'A'.repeat(5_200_000)}` };
  const assets = Object.fromEntries(value.items.map((_, index) => [`voice${index}`, recording]));
  const original = model.saveLesson(model.newCollection(), value, assets);
  const changed = structuredClone(original.lessons[0]);
  changed.items[0].media.audio.en = 'replacement';
  const saved = model.saveLesson(original, changed, { replacement: recording });
  assert.equal(saved.assets.voice0, undefined);
  assert.equal(Object.keys(saved.assets).length, 6);
  assert.equal(saved.assets.replacement.data, recording.data);
  assert.ok(original.assets.voice0);
  changed.items[1].media.audio.pl = 'extra';
  assert.throws(() => model.saveLesson(saved, changed, { extra: recording }), /fileTooLarge/);
});

test('saved collections stay within the UTF-8 JSON import limit including lesson text', () => {
  const item = model.createItem();
  for (const language of model.LANGUAGES) {
    item.terms[language] = '字'.repeat(500);
    item.sentences[language] = Array(6).fill('字'.repeat(80));
  }
  const large = model.createLesson('Portable text');
  large.items = Array.from({ length: 500 }, (_, index) => ({ ...item, id: `word-${index}` }));
  const collection = model.newCollection();
  collection.lessons = Array.from({ length: 5 }, (_, index) => ({ ...large, id: `lesson-${index}` }));
  const saved = model.validateCollection(collection);
  assert.ok(Buffer.byteLength(JSON.stringify(saved)) <= model.MAX_FILE_BYTES);
  collection.lessons.push({ ...large, id: 'one-too-many' });
  assert.throws(() => model.validateCollection(collection), /fileTooLarge/);
});

test('picture markers survive save, export, older import, and duplicate with remapped item IDs', () => {
  const value = lesson();
  const bird = model.createItem(); bird.terms.en = 'bird'; bird.terms.pl = 'ptak';
  value.items.push(bird);
  value.items[0].media.image = 'scene';
  value.items[0].media.hotspots = [
    { itemId: value.items[1].id, x: .2, y: .3 },
    { itemId: bird.id, x: .8, y: .7 }
  ];
  const assets = { scene: { mime: 'image/webp', data: 'data:image/webp;base64,UklGRg==' } };
  const saved = model.saveLesson(model.newCollection(), value, assets);
  assert.equal(saved.schemaVersion, 6);
  assert.deepEqual(model.validateCollection(JSON.parse(JSON.stringify(saved))), saved);
  const copy = model.duplicateLesson(saved.lessons[0]);
  assert.deepEqual(copy.items[0].media.hotspots.map(point => point.itemId), [copy.items[1].id, copy.items[2].id]);
  assert.notEqual(copy.items[1].id, saved.lessons[0].items[1].id);
  const previous = structuredClone(saved);
  previous.schemaVersion = 2;
  previous.lessons[0].items.forEach(item => { delete item.media.hotspots; });
  const migrated = model.validateCollection(previous);
  assert.equal(migrated.schemaVersion, 6);
  assert.deepEqual(migrated.lessons[0].items[0].media.hotspots, []);
});

test('categories and membership survive save, export, prior version import, and duplicate', () => {
  const value = lesson();
  value.categories = [
    { id: 'animals', names: { en: 'Animals', pl: 'Zwierzęta', ar: 'حيوانات', de: 'Tiere' } },
    { id: 'other', names: { en: 'Other', pl: 'Inne', ar: 'غيرها', de: 'Andere' } }
  ];
  value.items[0].categoryId = 'animals'; value.items[1].categoryId = 'other';
  const saved = model.saveLesson(model.newCollection(), value);
  assert.deepEqual(model.validateCollection(JSON.parse(JSON.stringify(saved))), saved);
  const copy = model.duplicateLesson(saved.lessons[0]);
  assert.notEqual(copy.categories[0].id, 'animals');
  assert.equal(copy.items[0].categoryId, copy.categories[0].id);
  assert.equal(copy.items[1].categoryId, copy.categories[1].id);
  copy.categories[0].names.ar = 'مختلف';
  assert.equal(saved.lessons[0].categories[0].names.ar, 'حيوانات');
  const prior = structuredClone(saved); prior.schemaVersion = 3;
  delete prior.lessons[0].categories;
  prior.lessons[0].items.forEach(item => { delete item.categoryId; });
  const migrated = model.validateCollection(prior);
  assert.deepEqual(migrated.lessons[0].categories, []);
  assert.equal(migrated.lessons[0].items[0].categoryId, null);
});

test('categories reject missing names, ambiguous names, and broken memberships', () => {
  const value = lesson();
  value.categories = [{ id: 'a', names: { en: 'Nature' } }, { id: 'b', names: { en: 'nature' } }];
  assert.throws(() => model.validateLesson(value), /invalidCategories/);
  value.categories[1].names.en = 'Places';
  value.items[0].categoryId = 'missing';
  assert.throws(() => model.validateLesson(value), /invalidCategories/);
  value.items[0].categoryId = 'a';
  value.categories[1].names.en = '';
  assert.throws(() => model.validateLesson(value), /invalidCategories/);
});

test('sentence chunks survive save, export, duplicate, and version 4 migration', () => {
  const value = lesson();
  value.items[0].sentences.en = ['I', 'see', 'a cat.'];
  value.items[0].sentences.pl = ['Widzę', 'małego', 'kota.'];
  value.items[0].sentences.ar = ['أنا', 'أرى', 'قطة.'];
  value.items[0].sentences.de = ['Ich', 'sehe', 'eine Katze.'];
  const saved = model.saveLesson(model.newCollection(), value);
  assert.deepEqual(model.validateCollection(JSON.parse(JSON.stringify(saved))), saved);
  const copy = model.duplicateLesson(saved.lessons[0]);
  copy.items[0].sentences.ar[0] = 'نحن';
  assert.equal(saved.lessons[0].items[0].sentences.ar[0], 'أنا');
  const prior = structuredClone(saved); prior.schemaVersion = 4;
  prior.lessons[0].items.forEach(item => { delete item.sentences; });
  const migrated = model.validateCollection(prior);
  assert.deepEqual(migrated.lessons[0].items[0].sentences, { en: [], pl: [], ar: [], de: [] });
  assert.equal(migrated.lessons[0].items[0].categoryId, null);
});

test('sentence chunks reject incomplete, empty, overly long, and delimiter content', () => {
  const value = lesson();
  value.items[0].sentences.en = ['I', 'see'];
  assert.throws(() => model.validateLesson(value), /invalidSentences/);
  value.items[0].sentences.en = ['I', '', 'a cat.'];
  assert.throws(() => model.validateLesson(value), /invalidSentences/);
  value.items[0].sentences.en[1] = 'see|you';
  assert.throws(() => model.validateLesson(value), /invalidSentences/);
  value.items[0].sentences.en[1] = 'x'.repeat(81);
  assert.throws(() => model.validateLesson(value), /invalidSentences/);
  value.items[0].sentences.en[1] = 'see';
  assert.deepEqual(model.validateLesson(value).items[0].sentences.en, ['I', 'see', 'a cat.']);
});

test('completion gap and approved chunk survive export, duplicate, and version 5 migration', () => {
  const value = lesson();
  value.items[0].sentences.en = ['I', 'see', 'a cat.'];
  value.items[0].sentences.pl = ['Widzę', 'małego', 'kota.'];
  value.items[0].sentences.ar = ['أنا', 'أرى', 'قطة.'];
  value.items[0].completionGaps.pl = 2;
  value.items[0].completionGaps.ar = 1;
  const saved = model.saveLesson(model.newCollection(), value);
  const imported = model.validateCollection(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(imported, saved);
  assert.equal(imported.lessons[0].items[0].sentences.pl[imported.lessons[0].items[0].completionGaps.pl], 'kota.');
  const copy = model.duplicateLesson(saved.lessons[0]);
  copy.items[0].completionGaps.pl = 1;
  copy.items[0].sentences.pl[1] = 'dużego';
  assert.equal(saved.lessons[0].items[0].completionGaps.pl, 2);
  assert.equal(saved.lessons[0].items[0].sentences.pl[1], 'małego');
  const previous = structuredClone(saved); previous.schemaVersion = 5;
  previous.lessons[0].items.forEach(item => { delete item.completionGaps; });
  const migrated = model.validateCollection(previous);
  assert.deepEqual(migrated.lessons[0].items[0].completionGaps, { en: null, pl: null, ar: null, de: null });
  assert.deepEqual(migrated.lessons[0].items[0].sentences.pl, ['Widzę', 'małego', 'kota.']);
});

test('completion gap rejects missing sentence, invalid index, and punctuation-only answer', () => {
  const value = lesson();
  value.items[0].completionGaps.pl = 0;
  assert.throws(() => model.validateLesson(value), /invalidCompletions/);
  value.items[0].sentences.pl = ['Widzę', 'małego', 'kota.'];
  value.items[0].completionGaps.pl = 3;
  assert.throws(() => model.validateLesson(value), /invalidCompletions/);
  value.items[0].completionGaps.pl = '1';
  assert.throws(() => model.validateLesson(value), /invalidCompletions/);
  value.items[0].sentences.pl[1] = '...'; value.items[0].completionGaps.pl = 1;
  assert.throws(() => model.validateLesson(value), /invalidCompletions/);
  value.items[0].sentences.pl[1] = 'małego';
  assert.equal(model.validateLesson(value).items[0].completionGaps.pl, 1);
});

test('picture markers reject missing images, broken references, overlapping or invalid positions', () => {
  const value = lesson();
  value.items[0].media.hotspots = [{ itemId: value.items[1].id, x: .5, y: .5 }];
  assert.throws(() => model.validateLesson(value), /invalidHotspots/);
  value.items[0].media.image = 'scene';
  value.items[0].media.hotspots[0].itemId = 'deleted-item';
  assert.throws(() => model.validateLesson(value), /invalidHotspots/);
  value.items[0].media.hotspots[0].itemId = value.items[1].id;
  value.items[0].media.hotspots.push({ itemId: value.items[0].id, x: .51, y: .5 });
  assert.throws(() => model.validateLesson(value), /invalidHotspots/);
  value.items[0].media.hotspots[1].x = 1.1;
  assert.throws(() => model.validateLesson(value), /invalidHotspots/);
  value.items[0].media.hotspots[1].x = .8;
  assert.equal(model.validateLesson(value).items[0].media.hotspots.length, 2);
});

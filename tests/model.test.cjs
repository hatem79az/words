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

test('old text-only exports migrate to version 3 without losing terms', () => {
  const oldLesson = lesson();
  oldLesson.items.forEach(item => { item.media = { image: null, audio: null }; });
  const upgraded = model.validateCollection({ schemaVersion: 1, lessons: [oldLesson] });
  assert.equal(upgraded.schemaVersion, 3);
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
  assert.equal(saved.schemaVersion, 3);
  assert.deepEqual(model.validateCollection(JSON.parse(JSON.stringify(saved))), saved);
  const copy = model.duplicateLesson(saved.lessons[0]);
  assert.deepEqual(copy.items[0].media.hotspots.map(point => point.itemId), [copy.items[1].id, copy.items[2].id]);
  assert.notEqual(copy.items[1].id, saved.lessons[0].items[1].id);
  const previous = structuredClone(saved);
  previous.schemaVersion = 2;
  previous.lessons[0].items.forEach(item => { delete item.media.hotspots; });
  const migrated = model.validateCollection(previous);
  assert.equal(migrated.schemaVersion, 3);
  assert.deepEqual(migrated.lessons[0].items[0].media.hotspots, []);
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

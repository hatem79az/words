const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../js/model.js');
const games = require('../js/games.js');

function lesson(count = 9) {
  const value = model.createLesson('Words');
  value.items = Array.from({ length: count }, (_, index) => {
    const item = model.createItem();
    item.terms.en = `word ${index}`;
    item.terms.pl = `słowo ${index}`;
    item.terms.ar = `كلمة ${index}`;
    item.terms.de = `Wort ${index}`;
    return item;
  });
  return value;
}

test('four language pairs are selected without assuming Polish is the target', () => {
  const value = lesson(4);
  assert.equal(games.readiness(value, 'de', 'ar').quiz, 4);
  assert.equal(games.eligiblePairs(value, 'ar', 'en').length, 4);
});

test('ambiguous repeated prompts and answers are excluded from recognition games', () => {
  const value = lesson(6);
  value.items[1].terms.en = value.items[0].terms.en;
  value.items[3].terms.pl = value.items[2].terms.pl;
  assert.equal(games.eligiblePairs(value, 'en', 'pl').length, 2);
  assert.equal(games.readiness(value, 'en', 'pl').quiz, 0);
  assert.equal(games.readiness(value, 'en', 'pl').flashcards, 6);
});

test('quiz answers have four distinct options and one correct identifier', () => {
  const pool = games.eligiblePairs(lesson(6), 'en', 'pl');
  const choices = games.quizChoices(pool[0], pool, () => .27);
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices.map(choice => choice.terms.pl)).size, 4);
  assert.equal(choices.filter(choice => choice.id === pool[0].id).length, 1);
});

test('matching rounds cover all nine words without a one-card final round', () => {
  const items = games.eligiblePairs(lesson(9), 'en', 'pl');
  const rounds = games.matchingRounds(items, () => .5);
  assert.deepEqual(rounds.map(round => round.length), [5, 4]);
  assert.deepEqual(new Set(rounds.flat().map(item => item.id)), new Set(items.map(item => item.id)));
});

test('typed spelling normalizes case and whitespace but preserves diacritics', () => {
  assert.equal(games.sameAnswer('  KOT  ', 'kot', 'pl'), true);
  assert.equal(games.sameAnswer('słowo', 'slowo', 'pl'), false);
  assert.equal(games.sameAnswer('STRASSE', 'Straße', 'de'), false);
  assert.equal(games.sameAnswer(' قطة ', 'قطة', 'ar'), true);
});

test('picture and listening choices require four distinct media clues', () => {
  const value = lesson(5);
  const assets = {};
  for (let i = 0; i < 5; i += 1) {
    value.items[i].media.image = `image-${i}`;
    value.items[i].media.audio = { en: `voice-${i}` };
    assets[`image-${i}`] = { mime: 'image/webp', data: `data:image/webp;base64,${Buffer.from(`image${i}`).toString('base64')}` };
    assets[`voice-${i}`] = { mime: 'audio/mpeg', data: `data:audio/mpeg;base64,${Buffer.from(`voice${i}`).toString('base64')}` };
  }
  assert.equal(games.readiness(value, 'en', 'pl', assets).picture, 5);
  assert.equal(games.readiness(value, 'en', 'pl', assets).listening, 5);
  value.items[4].media.image = 'image-0';
  assert.equal(games.readiness(value, 'en', 'pl', assets).picture, 0);
  assert.equal(games.readiness(value, 'en', 'pl', assets).listening, 5);
  value.items[4].media.image = 'image-4';
  assets['image-4'].data = assets['image-0'].data;
  assert.equal(games.readiness(value, 'en', 'pl', assets).picture, 0);
});

test('spelling tiles keep combining marks and Arabic vowels with their letters', () => {
  assert.deepEqual(games.spellingClusters('a\u0328la', 'pl'), ['ą', 'l', 'a']);
  assert.deepEqual(games.spellingClusters('كِتاب', 'ar'), ['كِ', 'ت', 'ا', 'ب']);
  assert.deepEqual(games.spellingClusters('Straße', 'de'), ['S', 't', 'r', 'a', 'ß', 'e']);
  assert.deepEqual(games.spellingClusters('two words', 'en'), []);
  assert.equal(games.sameAnswer('a\u0328la', 'ąla', 'pl'), true);
  assert.equal(games.sameAnswer('ala', 'ąla', 'pl'), false);
});

test('tile order is playable and missing-letter answers follow word order', () => {
  const letters = games.spellingClusters('anna', 'pl');
  const tiles = games.tileOrder(letters, () => .9999);
  assert.notEqual(tiles.map(tile => tile.letter).join(''), letters.join(''));
  assert.deepEqual(tiles.map(tile => tile.id).sort(), [0, 1, 2, 3]);
  const arabic = games.spellingClusters('كِتاب', 'ar');
  const plan = games.missingPlan(arabic, () => 0);
  assert.equal([...plan.pattern].filter(char => char === '□').length, 1);
  assert.ok(arabic.includes(plan.answer));
});

test('new spelling modes use unique words and answer-language recordings', () => {
  const value = lesson(4);
  value.items[0].terms.pl = 'ąla';
  value.items[1].terms.pl = 'kot';
  value.items[2].terms.pl = 'kot';
  value.items[3].terms.pl = 'żółw';
  value.items[0].media.audio = { en: 'english', pl: 'polish' };
  value.items[3].media.audio = { en: 'other' };
  const assets = {
    english: { mime: 'audio/mpeg', data: 'en' },
    polish: { mime: 'audio/mpeg', data: 'pl' },
    other: { mime: 'audio/mpeg', data: 'other' }
  };
  assert.deepEqual(games.spellingPairs(value, 'en', 'pl', 'tiles').map(item => item.terms.pl), ['ąla', 'żółw']);
  assert.deepEqual(games.spellingPairs(value, 'en', 'pl', 'missing').map(item => item.terms.pl), ['żółw']);
  assert.deepEqual(games.listeningTypingPairs(value, assets, 'en', 'pl').map(item => item.terms.pl), ['ąla']);
  assert.equal(games.readiness(value, 'en', 'pl', assets).listenType, 1);
});

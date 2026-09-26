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

test('category sort uses saved groups with two unique pairs each in the answer language', () => {
  const value = lesson(7);
  value.categories = [
    { id: 'a', names: { en: 'Animals', pl: 'Zwierzęta', ar: 'حيوانات', de: 'Tiere' } },
    { id: 'b', names: { en: 'Places', pl: 'Miejsca', ar: 'أماكن', de: 'Orte' } },
    { id: 'c', names: { en: 'Food', pl: '', ar: '', de: '' } }
  ];
  value.items.forEach((item, index) => { item.categoryId = index < 3 ? 'a' : index < 6 ? 'b' : 'c'; });
  assert.equal(games.readiness(value, 'de', 'ar').categorySort, 4);
  const round = games.categorySortPlan(value, 'de', 'ar', () => .3);
  assert.deepEqual(new Set(round.groups.map(group => group.name)), new Set(['حيوانات', 'أماكن']));
  assert.equal(round.items.length, 4);
  assert.ok(round.items.every(item => round.groups.some(group => group.id === item.categoryId)));
  value.items[3].terms.ar = value.items[4].terms.ar;
  assert.equal(games.readiness(value, 'de', 'ar').categorySort, 0);
  assert.equal(games.categorySortPlan(value, 'ar', 'de'), null);
});

test('sentence order uses distinct authored examples and shuffles repeated chunks by identity', () => {
  const value = lesson(3);
  value.items[0].sentences.en = ['I', 'see', 'a cat.'];
  value.items[0].sentences.ar = ['أنا', 'أرى', 'قطة.'];
  value.items[1].sentences.en = ['I', 'see', 'a dog.'];
  value.items[1].sentences.ar = ['قطة', 'و', 'قطة', 'هنا.'];
  value.items[2].sentences.en = ['I', 'see', 'a cat.'];
  value.items[2].sentences.ar = ['أنا', 'أرى', 'كلبًا.'];
  assert.equal(games.readiness(value, 'en', 'ar').sentenceOrder, 1);
  const pairs = games.sentenceOrderPairs(value, 'en', 'ar');
  assert.deepEqual(pairs.map(item => item.id), [value.items[1].id]);
  const tiles = games.sentenceTileOrder(pairs[0].sentences.ar, 'ar', () => .999);
  assert.equal(tiles.length, 4);
  assert.equal(new Set(tiles.map(tile => tile.id)).size, 4);
  assert.notDeepEqual(tiles.map(tile => tile.text), pairs[0].sentences.ar);
  assert.equal(tiles.filter(tile => tile.text === 'قطة').length, 2);
  assert.equal(games.sameAnswer('قطة و قطة هنا.', 'قطة و قطة هنا.', 'ar'), true);
  assert.equal(games.sameAnswer('قطة و قطة هنا', 'قطة و قطة هنا.', 'ar'), false);
  assert.throws(() => games.sentenceTileOrder(['same', 'same', 'same'], 'en'), /invalidSentences/);
});

test('sentence completion uses selected answer chunks and skips duplicate visible questions', () => {
  const value = lesson(5);
  value.items[0].sentences.en = ['I', 'see', 'a cat.'];
  value.items[0].sentences.pl = ['Widzę', 'małego', 'kota.'];
  value.items[0].completionGaps.pl = 2;
  value.items[1].sentences.en = ['I', 'see', 'a dog.'];
  value.items[1].sentences.pl = ['Widzę', 'małego', 'psa.'];
  value.items[1].completionGaps.pl = 2;
  value.items[1].completionGaps.en = 1;
  value.items[2].sentences.en = ['I', 'see', 'a cat.'];
  value.items[2].sentences.pl = ['Widzę', 'małego', 'psa.'];
  value.items[2].completionGaps.pl = 2;
  value.items[3].sentences.en = ['Look', 'at', 'the cat.'];
  value.items[3].sentences.ar = ['أنا', 'أرى', 'قطة.'];
  value.items[3].completionGaps.ar = 2;
  assert.deepEqual(games.sentenceCompletionPairs(value, 'en', 'pl').map(item => item.id), [value.items[1].id]);
  assert.equal(games.readiness(value, 'en', 'pl').sentenceCompletion, 1);
  assert.deepEqual(games.sentenceCompletionPairs(value, 'pl', 'en').map(item => item.id), [value.items[1].id]);
  assert.deepEqual(games.sentenceCompletionPairs(value, 'en', 'ar').map(item => item.id), [value.items[3].id]);
  assert.deepEqual(games.completionParts(value.items[1], 'pl'), { answer: 'psa', suffix: '.' });
  assert.equal(games.completionMatches('psa', value.items[1], 'pl'), true);
  assert.equal(games.completionMatches('psa.', value.items[1], 'pl'), true);
  assert.equal(games.completionMatches('pśa', value.items[1], 'pl'), false);
  assert.deepEqual(games.completionParts(value.items[3], 'ar'), { answer: 'قطة', suffix: '.' });
  assert.equal(games.completionMatches('قطة', value.items[3], 'ar'), true);
  assert.equal(games.completionMatches('قطة،', value.items[3], 'ar'), false);
  assert.equal(games.sameAnswer('قطة', 'قطة.', 'ar'), false);
  assert.equal(games.sameAnswer('kota.', 'kota.', 'pl'), true);
  assert.equal(games.sameAnswer('kota.', 'kóta.', 'pl'), false);
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

test('memory deck has one hidden prompt and answer card per unambiguous pair', () => {
  const value = lesson(6);
  value.items[5].terms.pl = value.items[4].terms.pl;
  const items = games.eligiblePairs(value, 'en', 'pl');
  assert.equal(items.length, 4);
  assert.equal(games.readiness(value, 'en', 'pl').memory, 4);
  const round = games.createMemoryRound(items, 'en', 'pl', () => .27);
  assert.equal(round.cards.length, 8);
  for (const item of items) {
    assert.deepEqual(round.cards.filter(card => card.itemId === item.id).map(card => [card.side, card.language, card.term]).sort(),
      [['back', 'pl', item.terms.pl], ['front', 'en', item.terms.en]]);
  }
  assert.deepEqual(round.revealed, []);
  assert.equal(round.attempts, 0);
  assert.equal(games.readiness(lesson(3), 'en', 'ar').memory, 0);
  assert.throws(() => games.createMemoryRound(items.slice(0, 3), 'en', 'pl'), /needFour/);
});

test('memory turns lock a mismatch, preserve matches, and count complete pair attempts', () => {
  const items = games.eligiblePairs(lesson(4), 'pl', 'ar');
  const round = games.createMemoryRound(items, 'pl', 'ar', () => .31);
  const first = round.cards.findIndex(card => card.itemId === items[0].id && card.side === 'front');
  const other = round.cards.findIndex(card => card.itemId === items[1].id && card.side === 'back');
  const mate = round.cards.findIndex(card => card.itemId === items[0].id && card.side === 'back');
  assert.equal(games.memoryTurn(round, first), 'first');
  assert.equal(games.memoryTurn(round, first), 'ignored');
  assert.equal(games.memoryTurn(round, other), 'mismatch');
  assert.equal(games.memoryTurn(round, mate), 'ignored');
  assert.equal(round.attempts, 1);
  assert.deepEqual(round.revealed, [first, other]);
  assert.equal(games.memoryCover(round), true);
  assert.equal(games.memoryCover(round), false);
  assert.deepEqual(round.revealed, []);
  for (const item of items) {
    const front = round.cards.findIndex(card => card.itemId === item.id && card.side === 'front');
    const back = round.cards.findIndex(card => card.itemId === item.id && card.side === 'back');
    assert.equal(games.memoryTurn(round, front), 'first');
    assert.equal(games.memoryTurn(round, back), 'match');
    assert.equal(games.memoryTurn(round, front), 'ignored');
  }
  assert.equal(round.matched.size, 4);
  assert.equal(round.attempts, 5);
  assert.equal(round.pending, false);
});

test('true or false rounds balance proposals and use distinct answer terms', () => {
  const value = lesson(9);
  const items = games.eligiblePairs(value, 'de', 'ar');
  const rounds = games.trueFalseRounds(items, 'ar', () => .37);
  assert.equal(rounds.length, 8);
  assert.equal(rounds.filter(round => round.isTrue).length, 4);
  assert.equal(new Set(rounds.map(round => round.item.id)).size, 8);
  for (const round of rounds) {
    assert.equal(round.isTrue, round.item.id === round.proposedItem.id);
    if (!round.isTrue) assert.notEqual(round.item.terms.ar, round.proposedItem.terms.ar);
  }
  assert.equal(games.readiness(value, 'de', 'ar').trueFalse, 8);
  assert.equal(games.readiness(lesson(3), 'en', 'pl').trueFalse, 0);
  assert.throws(() => games.trueFalseRounds(items.slice(0, 3), 'ar'), /needFour/);
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

test('picture label scenes require an image and two distinct eligible saved terms', () => {
  const value = lesson(4);
  value.items[0].media.image = 'scene';
  value.items[0].media.hotspots = [
    { itemId: value.items[1].id, x: .2, y: .25 },
    { itemId: value.items[2].id, x: .7, y: .75 }
  ];
  const assets = { scene: { mime: 'image/webp', data: 'data:image/webp;base64,UklGRg==' } };
  const saved = model.saveLesson(model.newCollection(), value, assets).lessons[0];
  const scenes = games.pictureLabelScenes(saved, assets, 'ar', 'pl');
  assert.equal(scenes.length, 1);
  assert.deepEqual(scenes[0].hotspots.map(point => point.item.terms.pl), ['słowo 1', 'słowo 2']);
  assert.equal(games.readiness(saved, 'ar', 'pl', assets).pictureLabels, 1);
  value.items[2].terms.pl = value.items[1].terms.pl;
  assert.equal(games.pictureLabelScenes(value, assets, 'ar', 'pl').length, 0);
  assert.equal(games.pictureLabelScenes(saved, {}, 'ar', 'pl').length, 0);
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

test('letter guess keeps marked graphemes and offers each target letter', () => {
  const clusters = games.spellingClusters('كِتاب', 'ar');
  const options = games.guessOptions(clusters, 'ar', () => 0);
  assert.ok(options.includes('كِ'));
  assert.ok(options.includes('ت'));
  assert.equal(new Set(options).size, options.length);
  assert.ok(options.length <= 20);
  assert.equal(games.sameAnswer('ك', 'كِ', 'ar'), false);
});

test('word search always places solvable Polish words, including fallback layout', () => {
  const value = lesson(5);
  ['kot', 'pies', 'żółw', 'dom', 'łódź'].forEach((word, index) => { value.items[index].terms.pl = word; });
  const items = games.wordSearchPairs(value, 'en', 'pl');
  const generated = games.generateWordSearch(items, 'pl', () => 0);
  assert.equal(generated.placements.length, 5);
  for (const placement of generated.placements) {
    const word = items.find(item => item.id === placement.id).terms.pl;
    const path = games.gridPath(placement.cells[0], placement.cells.at(-1));
    assert.deepEqual(path, placement.cells);
    assert.equal(path.map(({ row, col }) => generated.grid[row][col]).join(''), games.answerKey(word, 'pl'));
  }
  assert.deepEqual(games.gridPath({ row: 0, col: 0 }, { row: 2, col: 2 }), []);
  assert.equal(games.readiness(value, 'en', 'pl').wordSearch, 5);
  assert.equal(games.readiness(value, 'en', 'ar').wordSearch, 0);
});

test('word search and letter guess skip long or ambiguous terms', () => {
  const value = lesson(4);
  value.items[0].terms.de = 'Straße';
  value.items[1].terms.de = 'überraschung';
  value.items[2].terms.de = 'Straße';
  value.items[3].terms.de = 'Bär';
  assert.deepEqual(games.spellingPairs(value, 'en', 'de', 'guess').map(item => item.terms.de), ['Bär']);
  assert.equal(games.wordSearchPairs(value, 'en', 'de').length, 1);
  assert.equal(games.readiness(value, 'en', 'de').wordSearch, 0);
});

test('crossword creates connected, numbered paths with matching Polish intersections', () => {
  const value = lesson(7);
  ['kot', 'takt', 'taka', 'kawa', 'woda', 'żółw', 'płot'].forEach((word, index) => { value.items[index].terms.pl = word; });
  const candidates = games.crosswordPairs(value, 'en', 'pl');
  const puzzle = games.generateCrossword(candidates, 'pl');
  assert.ok(puzzle && puzzle.entries.length >= 3);
  assert.equal(games.readiness(value, 'en', 'pl').crossword, puzzle.entries.length);
  const entryById = new Map(puzzle.entries.map(entry => [entry.id, entry]));
  const visited = new Set([puzzle.entries[0].id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of puzzle.grid) for (const cell of row) if (cell && cell.entryIds.some(id => visited.has(id))) {
      for (const id of cell.entryIds) if (!visited.has(id)) { visited.add(id); changed = true; }
    }
  }
  assert.equal(visited.size, puzzle.entries.length);
  const starts = new Map();
  for (const entry of puzzle.entries) {
    const item = candidates.find(candidate => candidate.id === entry.id);
    assert.equal(entry.cells.map(({ row, col }) => puzzle.grid[row][col].letter).join(''), games.answerKey(item.terms.pl, 'pl'));
    assert.ok(entry.cells.every(({ row, col }) => puzzle.grid[row][col].entryIds.includes(entry.id)));
    const key = `${entry.cells[0].row},${entry.cells[0].col}`;
    if (starts.has(key)) assert.equal(entry.number, starts.get(key));
    else starts.set(key, entry.number);
    assert.equal(puzzle.grid[entry.cells[0].row][entry.cells[0].col].number, entry.number);
    assert.equal(entryById.get(entry.id), entry);
  }
  const numbers = [...new Set(starts.values())].sort((a, b) => a - b);
  assert.deepEqual(numbers, numbers.map((_, index) => index + 1));
  assert.ok(puzzle.grid.flat().some(cell => cell?.entryIds.length === 2));
});

test('crossword respects marked letters and declines disconnected or Arabic answer sets', () => {
  const value = lesson(5);
  ['Bär', 'Rätsel', 'Straße', 'Türe', 'Rast'].forEach((word, index) => { value.items[index].terms.de = word; });
  const puzzle = games.generateCrossword(games.crosswordPairs(value, 'en', 'de'), 'de');
  assert.ok(puzzle && puzzle.entries.length >= 3);
  assert.ok(puzzle.entries.some(entry => entry.letters.includes('ä') || entry.letters.includes('ß')));
  assert.equal(games.sameAnswer('Bar', 'Bär', 'de'), false);
  assert.equal(games.readiness(value, 'en', 'ar').crossword, 0);
  assert.deepEqual(games.crosswordPairs(value, 'en', 'ar'), []);
  const unrelated = lesson(3);
  ['abc', 'def', 'ghi'].forEach((word, index) => { unrelated.items[index].terms.en = word; });
  assert.equal(games.generateCrossword(games.crosswordPairs(unrelated, 'pl', 'en'), 'en'), null);
  assert.equal(games.readiness(unrelated, 'pl', 'en').crossword, 0);
});

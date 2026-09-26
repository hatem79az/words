const test = require('node:test');
const assert = require('node:assert/strict');
const progress = require('../js/progress.js');
const model = require('../js/model.js');

function record(lessonId, mode = 'quiz', score = 3, total = 4) {
  return { lessonId, mode, front: 'en', back: 'pl', score, total, finishedAt: '2026-09-26T08:00:00.000Z' };
}

function store() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), values };
}

test('completed results stay outside the exported teacher collection', () => {
  const storage = store();
  const collection = model.newCollection();
  const history = progress.append([], record('lesson-1'));
  assert.equal(progress.save(history, storage), true);
  assert.deepEqual(progress.load(storage), history);
  assert.deepEqual(JSON.parse(JSON.stringify(collection)), model.newCollection());
  assert.equal(JSON.stringify(collection).includes('finishedAt'), false);
  assert.equal(storage.values.has(progress.KEY), true);
});

test('per-lesson summary separates flashcard reviews from scored answers', () => {
  let history = progress.append([], record('a', 'quiz', 3, 4));
  history = progress.append(history, record('b', 'typing', 1, 2));
  history = progress.append(history, record('a', 'flashcards', null, 8));
  history = progress.append(history, record('a', 'sentenceCompletion', 2, 3));
  assert.deepEqual(progress.summary(history, 'a'), { count: 3, reviews: 1, correct: 5, total: 7,
    recent: [history[3], history[2], history[0]] });
  assert.deepEqual(progress.clearLesson(history, 'a'), [history[1]]);
  assert.deepEqual(progress.prune(history, ['b']), [history[1]]);
});

test('history is bounded and rejects malformed records without blocking storage failure', () => {
  const valid = record('a');
  assert.throws(() => progress.append([], { ...valid, score: 5 }), /invalidProgress/);
  assert.throws(() => progress.append([], { ...valid, front: 'pl' }), /invalidProgress/);
  assert.throws(() => progress.append([], { ...valid, finishedAt: 'bad' }), /invalidProgress/);
  const history = Array.from({ length: progress.MAX_ENTRIES }, (_, index) => record(`lesson-${index}`));
  const bounded = progress.append(history, valid);
  assert.equal(bounded.length, progress.MAX_ENTRIES);
  assert.equal(bounded[0].lessonId, 'lesson-1');
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); } };
  assert.deepEqual(progress.load(broken), []);
  assert.equal(progress.save(bounded, broken), false);
  const malformed = store(); malformed.setItem(progress.KEY, '{broken');
  assert.deepEqual(progress.load(malformed), []);
});

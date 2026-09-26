(function (root, factory) {
  const games = factory(typeof module === 'object' && module.exports ? require('./model.js') : root.WordsModel);
  if (typeof module === 'object' && module.exports) module.exports = games;
  else root.WordsGames = games;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (model) {
  'use strict';

  function answerKey(text, language) {
    return text.normalize('NFC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase(language);
  }

  function sameAnswer(actual, expected, language) {
    return answerKey(actual, language) === answerKey(expected, language);
  }

  function eligiblePairs(lesson, front, back, requireUnique = true) {
    const items = model.cardsFor(lesson, front, back);
    if (!requireUnique) return items;
    const frontCounts = new Map();
    const backCounts = new Map();
    for (const item of items) {
      const a = answerKey(item.terms[front], front);
      const b = answerKey(item.terms[back], back);
      frontCounts.set(a, (frontCounts.get(a) || 0) + 1);
      backCounts.set(b, (backCounts.get(b) || 0) + 1);
    }
    return items.filter(item => frontCounts.get(answerKey(item.terms[front], front)) === 1 && backCounts.get(answerKey(item.terms[back], back)) === 1);
  }

  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function quizChoices(question, pool, random = Math.random) {
    const distractors = shuffle(pool.filter(item => item.id !== question.id), random).slice(0, 3);
    if (distractors.length < 3) throw new Error('needFour');
    return shuffle([question, ...distractors], random);
  }

  function mediaPairs(lesson, assets, front, back, mode) {
    const clueFor = item => assets[mode === 'picture' ? item.media.image : item.media.audio[front]]?.data;
    const pairs = eligiblePairs(lesson, front, back, true).filter(item => {
      return Boolean(clueFor(item));
    });
    const clues = new Map();
    for (const item of pairs) {
      const clue = clueFor(item);
      clues.set(clue, (clues.get(clue) || 0) + 1);
    }
    return pairs.filter(item => clues.get(clueFor(item)) === 1);
  }

  function pictureLabelScenes(lesson, assets, front, back) {
    const available = new Map(eligiblePairs(lesson, front, back, true).map(item => [item.id, item]));
    return lesson.items.flatMap(item => {
      if (!item.media?.image || !assets[item.media.image]?.data) return [];
      const hotspots = (item.media.hotspots || []).flatMap(point => {
        const target = available.get(point.itemId);
        return target ? [{ ...point, item: target }] : [];
      });
      return hotspots.length >= 2 ? [{ item, hotspots }] : [];
    });
  }

  function hasGraphemeSupport() {
    return typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';
  }

  function spellingClusters(text, language) {
    if (!hasGraphemeSupport()) return [];
    const word = text.normalize('NFC').trim();
    if (!/^[\p{L}\p{M}]+$/u.test(word)) return [];
    const clusters = Array.from(new Intl.Segmenter(language, { granularity: 'grapheme' }).segment(word), part => part.segment);
    if (clusters.length > 14 || clusters.some(cluster => !/^\p{L}\p{M}*$/u.test(cluster))) return [];
    return clusters;
  }

  function spellingPairs(lesson, front, back, mode) {
    return eligiblePairs(lesson, front, back, true).filter(item => {
      const clusters = spellingClusters(item.terms[back], back);
      const minimum = mode === 'missing' ? 4 : 3;
      const maximum = mode === 'wordSearch' ? 8 : mode === 'guess' ? 10 : 14;
      return clusters.length >= minimum && clusters.length <= maximum &&
        new Set(clusters.map(cluster => answerKey(cluster, back))).size >= 2;
    });
  }

  const ALPHABETS = Object.freeze({
    en: 'abcdefghijklmnopqrstuvwxyz',
    pl: 'aąbcćdeęfghijklłmnńoópqrsśtuvwxyzźż',
    de: 'abcdefghijklmnopqrstuvwxyzäöüß',
    ar: 'ابتثجحخدذرزسشصضطظعغفقكلمنهويءأإآؤئىة'
  });

  function guessOptions(clusters, language, random = Math.random) {
    const letters = [...new Map(clusters.map(letter => [answerKey(letter, language), answerKey(letter, language)])).values()];
    const known = new Set(letters);
    const distractors = shuffle(Array.from(ALPHABETS[language] || ALPHABETS.en).filter(letter => !known.has(letter)), random)
      .slice(0, Math.max(12, 20 - letters.length));
    return shuffle([...letters, ...distractors], random);
  }

  function wordSearchPairs(lesson, front, back) {
    if (back === 'ar') return [];
    return spellingPairs(lesson, front, back, 'wordSearch');
  }

  function crosswordPairs(lesson, front, back) {
    return wordSearchPairs(lesson, front, back).filter(item =>
      spellingClusters(item.terms[back], back).every(letter => /^\p{Script=Latin}\p{M}*$/u.test(letter)));
  }

  function generateCrossword(items, language) {
    if (language === 'ar' || !hasGraphemeSupport()) return null;
    const words = items.slice(0, 12).map(item => ({
      id: item.id,
      letters: spellingClusters(item.terms[language], language).map(letter => answerKey(letter, language))
    })).filter(word => word.letters.length >= 3 && word.letters.length <= 8 &&
      word.letters.every(letter => /^\p{Script=Latin}\p{M}*$/u.test(letter)));
    if (words.length < 3 || new Set(words.map(word => word.letters.join(''))).size !== words.length) return null;
    const size = 17;
    let best = null;

    function candidate(grid, letters, direction, row, col) {
      const dr = direction === 'down' ? 1 : 0;
      const dc = direction === 'across' ? 1 : 0;
      const endRow = row + dr * (letters.length - 1);
      const endCol = col + dc * (letters.length - 1);
      if (row < 0 || col < 0 || endRow >= size || endCol >= size) return null;
      const before = grid[row - dr]?.[col - dc];
      const after = grid[endRow + dr]?.[endCol + dc];
      if (before || after) return null;
      let crossings = 0;
      for (let index = 0; index < letters.length; index += 1) {
        const r = row + dr * index;
        const c = col + dc * index;
        const existing = grid[r][c];
        if (existing) {
          if (existing.letter !== letters[index] || existing[direction]) return null;
          crossings += 1;
        } else if (direction === 'across'
          ? grid[r - 1]?.[c] || grid[r + 1]?.[c]
          : grid[r]?.[c - 1] || grid[r]?.[c + 1]) return null;
      }
      return crossings ? { row, col, direction, crossings } : null;
    }

    function place(grid, word, position) {
      const cells = word.letters.map((letter, index) => {
        const row = position.row + (position.direction === 'down' ? index : 0);
        const col = position.col + (position.direction === 'across' ? index : 0);
        if (!grid[row][col]) grid[row][col] = { letter, across: false, down: false };
        grid[row][col][position.direction] = true;
        return { row, col };
      });
      return { id: word.id, direction: position.direction, cells, letters: word.letters };
    }

    for (let anchor = 0; anchor < words.length; anchor += 1) {
      const grid = Array.from({ length: size }, () => Array(size).fill(null));
      const first = words[anchor];
      const entries = [place(grid, first, { row: 8, col: 8 - Math.floor(first.letters.length / 2), direction: 'across' })];
      const pending = words.slice(anchor + 1).concat(words.slice(0, anchor));
      let added = true;
      while (added && entries.length < 5) {
        added = false;
        for (let index = 0; index < pending.length && entries.length < 5;) {
          const word = pending[index];
          let choice = null;
          for (let row = 0; row < size; row += 1) for (let col = 0; col < size; col += 1) {
            const cell = grid[row][col];
            if (!cell) continue;
            for (let letterIndex = 0; letterIndex < word.letters.length; letterIndex += 1) {
              if (word.letters[letterIndex] !== cell.letter) continue;
              for (const direction of ['across', 'down']) {
                const r = row - (direction === 'down' ? letterIndex : 0);
                const c = col - (direction === 'across' ? letterIndex : 0);
                const option = candidate(grid, word.letters, direction, r, c);
                if (option && (!choice || option.crossings > choice.crossings)) choice = option;
              }
            }
          }
          if (choice) {
            entries.push(place(grid, word, choice));
            pending.splice(index, 1);
            added = true;
          } else index += 1;
        }
      }
      if (!best || entries.length > best.entries.length) best = { grid, entries };
      if (best.entries.length === 5) break;
    }
    if (!best || best.entries.length < 3) return null;
    const occupied = best.entries.flatMap(entry => entry.cells);
    const minRow = Math.min(...occupied.map(cell => cell.row));
    const maxRow = Math.max(...occupied.map(cell => cell.row));
    const minCol = Math.min(...occupied.map(cell => cell.col));
    const maxCol = Math.max(...occupied.map(cell => cell.col));
    const grid = best.grid.slice(minRow, maxRow + 1).map(row => row.slice(minCol, maxCol + 1)
      .map(cell => cell && { letter: cell.letter, number: null, entryIds: [] }));
    const entries = best.entries.map(entry => ({ ...entry,
      cells: entry.cells.map(cell => ({ row: cell.row - minRow, col: cell.col - minCol }))
    }));
    const starts = [...new Set(entries.map(entry => `${entry.cells[0].row},${entry.cells[0].col}`))]
      .map(key => key.split(',').map(Number))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const numberAt = new Map(starts.map(([row, col], index) => [`${row},${col}`, index + 1]));
    for (const entry of entries) {
      const start = entry.cells[0];
      entry.number = numberAt.get(`${start.row},${start.col}`);
      grid[start.row][start.col].number = entry.number;
      for (const cell of entry.cells) grid[cell.row][cell.col].entryIds.push(entry.id);
    }
    return { grid, entries };
  }

  function gridPath(start, end) {
    if (!start || !end || (start.row !== end.row && start.col !== end.col)) return [];
    const length = Math.max(Math.abs(end.row - start.row), Math.abs(end.col - start.col)) + 1;
    if (length < 2) return [];
    const dr = Math.sign(end.row - start.row);
    const dc = Math.sign(end.col - start.col);
    return Array.from({ length }, (_, index) => ({ row: start.row + index * dr, col: start.col + index * dc }));
  }

  function generateWordSearch(items, language, random = Math.random) {
    if (!ALPHABETS[language] || language === 'ar' || items.length < 3) throw new Error('needWordSearch');
    const words = items.slice(0, 5).map(item => ({
      id: item.id,
      letters: spellingClusters(item.terms[language], language).map(letter => answerKey(letter, language))
    }));
    if (words.some(word => word.letters.length < 3 || word.letters.length > 8)) throw new Error('needWordSearch');
    let size = Math.max(8, ...words.map(word => word.letters.length + 2));
    let grid = Array.from({ length: size }, () => Array(size).fill(null));
    let placements = [];
    let failed = false;
    for (const word of words) {
      let placed = false;
      for (let attempt = 0; attempt < 250 && !placed; attempt += 1) {
        const vertical = random() < .5;
        const row = Math.floor(random() * (size - (vertical ? word.letters.length : 1) + 1));
        const col = Math.floor(random() * (size - (vertical ? 1 : word.letters.length) + 1));
        const cells = word.letters.map((_, index) => ({ row: row + (vertical ? index : 0), col: col + (vertical ? 0 : index) }));
        if (cells.some(({ row: r, col: c }, index) => grid[r][c] && grid[r][c] !== word.letters[index])) continue;
        cells.forEach(({ row: r, col: c }, index) => { grid[r][c] = word.letters[index]; });
        placements.push({ id: word.id, cells }); placed = true;
      }
      if (!placed) { failed = true; break; }
    }
    if (failed) {
      size = Math.max(10, size);
      grid = Array.from({ length: size }, () => Array(size).fill(null));
      placements = words.map((word, index) => {
        const row = index * 2;
        const cells = word.letters.map((letter, col) => { grid[row][col] = letter; return { row, col }; });
        return { id: word.id, cells };
      });
    }
    const fillers = Array.from(ALPHABETS[language]);
    for (const row of grid) for (let col = 0; col < row.length; col += 1) {
      if (!row[col]) row[col] = fillers[Math.floor(random() * fillers.length)];
    }
    return { grid, placements };
  }

  function listeningTypingPairs(lesson, assets, front, back) {
    return mediaPairs(lesson, assets, back, front, 'listening');
  }

  function tileOrder(clusters, random = Math.random) {
    const tiles = shuffle(clusters.map((letter, id) => ({ id, letter })), random);
    if (tiles.every((tile, index) => tile.letter === clusters[index])) {
      const swap = tiles.findIndex(tile => tile.letter !== tiles[0].letter);
      if (swap > 0) [tiles[0], tiles[swap]] = [tiles[swap], tiles[0]];
    }
    return tiles;
  }

  function missingPlan(clusters, random = Math.random) {
    const count = Math.min(2, Math.floor(clusters.length / 3));
    const positions = shuffle(clusters.map((_, index) => index), random).slice(0, count).sort((a, b) => a - b);
    const hidden = new Set(positions);
    return {
      pattern: clusters.map((letter, index) => hidden.has(index) ? '□' : letter).join(''),
      answer: positions.map(index => clusters[index]).join('')
    };
  }

  function matchingRounds(items, random = Math.random) {
    if (items.length < 4) throw new Error('needFour');
    const pool = shuffle(items, random);
    const rounds = [];
    for (let offset = 0; offset < pool.length;) {
      const remaining = pool.length - offset;
      let size = Math.min(8, remaining);
      if (remaining - size > 0 && remaining - size < 4) size -= 4 - (remaining - size);
      rounds.push(pool.slice(offset, offset + size));
      offset += size;
    }
    return rounds;
  }

  function createMemoryRound(items, front, back, random = Math.random) {
    if (items.length < 4) throw new Error('needFour');
    const cards = shuffle(items.flatMap(item => [
      { itemId: item.id, side: 'front', language: front, term: item.terms[front] },
      { itemId: item.id, side: 'back', language: back, term: item.terms[back] }
    ]), random);
    return { cards, revealed: [], matched: new Set(), attempts: 0, pending: false };
  }

  function memoryTurn(round, index) {
    const card = round.cards[index];
    if (!card || round.pending || round.matched.has(card.itemId) || round.revealed.includes(index)) return 'ignored';
    round.revealed.push(index);
    if (round.revealed.length === 1) return 'first';
    round.attempts += 1;
    const other = round.cards[round.revealed[0]];
    if (other.itemId === card.itemId && other.side !== card.side) {
      round.matched.add(card.itemId);
      round.revealed = [];
      return 'match';
    }
    round.pending = true;
    return 'mismatch';
  }

  function memoryCover(round) {
    if (!round.pending) return false;
    round.revealed = [];
    round.pending = false;
    return true;
  }

  function trueFalseRounds(items, language, random = Math.random) {
    if (items.length < 4) throw new Error('needFour');
    const pool = shuffle(items, random).slice(0, 10);
    if (pool.length % 2) pool.pop();
    const truths = shuffle(Array.from({ length: pool.length }, (_, index) => index < pool.length / 2), random);
    return pool.map((item, index) => {
      const proposedItem = truths[index] ? item : pool[(index + 1 + Math.floor(random() * (pool.length - 1))) % pool.length];
      if (!truths[index] && sameAnswer(proposedItem.terms[language], item.terms[language], language)) throw new Error('needFour');
      return { item, proposedItem, isTrue: truths[index] };
    });
  }

  function categorySortPlan(lesson, front, back, random = Math.random) {
    const pairs = eligiblePairs(lesson, front, back, true);
    const available = (lesson.categories || []).map(category => ({
      id: category.id, name: category.names[back],
      items: pairs.filter(item => item.categoryId === category.id)
    })).filter(group => group.name && group.items.length >= 2);
    if (available.length < 2) return null;
    const groups = shuffle(available, random).slice(0, 4).map(group => ({
      ...group, items: shuffle(group.items, random).slice(0, 2)
    }));
    return { groups, items: shuffle(groups.flatMap(group => group.items), random) };
  }

  function sentenceOrderPairs(lesson, front, back) {
    const pairs = model.cardsFor(lesson, front, back).filter(item => {
      const source = item.sentences[front];
      const target = item.sentences[back];
      return source.length >= 3 && target.length >= 3 &&
        new Set(target.map(chunk => answerKey(chunk, back))).size >= 2;
    });
    const sourceCounts = new Map();
    const targetCounts = new Map();
    for (const item of pairs) {
      const source = answerKey(item.sentences[front].join(' '), front);
      const target = answerKey(item.sentences[back].join(' '), back);
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
      targetCounts.set(target, (targetCounts.get(target) || 0) + 1);
    }
    return pairs.filter(item => sourceCounts.get(answerKey(item.sentences[front].join(' '), front)) === 1 &&
      targetCounts.get(answerKey(item.sentences[back].join(' '), back)) === 1);
  }

  function sentenceTileOrder(chunks, language, random = Math.random) {
    if (!Array.isArray(chunks) || chunks.length < 3 || chunks.length > 12 ||
        new Set(chunks.map(chunk => answerKey(chunk, language))).size < 2) throw new Error('invalidSentences');
    const tiles = chunks.map((text, id) => ({ id, text }));
    const shuffled = shuffle(tiles, random);
    if (shuffled.map(tile => tile.text).join('\u0000') === chunks.join('\u0000')) {
      const other = shuffled.findIndex(tile => tile.text !== shuffled[0].text);
      [shuffled[0], shuffled[other]] = [shuffled[other], shuffled[0]];
    }
    return shuffled;
  }

  function readiness(lesson, front, back, assets = {}) {
    const cards = eligiblePairs(lesson, front, back, false);
    const distinct = eligiblePairs(lesson, front, back, true);
    const pictures = mediaPairs(lesson, assets, front, back, 'picture').length;
    const pictureLabels = pictureLabelScenes(lesson, assets, front, back).length;
    const listening = mediaPairs(lesson, assets, front, back, 'listening').length;
    const tiles = spellingPairs(lesson, front, back, 'tiles').length;
    const missing = spellingPairs(lesson, front, back, 'missing').length;
    const listenType = listeningTypingPairs(lesson, assets, front, back).length;
    const guess = spellingPairs(lesson, front, back, 'guess').length;
    const wordSearchItems = wordSearchPairs(lesson, front, back).length;
    const crossword = generateCrossword(crosswordPairs(lesson, front, back), back);
    return {
      flashcards: cards.length,
      quiz: distinct.length >= 4 ? distinct.length : 0,
      matching: distinct.length >= 4 ? distinct.length : 0,
      memory: distinct.length >= 4 ? distinct.length : 0,
      trueFalse: distinct.length >= 4 ? Math.min(10, distinct.length - distinct.length % 2) : 0,
      typing: distinct.length,
      tiles,
      missing,
      listenType,
      guess,
      wordSearch: wordSearchItems >= 3 ? wordSearchItems : 0,
      crossword: crossword ? crossword.entries.length : 0,
      picture: pictures >= 4 ? pictures : 0,
      pictureLabels,
      categorySort: categorySortPlan(lesson, front, back)?.items.length || 0,
      sentenceOrder: Math.min(10, sentenceOrderPairs(lesson, front, back).length),
      listening: listening >= 4 ? listening : 0
    };
  }

  return { answerKey, sameAnswer, eligiblePairs, mediaPairs, pictureLabelScenes, categorySortPlan, sentenceOrderPairs, sentenceTileOrder,
    hasGraphemeSupport, spellingClusters,
    spellingPairs, listeningTypingPairs, tileOrder, missingPlan, guessOptions, wordSearchPairs,
    generateWordSearch, crosswordPairs, generateCrossword, gridPath, shuffle, quizChoices, matchingRounds,
    createMemoryRound, memoryTurn, memoryCover, trueFalseRounds, readiness };
});

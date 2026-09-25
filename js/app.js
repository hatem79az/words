(function () {
  'use strict';
  const model = window.WordsModel;
  const i18n = window.WordsI18n;
  const games = window.WordsGames;
  const effects = window.WordsEffects;
  const STORAGE_KEY = 'words.collection.v1';
  const UI_KEY = 'words.uiLanguage.v1';
  const byId = id => document.getElementById(id);
  let collection = model.newCollection();
  let currentId = null;
  let draft = null;
  let dirty = false;
  let deck = [];
  let cardIndex = 0;
  let challenge = null;
  let uiLanguage = 'en';

  function t(key, params = {}) {
    let value = (i18n.strings[uiLanguage] && i18n.strings[uiLanguage][key]) || i18n.strings.en[key] || key;
    for (const [name, replacement] of Object.entries(params)) value = value.replace(`{${name}}`, String(replacement));
    return value;
  }

  function message(key, params) {
    byId('status').textContent = t(key, params);
  }

  function translationPass() {
    document.documentElement.lang = uiLanguage;
    document.documentElement.dir = uiLanguage === 'ar' ? 'rtl' : 'ltr';
    for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
    for (const element of document.querySelectorAll('[data-i18n-placeholder]')) element.placeholder = t(element.dataset.i18nPlaceholder);
    byId('lesson-list').setAttribute('aria-label', t('lessons'));
    byId('ui-language').setAttribute('aria-label', t('interfaceLanguage'));
    if (draft) byId('editor-title').textContent = draft.title || t('newLesson');
    updateSoundButton();
    renderReadiness();
    renderList();
  }

  function saveCache() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(collection)); }
    catch (_) { message('storageFull'); }
  }

  function restoreCache() {
    try {
      const storedLocale = localStorage.getItem(UI_KEY);
      if (i18n.strings[storedLocale]) uiLanguage = storedLocale;
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) collection = model.validateCollection(JSON.parse(stored));
    } catch (_) {
      collection = model.newCollection();
      message('storageUnavailable');
    }
  }

  function confirmDiscard() {
    return !dirty || window.confirm(t('discardChanges'));
  }

  function renderList() {
    const list = byId('lesson-list');
    list.replaceChildren();
    byId('empty-library').hidden = collection.lessons.length > 0;
    for (const lesson of collection.lessons) {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `lesson-link${lesson.id === currentId ? ' active' : ''}`;
      button.textContent = lesson.title;
      button.setAttribute('aria-current', lesson.id === currentId ? 'page' : 'false');
      button.addEventListener('click', () => {
        if (lesson.id !== currentId && confirmDiscard()) openLesson(lesson.id);
      });
      li.append(button); list.append(li);
    }
  }

  function makeItemRow(item) {
    const row = document.createElement('fieldset');
    row.className = 'item-row';
    row.dataset.id = item.id;
    const grid = document.createElement('div');
    grid.className = 'term-grid';
    for (const language of model.LANGUAGES) {
      const label = document.createElement('label');
      const span = document.createElement('span');
      span.dataset.i18n = i18n.languageNames[language];
      span.textContent = t(span.dataset.i18n);
      const input = document.createElement('input');
      input.type = 'text'; input.maxLength = 500; input.value = item.terms[language] || '';
      input.dataset.language = language; input.lang = language; input.dir = language === 'ar' ? 'rtl' : 'ltr';
      input.autocomplete = 'off';
      label.append(span, input); grid.append(label);
    }
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'button button-quiet danger remove-item';
    remove.dataset.i18n = 'remove'; remove.textContent = t('remove');
    remove.addEventListener('click', () => { row.remove(); dirty = true; });
    row.append(grid, remove);
    return row;
  }

  function openLesson(id) {
    const saved = collection.lessons.find(lesson => lesson.id === id);
    if (!saved) return;
    draft = structuredClone(saved);
    currentId = id;
    dirty = false;
    byId('welcome').hidden = true;
    byId('editor').hidden = false;
    byId('practice').hidden = false;
    byId('duplicate-lesson').hidden = false;
    byId('delete-lesson').hidden = false;
    byId('lesson-name').value = draft.title;
    byId('editor-title').textContent = draft.title;
    byId('item-list').replaceChildren(...draft.items.map(makeItemRow));
    resetDeck(); renderList(); renderReadiness();
  }

  function newLesson() {
    if (!confirmDiscard()) return;
    draft = model.createLesson();
    currentId = null;
    dirty = false;
    byId('welcome').hidden = true;
    byId('editor').hidden = false;
    byId('practice').hidden = true;
    byId('duplicate-lesson').hidden = true;
    byId('delete-lesson').hidden = true;
    byId('lesson-name').value = '';
    byId('editor-title').textContent = t('newLesson');
    byId('item-list').replaceChildren(makeItemRow(model.createItem()));
    renderList(); byId('lesson-name').focus();
  }

  function collectDraft() {
    const now = new Date().toISOString();
    const items = [...byId('item-list').children].map(row => {
      const terms = {};
      for (const input of row.querySelectorAll('[data-language]')) terms[input.dataset.language] = input.value;
      return { id: row.dataset.id, terms, media: { image: null, audio: null } };
    }).filter(item => Object.values(item.terms).some(term => term.trim()));
    return { ...draft, title: byId('lesson-name').value, updatedAt: now, items };
  }

  function save(event) {
    event.preventDefault();
    try {
      const updated = collectDraft();
      collection = model.saveLesson(collection, updated);
      draft = model.validateLesson(updated);
      currentId = draft.id;
      dirty = false;
      byId('editor-title').textContent = draft.title;
      byId('duplicate-lesson').hidden = false;
      byId('delete-lesson').hidden = false;
      byId('practice').hidden = false;
      resetDeck(); renderList(); renderReadiness(); saveCache(); message('saved');
    } catch (error) { message(error.message in i18n.strings.en ? error.message : 'invalidLesson'); }
  }

  function duplicate() {
    if (!confirmDiscard()) return;
    const original = collection.lessons.find(lesson => lesson.id === currentId);
    if (!original) return;
    const copy = model.duplicateLesson(original);
    copy.title = `${copy.title} (${t('duplicateSuffix')})`;
    collection = model.saveLesson(collection, copy);
    saveCache(); openLesson(copy.id); message('duplicated');
  }

  function removeLesson() {
    if (!currentId || !window.confirm(t('confirmDelete'))) return;
    collection.lessons = collection.lessons.filter(lesson => lesson.id !== currentId);
    saveCache(); draft = null; currentId = null; dirty = false; deck = [];
    byId('editor').hidden = true; byId('practice').hidden = true; byId('welcome').hidden = false;
    renderList(); message('deleted');
  }

  function exportLibrary() {
    if (!collection.lessons.length) { message('noLessons'); return; }
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `words-lessons-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    message('exported');
  }

  async function importLibrary(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { message('fileTooLarge'); return; }
    let imported;
    try { imported = model.validateCollection(JSON.parse(await file.text())); }
    catch (error) { message(error.message in i18n.strings.en ? error.message : 'invalidFile'); return; }
    if (!window.confirm(t('confirmImport'))) return;
    collection = imported; draft = null; currentId = null; dirty = false;
    saveCache(); renderList();
    if (collection.lessons.length) openLesson(collection.lessons[0].id);
    else { byId('editor').hidden = true; byId('practice').hidden = true; byId('welcome').hidden = false; }
    message('imported');
  }

  function fillLanguages() {
    for (const select of [byId('front-language'), byId('back-language')]) {
      for (const language of model.LANGUAGES) {
        const option = document.createElement('option');
        option.value = language; option.textContent = language.toUpperCase();
        select.append(option);
      }
    }
    byId('front-language').value = 'en'; byId('back-language').value = 'pl';
  }

  function resetDeck() {
    deck = []; cardIndex = 0; byId('card-area').hidden = true;
    challenge = null; byId('challenge-area').hidden = true;
    byId('practice-message').textContent = '';
  }

  function startDeck() {
    const front = byId('front-language').value;
    const back = byId('back-language').value;
    resetDeck();
    if (front === back) { byId('practice-message').textContent = t('chooseTwo'); return; }
    const saved = collection.lessons.find(lesson => lesson.id === currentId);
    if (!saved) return;
    const mode = byId('game-mode').value;
    if (mode !== 'flashcards') { startChallenge(saved, mode, front, back); return; }
    deck = model.cardsFor(saved, front, back);
    cardIndex = 0;
    byId('practice-message').textContent = deck.length ? '' : t('noCards');
    byId('card-area').hidden = !deck.length;
    if (deck.length) showCard();
  }

  function resetCardOnly() { deck = []; byId('card-area').hidden = true; }

  function showCard() {
    if (!deck.length) return;
    const front = byId('front-language').value;
    const back = byId('back-language').value;
    const item = deck[cardIndex];
    byId('card-progress').textContent = t('cardCount', { current: cardIndex + 1, total: deck.length });
    byId('card-prompt').textContent = item.terms[front];
    byId('card-prompt').lang = front; byId('card-prompt').dir = front === 'ar' ? 'rtl' : 'ltr';
    byId('card-answer').textContent = item.terms[back];
    byId('card-answer').lang = back; byId('card-answer').dir = back === 'ar' ? 'rtl' : 'ltr';
    byId('card-answer').hidden = true;
    byId('reveal-card').disabled = false;
    effects.animate(byId('flashcard'), 'card');
  }

  function nextCard() {
    if (!deck.length) return;
    if (cardIndex === deck.length - 1) {
      resetCardOnly(); byId('practice-message').textContent = t('endOfDeck');
    } else { cardIndex += 1; showCard(); }
  }

  function updateSoundButton() {
    const button = byId('sound-toggle');
    button.setAttribute('aria-pressed', String(effects.isMuted()));
    button.textContent = t(effects.isMuted() ? 'soundOff' : 'soundOn');
  }

  function renderReadiness() {
    const saved = collection.lessons.find(lesson => lesson.id === currentId);
    if (!saved) { byId('activity-readiness').textContent = ''; return; }
    const front = byId('front-language').value;
    const back = byId('back-language').value;
    if (front === back) { byId('activity-readiness').textContent = t('chooseTwo'); return; }
    const counts = games.readiness(saved, front, back);
    const mode = byId('game-mode').value;
    byId('activity-readiness').textContent = counts[mode]
      ? t('readyItems', { count: counts[mode] })
      : t(mode === 'quiz' || mode === 'matching' ? 'needFour' : 'noCards');
  }

  function setTerm(element, text, language) {
    element.textContent = text;
    element.lang = language;
    element.dir = language === 'ar' ? 'rtl' : 'ltr';
  }

  function startChallenge(lesson, mode, front, back) {
    const items = games.eligiblePairs(lesson, front, back, true);
    if ((mode === 'quiz' || mode === 'matching') && items.length < 4) {
      byId('practice-message').textContent = t('needFour'); return;
    }
    if (!items.length) { byId('practice-message').textContent = t('noCards'); return; }
    challenge = { mode, front, back, items: games.shuffle(items), index: 0, score: 0, locked: false,
      rounds: mode === 'matching' ? games.matchingRounds(items) : [], roundIndex: 0,
      matched: new Set(), selectedFront: null, selectedBack: null, attempts: 0 };
    byId('challenge-area').hidden = false;
    renderChallenge();
  }

  function optionButton(item, language, side = '') {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'game-option';
    button.dataset.itemId = item.id; button.dataset.side = side;
    setTerm(button, item.terms[language], language);
    return button;
  }

  function renderChallenge() {
    if (!challenge) return;
    const state = challenge;
    state.locked = false;
    const options = byId('challenge-options');
    options.replaceChildren(); options.className = 'challenge-options';
    byId('challenge-feedback').textContent = '';
    byId('challenge-feedback').className = 'challenge-feedback';
    byId('challenge-next').hidden = true;
    byId('typing-form').hidden = state.mode !== 'typing';
    byId('challenge-score').textContent = t('score', { score: state.score });
    if (state.mode === 'matching') { renderMatching(); return; }
    byId('challenge-progress').textContent = t('cardCount', { current: state.index + 1, total: state.items.length });
    const item = state.items[state.index];
    setTerm(byId('challenge-prompt'), item.terms[state.front], state.front);
    if (state.mode === 'quiz') {
      options.classList.add('quiz-options');
      for (const choice of games.quizChoices(item, state.items)) {
        const button = optionButton(choice, state.back);
        button.addEventListener('click', () => answerQuiz(button, item));
        options.append(button);
      }
    } else {
      const input = byId('typing-answer');
      input.value = ''; input.disabled = false; input.lang = state.back;
      input.dir = state.back === 'ar' ? 'rtl' : 'ltr';
      input.focus();
    }
  }

  function answerQuiz(button, item) {
    const state = challenge;
    if (!state || state.locked) return;
    state.locked = true;
    const correct = button.dataset.itemId === item.id;
    if (correct) state.score += 1;
    for (const option of byId('challenge-options').querySelectorAll('button')) {
      option.disabled = true;
      if (option.dataset.itemId === item.id) option.classList.add('correct');
      else if (option === button) option.classList.add('wrong');
    }
    feedback(correct, button, item.terms[state.back]);
    prepareNext();
  }

  function answerTyping(event) {
    event.preventDefault();
    const state = challenge;
    if (!state || state.mode !== 'typing' || state.locked) return;
    const input = byId('typing-answer');
    if (!input.value.trim()) { byId('challenge-feedback').textContent = t('enterAnswer'); return; }
    state.locked = true;
    const expected = state.items[state.index].terms[state.back];
    const correct = games.sameAnswer(input.value, expected, state.back);
    if (correct) state.score += 1;
    input.disabled = true;
    feedback(correct, input, expected);
    prepareNext();
  }

  function feedback(correct, element, expected) {
    const output = byId('challenge-feedback');
    output.className = `challenge-feedback ${correct ? 'positive' : 'negative'}`;
    output.textContent = correct ? t('correct') : t('correctAnswer', { answer: expected });
    effects.animate(element, correct ? 'correct' : 'wrong');
    effects.play(correct ? 'correct' : 'wrong');
    byId('challenge-score').textContent = t('score', { score: challenge.score });
  }

  function prepareNext() {
    byId('challenge-next').hidden = false;
    byId('challenge-next').textContent = t(challenge.index === challenge.items.length - 1 ? 'seeResults' : 'next');
    byId('challenge-next').focus();
  }

  function renderMatching() {
    const state = challenge;
    const round = state.rounds[state.roundIndex];
    state.matched = new Set(); state.selectedFront = null; state.selectedBack = null;
    byId('challenge-progress').textContent = t('roundCount', { current: state.roundIndex + 1, total: state.rounds.length });
    byId('challenge-score').textContent = t('matchedCount', { count: state.score, total: state.items.length });
    byId('challenge-prompt').textContent = t('matchInstruction');
    byId('challenge-prompt').removeAttribute('lang'); byId('challenge-prompt').removeAttribute('dir');
    byId('challenge-options').classList.add('matching-options');
    for (const [side, language] of [['front', state.front], ['back', state.back]]) {
      const column = document.createElement('div'); column.className = 'match-column';
      const heading = document.createElement('h3'); heading.textContent = t(side === 'front' ? 'frontLanguage' : 'backLanguage');
      column.append(heading);
      for (const item of games.shuffle(round)) {
        const button = optionButton(item, language, side);
        button.addEventListener('click', () => chooseMatch(button));
        column.append(button);
      }
      byId('challenge-options').append(column);
    }
  }

  function chooseMatch(button) {
    const state = challenge;
    if (!state || state.locked || state.matched.has(button.dataset.itemId)) return;
    const side = button.dataset.side;
    const previous = side === 'front' ? state.selectedFront : state.selectedBack;
    if (previous) previous.classList.remove('selected');
    button.classList.add('selected');
    if (side === 'front') state.selectedFront = button;
    else state.selectedBack = button;
    if (!state.selectedFront || !state.selectedBack) return;
    state.attempts += 1;
    const first = state.selectedFront;
    const second = state.selectedBack;
    const correct = first.dataset.itemId === second.dataset.itemId;
    state.locked = true;
    const output = byId('challenge-feedback');
    output.className = `challenge-feedback ${correct ? 'positive' : 'negative'}`;
    output.textContent = t(correct ? 'correct' : 'tryAnother');
    effects.play(correct ? 'correct' : 'wrong');
    effects.animate(second, correct ? 'correct' : 'wrong');
    if (correct) {
      state.score += 1; state.matched.add(first.dataset.itemId);
      first.classList.add('matched'); second.classList.add('matched');
      first.disabled = true; second.disabled = true;
      byId('challenge-score').textContent = t('matchedCount', { count: state.score, total: state.items.length });
    }
    first.classList.remove('selected'); second.classList.remove('selected');
    state.selectedFront = null; state.selectedBack = null; state.locked = false;
    if (state.matched.size === state.rounds[state.roundIndex].length) {
      byId('challenge-next').hidden = false;
      byId('challenge-next').textContent = t(state.roundIndex === state.rounds.length - 1 ? 'seeResults' : 'nextRound');
      byId('challenge-next').focus();
    }
  }

  function nextChallenge() {
    const state = challenge;
    if (!state) return;
    if (state.mode === 'matching') {
      if (state.roundIndex === state.rounds.length - 1) { finishChallenge(); return; }
      state.roundIndex += 1;
    } else {
      if (state.index === state.items.length - 1) { finishChallenge(); return; }
      state.index += 1;
    }
    renderChallenge();
  }

  function finishChallenge() {
    const state = challenge;
    byId('challenge-options').replaceChildren();
    byId('typing-form').hidden = true;
    byId('challenge-next').hidden = true;
    byId('challenge-progress').textContent = '';
    byId('challenge-prompt').textContent = t('roundComplete');
    byId('challenge-prompt').removeAttribute('lang'); byId('challenge-prompt').removeAttribute('dir');
    byId('challenge-feedback').className = 'challenge-feedback positive';
    byId('challenge-feedback').textContent = state.mode === 'matching'
      ? t('matchResults', { attempts: state.attempts })
      : t('finalScore', { score: state.score, total: state.items.length });
    byId('challenge-score').textContent = '';
    effects.animate(byId('challenge-prompt'), 'correct');
    effects.play('complete');
    challenge = null;
  }

  function initialize() {
    restoreCache();
    byId('ui-language').value = uiLanguage;
    fillLanguages(); translationPass();
    if (collection.lessons.length) openLesson(collection.lessons[0].id);
    byId('ui-language').addEventListener('change', event => {
      uiLanguage = event.target.value; translationPass();
      try { localStorage.setItem(UI_KEY, uiLanguage); } catch (_) { /* export remains available */ }
    });
    byId('new-lesson').addEventListener('click', newLesson);
    byId('welcome-new').addEventListener('click', newLesson);
    byId('add-item').addEventListener('click', () => {
      if (byId('item-list').children.length >= 500) { message('tooManyItems'); return; }
      byId('item-list').append(makeItemRow(model.createItem())); dirty = true;
    });
    byId('lesson-form').addEventListener('input', () => { dirty = true; });
    byId('lesson-form').addEventListener('submit', save);
    byId('duplicate-lesson').addEventListener('click', duplicate);
    byId('delete-lesson').addEventListener('click', removeLesson);
    byId('export-library').addEventListener('click', exportLibrary);
    byId('import-file').addEventListener('change', importLibrary);
    byId('start-cards').addEventListener('click', startDeck);
    for (const id of ['front-language', 'back-language', 'game-mode']) {
      byId(id).addEventListener('change', () => { resetDeck(); renderReadiness(); });
    }
    byId('sound-toggle').addEventListener('click', () => {
      effects.setMuted(!effects.isMuted()); updateSoundButton();
    });
    byId('typing-form').addEventListener('submit', answerTyping);
    byId('challenge-next').addEventListener('click', nextChallenge);
    byId('reveal-card').addEventListener('click', () => { byId('card-answer').hidden = false; byId('reveal-card').disabled = true; effects.animate(byId('card-answer'), 'card'); byId('next-card').focus(); });
    byId('next-card').addEventListener('click', nextCard);
    byId('flashcard').addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); byId('card-answer').hidden = false; byId('reveal-card').disabled = true; effects.animate(byId('card-answer'), 'card'); byId('next-card').focus(); }
    });
    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  }
  initialize();
})();

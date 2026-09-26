(function () {
  'use strict';
  const model = window.WordsModel;
  const i18n = window.WordsI18n;
  const games = window.WordsGames;
  const effects = window.WordsEffects;
  const media = window.WordsMedia;
  const storage = window.WordsStorage;
  const UI_KEY = 'words.uiLanguage.v1';
  const byId = id => document.getElementById(id);
  let collection = model.newCollection();
  let currentId = null;
  let draft = null;
  let dirty = false;
  let deck = [];
  let cardIndex = 0;
  let challenge = null;
  let draftAssets = {};
  let mediaPending = 0;
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
    for (const row of byId('item-list').children) refreshMediaRow(row);
    renderReadiness();
    renderList();
  }

  function saveCache() { return storage.save(collection); }

  async function restoreCache() {
    try {
      const storedLocale = localStorage.getItem(UI_KEY);
      if (i18n.strings[storedLocale]) uiLanguage = storedLocale;
    } catch (_) { /* interface preference is optional */ }
    try {
      const stored = await storage.load();
      if (stored) collection = model.validateCollection(stored);
    } catch (_) {
      collection = model.newCollection();
      message('storageUnavailable');
    }
  }

  function confirmDiscard() {
    return (!dirty && !mediaPending) || window.confirm(t('discardChanges'));
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
    row._media = { image: item.media?.image || null, audio: { ...(item.media?.audio || {}) },
      hotspots: (item.media?.hotspots || []).map(point => ({ ...point })) };
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
    remove.addEventListener('click', () => {
      row.remove(); dirty = true;
      for (const other of byId('item-list').children) {
        const remaining = other._media.hotspots.filter(point => point.itemId !== item.id);
        if (remaining.length !== other._media.hotspots.length) {
          other._media.hotspots = remaining; renderHotspotEditor(other);
        }
      }
    });
    const attachments = document.createElement('details');
    attachments.className = 'media-editor';
    const summary = document.createElement('summary'); summary.dataset.i18n = 'mediaAttachments'; summary.textContent = t('mediaAttachments');
    const content = document.createElement('div'); content.className = 'media-editor-grid';
    const picture = document.createElement('div'); picture.className = 'media-slot';
    const imageLabel = document.createElement('label'); imageLabel.dataset.i18n = 'addPicture'; imageLabel.textContent = t('addPicture');
    const imageInput = document.createElement('input'); imageInput.type = 'file'; imageInput.accept = '.webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg';
    imageInput.id = `image-${item.id}`; imageLabel.htmlFor = imageInput.id;
    imageInput.setAttribute('aria-label', t('addPicture'));
    imageInput.addEventListener('change', async () => {
      const file = imageInput.files[0]; imageInput.value = '';
      if (!file) return;
      mediaPending += 1;
      try {
        const asset = await media.importImage(file);
        if (!row.isConnected) return;
        const assetId = model.newAssetId();
        draftAssets[assetId] = asset; row._media.image = assetId; row._media.hotspots = [];
        dirty = true; refreshMediaRow(row);
        message('imageAdded');
      } catch (error) { message(error.message in i18n.strings.en ? error.message : 'mediaReadFailed'); }
      finally { mediaPending -= 1; }
    });
    const imagePreview = document.createElement('div'); imagePreview.className = 'image-preview'; imagePreview.dataset.imagePreview = '';
    const hotspotEditor = document.createElement('details'); hotspotEditor.className = 'hotspot-editor';
    hotspotEditor.dataset.hotspotEditor = '';
    const hotspotSummary = document.createElement('summary'); hotspotSummary.dataset.i18n = 'pictureMarkers';
    hotspotSummary.textContent = t('pictureMarkers');
    const hotspotContent = document.createElement('div'); hotspotContent.dataset.hotspotContent = '';
    hotspotEditor.append(hotspotSummary, hotspotContent);
    picture.append(imageLabel, imageInput, imagePreview, hotspotEditor);
    const audioSlot = document.createElement('div'); audioSlot.className = 'media-slot';
    const audioLabel = document.createElement('label'); audioLabel.dataset.i18n = 'addPronunciation'; audioLabel.textContent = t('addPronunciation');
    const audioSelect = document.createElement('select'); audioSelect.dataset.audioLanguage = '';
    audioSelect.setAttribute('aria-label', t('audioLanguage'));
    for (const language of model.LANGUAGES) {
      const option = document.createElement('option'); option.value = language; option.textContent = t(i18n.languageNames[language]); audioSelect.append(option);
    }
    const audioInput = document.createElement('input'); audioInput.type = 'file'; audioInput.accept = '.mp3,.wav,.ogg,.webm,.m4a,audio/*';
    audioInput.id = `audio-${item.id}`; audioLabel.htmlFor = audioInput.id;
    audioInput.setAttribute('aria-label', t('addPronunciation'));
    audioInput.addEventListener('change', async () => {
      const file = audioInput.files[0]; audioInput.value = '';
      if (!file) return;
      const language = audioSelect.value;
      mediaPending += 1;
      try {
        const asset = await media.importAudio(file);
        if (!row.isConnected) return;
        const assetId = model.newAssetId();
        draftAssets[assetId] = asset; row._media.audio[language] = assetId; dirty = true; refreshMediaRow(row);
        message('audioAdded');
      } catch (error) { message(error.message in i18n.strings.en ? error.message : 'mediaReadFailed'); }
      finally { mediaPending -= 1; }
    });
    const audioList = document.createElement('div'); audioList.className = 'audio-list'; audioList.dataset.audioList = '';
    audioSlot.append(audioLabel, audioSelect, audioInput, audioList);
    content.append(picture, audioSlot); attachments.append(summary, content);
    row.append(grid, attachments, remove);
    refreshMediaRow(row);
    return row;
  }

  function assetFor(assetId) { return draftAssets[assetId] || collection.assets[assetId]; }

  function refreshMediaRow(row) {
    const preview = row.querySelector('[data-image-preview]');
    if (!preview) return;
    preview.replaceChildren();
    const image = assetFor(row._media.image);
    if (image) {
      const thumbnail = document.createElement('img'); thumbnail.src = image.data; thumbnail.alt = t('imagePreview');
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button button-quiet danger';
      remove.textContent = t('removePicture');
      remove.addEventListener('click', () => {
        row._media.image = null; row._media.hotspots = []; dirty = true; refreshMediaRow(row);
      });
      preview.append(thumbnail, remove);
    } else {
      const empty = document.createElement('span'); empty.className = 'muted'; empty.textContent = t('noPicture'); preview.append(empty);
    }
    const audioList = row.querySelector('[data-audio-list]'); audioList.replaceChildren();
    const select = row.querySelector('[data-audio-language]');
    for (const option of select.options) option.textContent = t(i18n.languageNames[option.value]);
    for (const [language, assetId] of Object.entries(row._media.audio)) {
      const line = document.createElement('div'); line.className = 'audio-attachment';
      const label = document.createElement('span'); label.textContent = t(i18n.languageNames[language]);
      const play = document.createElement('button'); play.type = 'button'; play.className = 'button button-secondary';
      play.textContent = t('playAudio'); play.setAttribute('aria-label', `${t('playAudio')} · ${label.textContent}`);
      play.addEventListener('click', () => media.play(assetFor(assetId), () => message('audioPlaybackFailed')));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button button-quiet danger';
      remove.textContent = t('remove'); remove.setAttribute('aria-label', `${t('remove')} · ${label.textContent}`);
      remove.addEventListener('click', () => { delete row._media.audio[language]; dirty = true; refreshMediaRow(row); });
      line.append(label, play, remove); audioList.append(line);
    }
    row.querySelector('input[type="file"]').setAttribute('aria-label', t('addPicture'));
    row.querySelectorAll('input[type="file"]')[1].setAttribute('aria-label', t('addPronunciation'));
    select.setAttribute('aria-label', t('audioLanguage'));
    renderHotspotEditor(row);
  }

  function fillHotspotOptions(row, select) {
    const wanted = row._hotspotSelection || select.value;
    select.replaceChildren();
    for (const target of byId('item-list').children) {
      const terms = [...target.querySelectorAll('[data-language]')].map(input => input.value.trim()).filter(Boolean);
      if (terms.length < 2) continue;
      const option = document.createElement('option'); option.value = target.dataset.id;
      option.textContent = terms.slice(0, 2).join(' · ');
      select.append(option);
    }
    if ([...select.options].some(option => option.value === wanted)) select.value = wanted;
    row._hotspotSelection = select.value;
  }

  function placeHotspot(row, itemId, x, y) {
    if (!itemId) { message('hotspotChooseWord'); return false; }
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < .05 || x > .95 || y < .05 || y > .95) {
      message('invalidHotspots'); return false;
    }
    x = Math.round(x * 1000) / 1000; y = Math.round(y * 1000) / 1000;
    const remaining = row._media.hotspots.filter(point => point.itemId !== itemId);
    if (remaining.length >= model.MAX_HOTSPOTS) { message('hotspotLimit'); return false; }
    if (remaining.some(point => Math.hypot(point.x - x, point.y - y) < model.HOTSPOT_SPACING)) {
      message('hotspotTooClose'); return false;
    }
    row._media.hotspots = [...remaining, { itemId, x, y }];
    row._hotspotSelection = itemId;
    dirty = true;
    renderHotspotEditor(row);
    message('hotspotPlaced');
    return true;
  }

  function sizeHotspotStage(stage, picture, maxHeight) {
    const size = () => {
      if (!picture.naturalWidth || !picture.naturalHeight) return;
      const width = Math.min(picture.naturalWidth, picture.naturalWidth * maxHeight / picture.naturalHeight);
      stage.style.width = `min(100%, ${Math.round(width)}px)`;
    };
    picture.addEventListener('load', size);
    if (picture.complete) size();
  }

  function renderHotspotEditor(row) {
    const editor = row.querySelector('[data-hotspot-editor]');
    if (!editor) return;
    const image = assetFor(row._media.image);
    editor.hidden = !image;
    editor.querySelector('summary').textContent = t('pictureMarkers');
    const content = editor.querySelector('[data-hotspot-content]');
    content.replaceChildren();
    if (!image) return;
    const guide = document.createElement('p'); guide.className = 'muted'; guide.textContent = t('hotspotGuide');
    const targetLabel = document.createElement('label'); targetLabel.textContent = t('hotspotTarget');
    const select = document.createElement('select');
    select.addEventListener('focus', () => fillHotspotOptions(row, select));
    select.addEventListener('change', () => {
      row._hotspotSelection = select.value;
      const existing = row._media.hotspots.find(point => point.itemId === select.value);
      if (existing) { xInput.value = String(Math.round(existing.x * 100)); yInput.value = String(Math.round(existing.y * 100)); }
    });
    targetLabel.append(select);
    fillHotspotOptions(row, select);
    const controls = document.createElement('div'); controls.className = 'hotspot-controls';
    const xLabel = document.createElement('label'); xLabel.textContent = t('hotspotX');
    const xInput = document.createElement('input'); xInput.type = 'number'; xInput.min = '5'; xInput.max = '95'; xInput.step = '1'; xInput.value = '50';
    xLabel.append(xInput);
    const yLabel = document.createElement('label'); yLabel.textContent = t('hotspotY');
    const yInput = document.createElement('input'); yInput.type = 'number'; yInput.min = '5'; yInput.max = '95'; yInput.step = '1'; yInput.value = '50';
    yLabel.append(yInput);
    const existing = row._media.hotspots.find(point => point.itemId === select.value);
    if (existing) { xInput.value = String(Math.round(existing.x * 100)); yInput.value = String(Math.round(existing.y * 100)); }
    const place = document.createElement('button'); place.type = 'button'; place.className = 'button button-secondary'; place.textContent = t('placeMarker');
    place.addEventListener('click', () => {
      if (placeHotspot(row, select.value, Number(xInput.value) / 100, Number(yInput.value) / 100))
        editor.querySelector('select')?.focus();
    });
    controls.append(xLabel, yLabel, place);
    const stage = document.createElement('div'); stage.className = 'hotspot-stage editor-stage';
    const picture = document.createElement('img'); picture.src = image.data; picture.alt = t('imagePreview');
    picture.addEventListener('click', event => {
      const bounds = picture.getBoundingClientRect();
      const x = Math.max(.05, Math.min(.95, (event.clientX - bounds.left) / bounds.width));
      const y = Math.max(.05, Math.min(.95, (event.clientY - bounds.top) / bounds.height));
      placeHotspot(row, select.value, x, y);
    });
    stage.append(picture);
    sizeHotspotStage(stage, picture, 420);
    row._media.hotspots.forEach((point, index) => {
      const marker = document.createElement('span'); marker.className = 'hotspot-marker editor-marker';
      marker.textContent = String(index + 1); marker.style.left = `${point.x * 100}%`; marker.style.top = `${point.y * 100}%`;
      marker.setAttribute('aria-hidden', 'true'); stage.append(marker);
    });
    const list = document.createElement('div'); list.className = 'hotspot-list';
    for (const [index, point] of row._media.hotspots.entries()) {
      const line = document.createElement('div'); line.className = 'hotspot-line';
      const target = [...byId('item-list').children].find(candidate => candidate.dataset.id === point.itemId);
      const terms = target ? [...target.querySelectorAll('[data-language]')].map(input => input.value.trim()).filter(Boolean) : [];
      const label = document.createElement('span'); label.textContent = `${index + 1}. ${terms[0] || t('missingLabel')} (${Math.round(point.x * 100)}%, ${Math.round(point.y * 100)}%)`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button button-quiet danger';
      remove.textContent = t('remove'); remove.setAttribute('aria-label', `${t('remove')} · ${label.textContent}`);
      remove.addEventListener('click', () => {
        row._media.hotspots = row._media.hotspots.filter(value => value !== point);
        dirty = true; renderHotspotEditor(row);
      });
      line.append(label, remove); list.append(line);
    }
    content.append(guide, targetLabel, controls, stage, list);
  }

  function openLesson(id) {
    const saved = collection.lessons.find(lesson => lesson.id === id);
    if (!saved) return;
    draft = structuredClone(saved);
    draftAssets = {};
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
    for (const row of byId('item-list').children) renderHotspotEditor(row);
    resetDeck(); renderList(); renderReadiness();
  }

  function newLesson() {
    if (!confirmDiscard()) return;
    resetDeck();
    draft = model.createLesson();
    draftAssets = {};
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
      return { id: row.dataset.id, terms, media: { image: row._media.image, audio: { ...row._media.audio },
        hotspots: row._media.hotspots.map(point => ({ ...point })) } };
    }).filter(item => Object.values(item.terms).some(term => term.trim()));
    return { ...draft, title: byId('lesson-name').value, updatedAt: now, items };
  }

  async function save(event) {
    event.preventDefault();
    if (mediaPending) { message('mediaBusy'); return; }
    try {
      const updated = collectDraft();
      const referenced = new Set(updated.items.flatMap(item => [item.media.image, ...Object.values(item.media.audio)]).filter(Boolean));
      const additions = Object.fromEntries(Object.entries(draftAssets).filter(([assetId]) => referenced.has(assetId)));
      collection = model.saveLesson(collection, updated, additions);
      draft = model.validateLesson(updated);
      draftAssets = {};
      currentId = draft.id;
      dirty = false;
      byId('editor-title').textContent = draft.title;
      byId('duplicate-lesson').hidden = false;
      byId('delete-lesson').hidden = false;
      byId('practice').hidden = false;
      resetDeck(); renderList(); renderReadiness(); message(await saveCache() ? 'saved' : 'storageFull');
    } catch (error) { message(error.message in i18n.strings.en ? error.message : 'invalidLesson'); }
  }

  async function duplicate() {
    if (!confirmDiscard()) return;
    const original = collection.lessons.find(lesson => lesson.id === currentId);
    if (!original) return;
    const copy = model.duplicateLesson(original);
    copy.title = `${copy.title} (${t('duplicateSuffix')})`;
    collection = model.saveLesson(collection, copy);
    const cached = await saveCache(); openLesson(copy.id); message(cached ? 'duplicated' : 'storageFull');
  }

  async function removeLesson() {
    if (!currentId || !window.confirm(t('confirmDelete'))) return;
    resetDeck();
    collection = model.pruneAssets({ ...collection, lessons: collection.lessons.filter(lesson => lesson.id !== currentId) });
    const cached = await saveCache(); draft = null; draftAssets = {}; currentId = null; dirty = false; deck = [];
    byId('editor').hidden = true; byId('practice').hidden = true; byId('welcome').hidden = false;
    renderList(); message(cached ? 'deleted' : 'storageFull');
  }

  function exportLibrary() {
    if (!collection.lessons.length) { message('noLessons'); return; }
    if (dirty || mediaPending) { message('saveBeforeExport'); return; }
    const blob = new Blob([JSON.stringify(collection)], { type: 'application/json' });
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
    if (file.size > 36_000_000) { message('fileTooLarge'); return; }
    let imported;
    try { imported = model.validateCollection(JSON.parse(await file.text())); }
    catch (error) { message(error.message in i18n.strings.en ? error.message : 'invalidFile'); return; }
    if (!window.confirm(t('confirmImport'))) return;
    media.stop(); collection = imported; draft = null; draftAssets = {}; currentId = null; dirty = false;
    const cached = await saveCache(); renderList();
    if (collection.lessons.length) openLesson(collection.lessons[0].id);
    else { byId('editor').hidden = true; byId('practice').hidden = true; byId('welcome').hidden = false; }
    message(cached ? 'imported' : 'storageFull');
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
    media.stop();
    if (challenge?.memory?.timer) clearTimeout(challenge.memory.timer);
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
    byId('card-meter').max = deck.length;
    byId('card-meter').value = cardIndex + 1;
    byId('card-prompt').textContent = item.terms[front];
    byId('card-prompt').lang = front; byId('card-prompt').dir = front === 'ar' ? 'rtl' : 'ltr';
    byId('card-answer').textContent = item.terms[back];
    byId('card-answer').lang = back; byId('card-answer').dir = back === 'ar' ? 'rtl' : 'ltr';
    byId('card-answer').hidden = true;
    const picture = assetFor(item.media.image);
    byId('card-picture').hidden = !picture;
    if (picture) byId('card-picture').src = picture.data;
    else byId('card-picture').removeAttribute('src');
    byId('play-card-front').hidden = !assetFor(item.media.audio[front]);
    byId('play-card-back').hidden = true;
    byId('reveal-card').disabled = false;
    effects.animate(byId('flashcard'), 'card');
  }

  function nextCard() {
    if (!deck.length) return;
    media.stop();
    if (cardIndex === deck.length - 1) {
      resetCardOnly(); byId('practice-message').textContent = t('endOfDeck');
    } else { cardIndex += 1; showCard(); }
  }

  function revealCard() {
    if (!deck.length || !byId('card-answer').hidden) return;
    byId('card-answer').hidden = false;
    byId('reveal-card').disabled = true;
    byId('play-card-back').hidden = !assetFor(deck[cardIndex].media.audio[byId('back-language').value]);
    effects.animate(byId('card-answer'), 'card');
    byId('next-card').focus();
  }

  function playCardAudio(selectId) {
    if (!deck.length) return;
    const language = byId(selectId).value;
    media.play(assetFor(deck[cardIndex].media.audio[language]), () => message('audioPlaybackFailed'));
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
    const counts = games.readiness(saved, front, back, collection.assets);
    const mode = byId('game-mode').value;
    byId('activity-readiness').textContent = counts[mode]
      ? t(mode === 'pictureLabels' ? 'readyLabelPictures' : 'readyItems', { count: counts[mode] })
      : t(unavailableReason(mode));
  }

  function unavailableReason(mode) {
    if (mode === 'picture') return 'needPictures';
    if (mode === 'pictureLabels') return 'needPictureLabels';
    if (mode === 'listening') return 'needAudio';
    if (mode === 'listenType') return 'needRecordedAnswers';
    if (mode === 'wordSearch') return !games.hasGraphemeSupport() ? 'needGraphemeSupport'
      : byId('back-language').value === 'ar' ? 'needLatinWordSearch' : 'needWordSearch';
    if (mode === 'crossword') return !games.hasGraphemeSupport() ? 'needGraphemeSupport'
      : byId('back-language').value === 'ar' ? 'needLatinCrossword' : 'needCrossword';
    if (mode === 'guess') return games.hasGraphemeSupport() ? 'needGuessWords' : 'needGraphemeSupport';
    if (mode === 'tiles' || mode === 'missing') return games.hasGraphemeSupport() ? 'needSpellingWords' : 'needGraphemeSupport';
    if (['quiz', 'matching', 'memory', 'trueFalse'].includes(mode)) return 'needFour';
    return 'noCards';
  }

  function setTerm(element, text, language) {
    element.textContent = text;
    element.lang = language;
    element.dir = language === 'ar' ? 'rtl' : 'ltr';
  }

  function startChallenge(lesson, mode, front, back) {
    const items = mode === 'picture' || mode === 'listening'
      ? games.mediaPairs(lesson, collection.assets, front, back, mode)
      : mode === 'pictureLabels' ? games.pictureLabelScenes(lesson, collection.assets, front, back)
      : mode === 'listenType' ? games.listeningTypingPairs(lesson, collection.assets, front, back)
      : mode === 'wordSearch' ? games.wordSearchPairs(lesson, front, back)
      : mode === 'crossword' ? games.crosswordPairs(lesson, front, back)
      : ['tiles', 'missing', 'guess'].includes(mode) ? games.spellingPairs(lesson, front, back, mode)
      : games.eligiblePairs(lesson, front, back, true);
    if (['quiz', 'matching', 'memory', 'trueFalse', 'picture', 'listening'].includes(mode) && items.length < 4) {
      byId('practice-message').textContent = t(mode === 'picture' ? 'needPictures' : mode === 'listening' ? 'needAudio' : 'needFour'); return;
    }
    if (mode === 'wordSearch' && items.length < 3) { byId('practice-message').textContent = t(unavailableReason(mode)); return; }
    const puzzle = mode === 'crossword' ? games.generateCrossword(items, back) : null;
    if (mode === 'crossword' && !puzzle) { byId('practice-message').textContent = t(unavailableReason(mode)); return; }
    if (!items.length) { byId('practice-message').textContent = t(unavailableReason(mode)); return; }
    const trueFalse = mode === 'trueFalse' ? games.trueFalseRounds(items, back) : null;
    const selected = mode === 'crossword' ? puzzle.entries.map(entry => items.find(item => item.id === entry.id))
      : trueFalse ? trueFalse.map(round => round.item)
      : games.shuffle(items).slice(0, mode === 'wordSearch' ? 5 : mode === 'memory' ? 6 : mode === 'pictureLabels' ? 3 : items.length);
    challenge = { mode, front, back, items: selected, index: 0, score: 0, locked: false,
      rounds: mode === 'matching' ? games.matchingRounds(items) : [], roundIndex: 0,
      matched: new Set(), selectedFront: null, selectedBack: null, attempts: 0, attemptsThisItem: 0 };
    if (mode === 'wordSearch') challenge.search = {
      ...games.generateWordSearch(selected, back), found: new Set(), foundCells: new Set(), start: null, active: { row: 0, col: 0 }
    };
    if (mode === 'crossword') challenge.crossword = {
      puzzle, solved: new Set(), drafts: new Map(), activeEntryId: puzzle.entries[0].id,
      active: { ...puzzle.entries[0].cells[0] }
    };
    if (mode === 'memory') challenge.memory = games.createMemoryRound(selected, front, back);
    if (trueFalse) challenge.trueFalse = trueFalse;
    if (mode === 'pictureLabels') challenge.labelTotal = selected.reduce((total, scene) => total + scene.hotspots.length, 0);
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
    state.attemptsThisItem = 0;
    const options = byId('challenge-options');
    options.replaceChildren(); options.className = 'challenge-options';
    byId('challenge-feedback').textContent = '';
    byId('challenge-feedback').className = 'challenge-feedback';
    byId('challenge-next').hidden = true;
    byId('challenge-media').replaceChildren();
    byId('typing-form').hidden = !['typing', 'missing', 'listenType'].includes(state.mode);
    const answerLabel = byId('typing-form').querySelector('label');
    answerLabel.dataset.i18n = state.mode === 'missing' ? 'missingLetters' : state.mode === 'listenType' ? 'spellWhatYouHear' : 'yourAnswer';
    answerLabel.textContent = t(answerLabel.dataset.i18n);
    byId('challenge-score').textContent = t('score', { score: state.score });
    if (state.mode === 'matching') { renderMatching(); return; }
    if (state.mode === 'memory') {
      byId('challenge-prompt').textContent = t('memoryPrompt');
      byId('challenge-prompt').removeAttribute('lang'); byId('challenge-prompt').removeAttribute('dir');
      options.classList.add('memory-board');
      renderMemory();
      return;
    }
    if (state.mode === 'pictureLabels') {
      state.labelSolved = new Set(); state.selectedLabelId = null;
      state.labelOrder = games.shuffle(state.items[state.index].hotspots);
      byId('challenge-prompt').textContent = t('pictureLabelsPrompt');
      byId('challenge-prompt').removeAttribute('lang'); byId('challenge-prompt').removeAttribute('dir');
      options.classList.add('picture-label-options');
      renderPictureLabels();
      return;
    }
    if (state.mode === 'wordSearch') {
      byId('challenge-prompt').textContent = t('wordSearchPrompt');
      byId('challenge-prompt').removeAttribute('lang'); byId('challenge-prompt').removeAttribute('dir');
      options.classList.add('word-search-options');
      renderWordSearch();
      return;
    }
    if (state.mode === 'crossword') {
      byId('challenge-prompt').textContent = t('crosswordPrompt');
      byId('challenge-prompt').removeAttribute('lang'); byId('challenge-prompt').removeAttribute('dir');
      options.classList.add('crossword-options');
      renderCrossword();
      return;
    }
    byId('challenge-progress').textContent = t('cardCount', { current: state.index + 1, total: state.items.length });
    byId('challenge-meter').max = state.items.length;
    byId('challenge-meter').value = state.index + 1;
    const item = state.items[state.index];
    if (state.mode === 'trueFalse') { renderTrueFalse(); return; }
    if (state.mode === 'picture' || state.mode === 'listening' || state.mode === 'listenType') {
      const prompt = byId('challenge-prompt');
      prompt.textContent = t(state.mode === 'picture' ? 'picturePrompt' : state.mode === 'listening' ? 'listenPrompt' : 'listenTypePrompt');
      prompt.removeAttribute('lang'); prompt.removeAttribute('dir');
      if (state.mode === 'picture') {
        const image = document.createElement('img'); image.className = 'question-picture';
        image.src = assetFor(item.media.image).data; image.alt = t('pictureClue');
        byId('challenge-media').append(image);
      } else {
        const play = document.createElement('button'); play.type = 'button'; play.className = 'listen-button';
        play.textContent = `▶ ${t('playAudio')}`;
        const recordingLanguage = state.mode === 'listenType' ? state.back : state.front;
        play.addEventListener('click', () => media.play(assetFor(item.media.audio[recordingLanguage]), () => message('audioPlaybackFailed')));
        byId('challenge-media').append(play);
      }
    } else setTerm(byId('challenge-prompt'), item.terms[state.front], state.front);
    if (['quiz', 'picture', 'listening'].includes(state.mode)) {
      options.classList.add('quiz-options');
      for (const choice of games.quizChoices(item, state.items)) {
        const button = optionButton(choice, state.back);
        button.addEventListener('click', () => answerQuiz(button, item));
        options.append(button);
      }
    } else if (state.mode === 'tiles') {
      const clusters = games.spellingClusters(item.terms[state.back], state.back);
      state.tileOrder = games.tileOrder(clusters);
      state.tileSelection = [];
      options.classList.add('tile-options');
      renderTiles();
    } else if (state.mode === 'guess') {
      state.guess = {
        clusters: games.spellingClusters(item.terms[state.back], state.back),
        guessed: new Set(), mistakes: 0
      };
      state.guess.options = games.guessOptions(state.guess.clusters, state.back);
      options.classList.add('guess-options');
      renderGuess();
    } else {
      if (state.mode === 'missing') {
        state.missing = games.missingPlan(games.spellingClusters(item.terms[state.back], state.back));
        const pattern = document.createElement('div'); pattern.className = 'spelling-pattern';
        setTerm(pattern, state.missing.pattern, state.back);
        pattern.setAttribute('role', 'img');
        pattern.setAttribute('aria-label', t('wordPattern', { pattern: state.missing.pattern }));
        options.append(pattern);
      }
      const input = byId('typing-answer');
      input.value = ''; input.disabled = false; input.lang = state.back;
      input.dir = state.back === 'ar' ? 'rtl' : 'ltr';
      input.spellcheck = false;
      if (state.mode === 'listenType') byId('challenge-media').querySelector('button').focus();
      else input.focus();
    }
  }

  function renderTiles(focusTile = null) {
    const state = challenge;
    if (!state || state.mode !== 'tiles') return;
    const options = byId('challenge-options');
    options.replaceChildren();
    const selected = new Set(state.tileSelection);
    const assembly = document.createElement('div');
    assembly.className = 'tile-assembly'; assembly.lang = state.back;
    assembly.dir = state.back === 'ar' ? 'rtl' : 'ltr';
    assembly.setAttribute('role', 'group'); assembly.setAttribute('aria-label', t('assembledWord'));
    assembly.setAttribute('aria-live', 'polite');
    if (!selected.size) {
      const hint = document.createElement('span'); hint.className = 'tile-hint'; hint.textContent = t('selectTiles');
      assembly.append(hint);
    }
    for (const id of state.tileSelection) {
      const tile = state.tileOrder.find(entry => entry.id === id);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'letter-tile placed';
      setTerm(button, tile.letter, state.back);
      button.setAttribute('aria-label', t('removeTile', { letter: tile.letter }));
      button.disabled = state.locked;
      button.addEventListener('click', () => {
        state.tileSelection = state.tileSelection.filter(value => value !== id);
        clearSpellingFeedback(); renderTiles(id);
      });
      assembly.append(button);
    }
    const tray = document.createElement('div'); tray.className = 'tile-tray';
    tray.lang = state.back; tray.dir = state.back === 'ar' ? 'rtl' : 'ltr';
    tray.setAttribute('role', 'group'); tray.setAttribute('aria-label', t('availableTiles'));
    for (const tile of state.tileOrder) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'letter-tile';
      button.dataset.tileId = String(tile.id);
      setTerm(button, tile.letter, state.back);
      button.setAttribute('aria-label', t('addTile', { letter: tile.letter }));
      button.disabled = state.locked || selected.has(tile.id);
      button.addEventListener('click', () => {
        state.tileSelection.push(tile.id);
        clearSpellingFeedback(); renderTiles(state.tileSelection.length === state.tileOrder.length ? 'check' : null);
      });
      tray.append(button);
    }
    const controls = document.createElement('div'); controls.className = 'tile-controls';
    const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'button button-secondary';
    clear.textContent = t('clearTiles'); clear.disabled = state.locked || !selected.size;
    clear.addEventListener('click', () => { state.tileSelection = []; clearSpellingFeedback(); renderTiles(); });
    const check = document.createElement('button'); check.type = 'button'; check.className = 'button button-primary';
    check.dataset.tileCheck = ''; check.textContent = t('check');
    check.disabled = state.locked || selected.size !== state.tileOrder.length;
    check.addEventListener('click', () => {
      const answer = state.tileSelection.map(id => state.tileOrder.find(tile => tile.id === id).letter).join('');
      evaluateSpelling(answer, check, state.items[state.index].terms[state.back]);
    });
    controls.append(clear, check); options.append(assembly, tray, controls);
    const focus = focusTile === 'check' ? check
      : focusTile === null ? tray.querySelector('button:not(:disabled)')
      : [...tray.querySelectorAll('button')].find(button => button.dataset.tileId === String(focusTile));
    if (focus && !focus.disabled) focus.focus();
  }

  function renderGuess() {
    const state = challenge;
    if (!state || state.mode !== 'guess') return;
    const { clusters, guessed, mistakes } = state.guess;
    const options = byId('challenge-options');
    options.replaceChildren();
    const pattern = document.createElement('div'); pattern.className = 'guess-pattern';
    const revealed = clusters.map(letter => state.locked && mistakes >= 6 || guessed.has(games.answerKey(letter, state.back)) ? letter : '□').join('');
    setTerm(pattern, revealed, state.back);
    pattern.setAttribute('role', 'img'); pattern.setAttribute('aria-label', t('guessPattern', { pattern: revealed }));
    const remaining = document.createElement('p'); remaining.className = 'guess-remaining';
    remaining.textContent = t('guessesLeft', { count: 6 - mistakes });
    const keyboard = document.createElement('div'); keyboard.className = 'guess-keyboard';
    keyboard.lang = state.back; keyboard.dir = state.back === 'ar' ? 'rtl' : 'ltr';
    keyboard.setAttribute('role', 'group'); keyboard.setAttribute('aria-label', t('guessLetters'));
    const targetKeys = new Set(clusters.map(letter => games.answerKey(letter, state.back)));
    for (const letter of state.guess.options) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'guess-key';
      button.dataset.guessKey = letter;
      setTerm(button, letter, state.back);
      button.setAttribute('aria-label', t('guessLetter', { letter }));
      if (guessed.has(letter)) button.classList.add(targetKeys.has(letter) ? 'correct' : 'wrong');
      button.disabled = state.locked || guessed.has(letter);
      button.addEventListener('click', () => chooseGuess(letter));
      keyboard.append(button);
    }
    options.append(pattern, remaining, keyboard);
    if (!state.locked) keyboard.querySelector('button:not(:disabled)')?.focus();
  }

  function chooseGuess(letter) {
    const state = challenge;
    if (!state || state.mode !== 'guess' || state.locked || state.guess.guessed.has(letter)) return;
    const guess = state.guess;
    guess.guessed.add(letter);
    const targetKeys = guess.clusters.map(cluster => games.answerKey(cluster, state.back));
    const present = targetKeys.includes(letter);
    if (!present) guess.mistakes += 1;
    const solved = targetKeys.every(key => guess.guessed.has(key));
    const lost = guess.mistakes >= 6;
    if (solved) { state.score += 1; state.locked = true; }
    else if (lost) state.locked = true;
    renderGuess();
    const output = byId('challenge-feedback');
    output.className = `challenge-feedback ${present ? 'positive' : 'negative'}`;
    output.textContent = solved ? t('correct') : lost
      ? t('correctAnswer', { answer: state.items[state.index].terms[state.back] })
      : t(present ? 'letterFound' : 'letterNotInWord');
    effects.play(present ? 'correct' : 'wrong');
    effects.animate(byId('challenge-options').querySelector('.guess-pattern'), present ? 'correct' : 'wrong');
    byId('challenge-score').textContent = t('score', { score: state.score });
    if (state.locked) prepareNext();
  }

  function renderWordSearch(focusCell = null) {
    const state = challenge;
    if (!state || state.mode !== 'wordSearch') return;
    const search = state.search;
    const options = byId('challenge-options');
    const previousScroll = options.querySelector('.search-scroll')?.scrollLeft || 0;
    options.replaceChildren();
    byId('challenge-progress').textContent = t('wordsFound', { count: search.found.size, total: state.items.length });
    byId('challenge-meter').max = state.items.length;
    byId('challenge-meter').value = search.found.size;
    const list = document.createElement('ul'); list.className = 'search-word-list';
    for (const item of state.items) {
      const entry = document.createElement('li'); entry.className = search.found.has(item.id) ? 'found' : '';
      setTerm(entry, item.terms[state.back], state.back);
      if (search.found.has(item.id)) entry.setAttribute('aria-label', t('foundWord', { word: item.terms[state.back] }));
      list.append(entry);
    }
    const scroll = document.createElement('div'); scroll.className = 'search-scroll';
    const grid = document.createElement('div'); grid.className = 'search-grid';
    grid.style.setProperty('--grid-size', String(search.grid.length));
    grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', t('wordSearchGrid'));
    const active = focusCell || search.active;
    for (let row = 0; row < search.grid.length; row += 1) for (let col = 0; col < search.grid.length; col += 1) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'search-cell';
      const letter = search.grid[row][col]; const key = `${row},${col}`;
      setTerm(button, letter, state.back);
      button.dataset.row = String(row); button.dataset.col = String(col);
      button.setAttribute('aria-label', t('gridCell', { letter, row: row + 1, col: col + 1 }));
      button.tabIndex = active.row === row && active.col === col ? 0 : -1;
      if (search.foundCells.has(key)) button.classList.add('found');
      if (search.start?.row === row && search.start?.col === col) button.classList.add('selected');
      button.disabled = state.locked;
      button.addEventListener('click', () => chooseSearchCell({ row, col }));
      button.addEventListener('keydown', event => {
        const move = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
        if (!move) return;
        event.preventDefault();
        const nextRow = Math.max(0, Math.min(search.grid.length - 1, row + move[0]));
        const nextCol = Math.max(0, Math.min(search.grid.length - 1, col + move[1]));
        search.active = { row: nextRow, col: nextCol };
        button.tabIndex = -1;
        const next = grid.querySelector(`[data-row="${nextRow}"][data-col="${nextCol}"]`);
        next.tabIndex = 0; next.focus();
      });
      grid.append(button);
    }
    scroll.append(grid); options.append(list, scroll);
    scroll.scrollLeft = previousScroll;
    if (focusCell && !state.locked) {
      search.active = focusCell;
      grid.querySelector(`[data-row="${focusCell.row}"][data-col="${focusCell.col}"]`)?.focus();
    } else if (!state.locked) grid.querySelector('[tabindex="0"]')?.focus();
  }

  function chooseSearchCell(cell) {
    const state = challenge;
    if (!state || state.mode !== 'wordSearch' || state.locked) return;
    const search = state.search;
    search.active = cell;
    if (!search.start) {
      search.start = cell;
      renderWordSearch(cell);
      byId('challenge-feedback').className = 'challenge-feedback';
      byId('challenge-feedback').textContent = t('chooseEndCell');
      return;
    }
    const path = games.gridPath(search.start, cell);
    search.start = null;
    const letters = path.map(({ row, col }) => search.grid[row][col]).join('');
    const reverse = [...path].reverse().map(({ row, col }) => search.grid[row][col]).join('');
    const item = state.items.find(candidate => !search.found.has(candidate.id) &&
      (games.sameAnswer(letters, candidate.terms[state.back], state.back) ||
       games.sameAnswer(reverse, candidate.terms[state.back], state.back)));
    if (item) {
      search.found.add(item.id);
      for (const { row, col } of path) search.foundCells.add(`${row},${col}`);
      state.score += 1;
    }
    if (search.found.size === state.items.length) state.locked = true;
    renderWordSearch(cell);
    const output = byId('challenge-feedback');
    output.className = `challenge-feedback ${item ? 'positive' : 'negative'}`;
    output.textContent = item ? t('foundWord', { word: item.terms[state.back] }) : t('tryAnotherPath');
    effects.play(item ? 'correct' : 'wrong');
    byId('challenge-score').textContent = t('score', { score: state.score });
    if (state.locked) {
      byId('challenge-next').hidden = false;
      byId('challenge-next').textContent = t('seeResults');
      byId('challenge-next').focus();
    }
  }

  function renderCrossword(focusTarget = 'input') {
    const state = challenge;
    if (!state || state.mode !== 'crossword') return;
    const crossword = state.crossword;
    const { puzzle, solved } = crossword;
    const options = byId('challenge-options');
    const previousScroll = options.querySelector('.crossword-scroll')?.scrollLeft || 0;
    options.replaceChildren();
    byId('challenge-progress').textContent = t('crosswordProgress', { count: solved.size, total: puzzle.entries.length });
    byId('challenge-meter').max = puzzle.entries.length;
    byId('challenge-meter').value = solved.size;
    const scroll = document.createElement('div'); scroll.className = 'crossword-scroll';
    const grid = document.createElement('div'); grid.className = 'crossword-grid';
    grid.style.setProperty('--crossword-columns', String(puzzle.grid[0].length));
    grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', t('crosswordGrid'));
    for (let row = 0; row < puzzle.grid.length; row += 1) for (let col = 0; col < puzzle.grid[row].length; col += 1) {
      const cell = puzzle.grid[row][col];
      if (!cell) {
        const blank = document.createElement('span'); blank.className = 'crossword-blank'; blank.setAttribute('aria-hidden', 'true');
        grid.append(blank); continue;
      }
      const button = document.createElement('button'); button.type = 'button'; button.className = 'crossword-cell';
      const known = cell.entryIds.some(id => solved.has(id));
      if (known) button.classList.add('solved');
      if (cell.entryIds.includes(crossword.activeEntryId) && !state.locked) button.classList.add('active');
      if (crossword.active.row === row && crossword.active.col === col) button.classList.add('current');
      if (cell.number) {
        const number = document.createElement('span'); number.className = 'crossword-number'; number.textContent = String(cell.number);
        button.append(number);
      }
      const letter = document.createElement('span'); letter.className = 'crossword-letter'; letter.textContent = known ? cell.letter : '';
      letter.lang = state.back; button.append(letter);
      button.dataset.row = String(row); button.dataset.col = String(col);
      button.setAttribute('aria-label', `${t('crosswordCell', { row: row + 1, col: col + 1 })}${cell.number ? `, ${t('crosswordStart', { number: cell.number })}` : ''}${known ? `, ${t('crosswordKnown', { letter: cell.letter })}` : ''}`);
      button.tabIndex = crossword.active.row === row && crossword.active.col === col ? 0 : -1;
      button.disabled = state.locked;
      button.addEventListener('click', () => {
        crossword.active = { row, col };
        const available = cell.entryIds.filter(id => !solved.has(id));
        if (!available.length) return;
        const current = available.indexOf(crossword.activeEntryId);
        crossword.activeEntryId = available[(current + 1) % available.length];
        renderCrossword();
      });
      button.addEventListener('keydown', event => {
        const move = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
        if (!move) return;
        event.preventDefault();
        let nextRow = row + move[0]; let nextCol = col + move[1];
        while (puzzle.grid[nextRow]?.[nextCol] === null) { nextRow += move[0]; nextCol += move[1]; }
        const next = grid.querySelector(`[data-row="${nextRow}"][data-col="${nextCol}"]`);
        if (next) {
          crossword.active = { row: nextRow, col: nextCol };
          button.tabIndex = -1; next.tabIndex = 0; next.focus();
        }
      });
      grid.append(button);
    }
    scroll.append(grid); options.append(scroll);
    scroll.scrollLeft = previousScroll;
    const clueGroups = document.createElement('div'); clueGroups.className = 'crossword-clues';
    for (const direction of ['across', 'down']) {
      const group = document.createElement('section');
      const heading = document.createElement('h3'); heading.textContent = t(direction === 'across' ? 'crosswordAcross' : 'crosswordDown');
      const list = document.createElement('div'); list.className = 'crossword-clue-list';
      for (const entry of puzzle.entries.filter(value => value.direction === direction).sort((a, b) => a.number - b.number)) {
        const item = state.items.find(value => value.id === entry.id);
        const clue = document.createElement('button'); clue.type = 'button'; clue.className = 'crossword-clue';
        if (entry.id === crossword.activeEntryId && !state.locked) clue.classList.add('active');
        if (solved.has(entry.id)) clue.classList.add('solved');
        clue.disabled = state.locked || solved.has(entry.id);
        const number = document.createElement('strong'); number.textContent = `${entry.number}. `;
        const term = document.createElement('span'); setTerm(term, item.terms[state.front], state.front);
        clue.append(number, term);
        clue.addEventListener('click', () => {
          crossword.activeEntryId = entry.id;
          crossword.active = { ...entry.cells[0] };
          renderCrossword();
        });
        list.append(clue);
      }
      group.append(heading, list); clueGroups.append(group);
    }
    options.append(clueGroups);
    if (state.locked) return;
    const entry = puzzle.entries.find(value => value.id === crossword.activeEntryId);
    const item = state.items.find(value => value.id === entry.id);
    const form = document.createElement('form'); form.className = 'crossword-form';
    const label = document.createElement('label'); label.htmlFor = 'crossword-answer';
    label.append(`${entry.number} ${t(entry.direction === 'across' ? 'crosswordAcross' : 'crosswordDown')} · `);
    const clueText = document.createElement('span'); setTerm(clueText, item.terms[state.front], state.front);
    label.append(clueText);
    const pattern = document.createElement('p'); pattern.className = 'crossword-pattern';
    pattern.textContent = entry.cells.map(({ row, col }) =>
      puzzle.grid[row][col].entryIds.some(id => solved.has(id)) ? puzzle.grid[row][col].letter : '□').join(' ');
    pattern.setAttribute('aria-label', t('crosswordPattern', { pattern: pattern.textContent }));
    const controls = document.createElement('div'); controls.className = 'crossword-controls';
    const input = document.createElement('input'); input.id = 'crossword-answer'; input.type = 'text';
    input.value = crossword.drafts.get(entry.id) || '';
    input.autocomplete = 'off'; input.spellcheck = false; input.lang = state.back; input.dir = 'ltr';
    input.setAttribute('aria-describedby', 'crossword-pattern');
    pattern.id = 'crossword-pattern';
    input.addEventListener('input', () => crossword.drafts.set(entry.id, input.value));
    const check = document.createElement('button'); check.type = 'submit'; check.className = 'button button-primary'; check.textContent = t('check');
    controls.append(input, check); form.append(label, pattern, controls);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!input.value.trim()) { byId('challenge-feedback').textContent = t('enterAnswer'); input.focus(); return; }
      const correct = games.sameAnswer(input.value, item.terms[state.back], state.back);
      const output = byId('challenge-feedback');
      output.className = `challenge-feedback ${correct ? 'positive' : 'negative'}`;
      output.textContent = t(correct ? 'correct' : 'crosswordRetry');
      effects.play(correct ? 'correct' : 'wrong'); effects.animate(correct ? grid : input, correct ? 'correct' : 'wrong');
      if (!correct) { input.focus(); return; }
      solved.add(entry.id); state.score += 1;
      crossword.drafts.delete(entry.id);
      const next = puzzle.entries.find(value => !solved.has(value.id));
      if (next) { crossword.activeEntryId = next.id; crossword.active = { ...next.cells[0] }; }
      else state.locked = true;
      renderCrossword();
      byId('challenge-score').textContent = t('score', { score: state.score });
      output.className = 'challenge-feedback positive'; output.textContent = t('correct');
      if (state.locked) {
        byId('challenge-next').hidden = false;
        byId('challenge-next').textContent = t('seeResults');
        byId('challenge-next').focus();
      }
    });
    options.append(form);
    if (focusTarget === 'input') input.focus();
  }

  function clearSpellingFeedback() {
    byId('challenge-feedback').textContent = '';
    byId('challenge-feedback').className = 'challenge-feedback';
  }

  function retrySpelling(element) {
    const output = byId('challenge-feedback');
    output.className = 'challenge-feedback negative';
    output.textContent = t('trySpellingAgain');
    effects.animate(element, 'wrong'); effects.play('wrong');
  }

  function evaluateSpelling(answer, element, expected) {
    const state = challenge;
    if (!state || state.locked) return;
    const correct = games.sameAnswer(answer, expected, state.back);
    if (!correct && ++state.attemptsThisItem < 2) {
      retrySpelling(element);
      if (element === byId('typing-answer')) { element.focus(); element.select(); }
      return;
    }
    state.locked = true;
    if (correct) state.score += 1;
    if (state.mode === 'listenType') media.stop();
    if (state.mode === 'tiles') {
      for (const button of byId('challenge-options').querySelectorAll('button')) button.disabled = true;
    } else byId('typing-answer').disabled = true;
    feedback(correct, element, state.items[state.index].terms[state.back]);
    prepareNext();
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

  function renderTrueFalse() {
    const state = challenge;
    const round = state.trueFalse[state.index];
    byId('challenge-prompt').textContent = t('trueFalsePrompt');
    byId('challenge-prompt').removeAttribute('lang'); byId('challenge-prompt').removeAttribute('dir');
    const options = byId('challenge-options');
    options.classList.add('true-false-options');
    const pair = document.createElement('div'); pair.className = 'true-false-pair';
    for (const [labelKey, term, language] of [
      ['memoryFront', round.item.terms[state.front], state.front],
      ['proposedAnswer', round.proposedItem.terms[state.back], state.back]
    ]) {
      const panel = document.createElement('div'); panel.className = 'true-false-term';
      const label = document.createElement('span'); label.className = 'true-false-label'; label.textContent = t(labelKey);
      const value = document.createElement('strong'); setTerm(value, term, language);
      panel.append(label, value); pair.append(panel);
    }
    const choices = document.createElement('div'); choices.className = 'true-false-choices';
    for (const [answer, key] of [[true, 'trueChoice'], [false, 'falseChoice']]) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'game-option';
      button.textContent = t(key);
      button.addEventListener('click', () => answerTrueFalse(answer, button));
      choices.append(button);
    }
    options.append(pair, choices);
    choices.querySelector('button').focus();
  }

  function answerTrueFalse(answer, button) {
    const state = challenge;
    if (!state || state.mode !== 'trueFalse' || state.locked) return;
    const round = state.trueFalse[state.index];
    state.locked = true;
    const correct = answer === round.isTrue;
    if (correct) state.score += 1;
    for (const choice of byId('challenge-options').querySelectorAll('.true-false-choices button')) {
      choice.disabled = true;
      if (choice === button) choice.classList.add(correct ? 'correct' : 'wrong');
    }
    const output = byId('challenge-feedback');
    output.className = `challenge-feedback ${correct ? 'positive' : 'negative'}`;
    output.textContent = !correct ? t('correctAnswer', { answer: round.item.terms[state.back] })
      : round.isTrue ? t('correct') : t('trueFalseActual', { answer: round.item.terms[state.back] });
    effects.animate(button, correct ? 'correct' : 'wrong'); effects.play(correct ? 'correct' : 'wrong');
    byId('challenge-score').textContent = t('score', { score: state.score });
    prepareNext();
  }

  function renderPictureLabels(focus = 'label') {
    const state = challenge;
    if (!state || state.mode !== 'pictureLabels') return;
    const scene = state.items[state.index];
    const options = byId('challenge-options'); options.replaceChildren();
    byId('challenge-progress').textContent = t('labelsPlaced', { count: state.score, total: state.labelTotal });
    byId('challenge-meter').max = state.labelTotal; byId('challenge-meter').value = state.score;
    byId('challenge-score').textContent = t('score', { score: state.score });
    const stage = document.createElement('div'); stage.className = 'hotspot-stage play-stage';
    const picture = document.createElement('img'); picture.src = assetFor(scene.item.media.image).data; picture.alt = t('pictureToLabel');
    stage.append(picture);
    sizeHotspotStage(stage, picture, 440);
    scene.hotspots.forEach((point, index) => {
      const marker = document.createElement('button'); marker.type = 'button'; marker.className = 'hotspot-marker label-marker';
      marker.textContent = String(index + 1); marker.style.left = `${point.x * 100}%`; marker.style.top = `${point.y * 100}%`;
      marker.disabled = state.labelSolved.has(point.itemId);
      if (marker.disabled) marker.classList.add('placed');
      marker.setAttribute('aria-label', marker.disabled
        ? t('placedMarker', { number: index + 1, word: point.item.terms[state.back] })
        : t('emptyMarker', { number: index + 1 }));
      marker.addEventListener('click', () => choosePictureMarker(point, marker));
      stage.append(marker);
    });
    const choices = document.createElement('div'); choices.className = 'picture-label-choices';
    for (const point of state.labelOrder) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'game-option';
      setTerm(button, point.item.terms[state.back], state.back);
      button.dataset.labelId = point.itemId;
      button.disabled = state.labelSolved.has(point.itemId);
      if (button.disabled) button.classList.add('correct');
      if (state.selectedLabelId === point.itemId) button.classList.add('selected');
      button.addEventListener('click', () => {
        state.selectedLabelId = point.itemId;
        renderPictureLabels('marker');
        byId('challenge-feedback').textContent = t('choosePictureMarker');
        byId('challenge-feedback').className = 'challenge-feedback';
      });
      choices.append(button);
    }
    options.append(stage, choices);
    if (!state.locked) {
      const target = focus === 'marker' ? stage.querySelector('button:not(:disabled)')
        : choices.querySelector('button:not(:disabled)');
      target?.focus();
    }
  }

  function choosePictureMarker(point, marker) {
    const state = challenge;
    if (!state || state.mode !== 'pictureLabels' || state.locked || state.labelSolved.has(point.itemId)) return;
    const output = byId('challenge-feedback');
    if (!state.selectedLabelId) { output.textContent = t('selectPictureLabel'); return; }
    const correct = state.selectedLabelId === point.itemId;
    if (correct) {
      state.labelSolved.add(point.itemId); state.selectedLabelId = null; state.score += 1;
      if (state.labelSolved.size === state.items[state.index].hotspots.length) state.locked = true;
      renderPictureLabels();
    }
    output.className = `challenge-feedback ${correct ? 'positive' : 'negative'}`;
    output.textContent = correct ? t('labelPlaced', { word: point.item.terms[state.back] }) : t('tryAnotherMarker');
    effects.animate(correct ? byId('challenge-options').querySelector('.play-stage') : marker, correct ? 'correct' : 'wrong');
    effects.play(correct ? 'correct' : 'wrong');
    if (state.locked) prepareNext();
  }

  function answerTyping(event) {
    event.preventDefault();
    const state = challenge;
    if (!state || !['typing', 'missing', 'listenType'].includes(state.mode) || state.locked) return;
    const input = byId('typing-answer');
    if (!input.value.trim()) { byId('challenge-feedback').textContent = t('enterAnswer'); return; }
    const expected = state.mode === 'missing' ? state.missing.answer : state.items[state.index].terms[state.back];
    evaluateSpelling(input.value, input, expected);
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

  function renderMemory(focusIndex = null) {
    const state = challenge;
    if (!state || state.mode !== 'memory') return;
    const round = state.memory;
    const options = byId('challenge-options');
    options.replaceChildren();
    byId('challenge-progress').textContent = t('matchedCount', { count: round.matched.size, total: state.items.length });
    byId('challenge-meter').max = state.items.length;
    byId('challenge-meter').value = round.matched.size;
    byId('challenge-score').textContent = t('memoryAttempts', { count: round.attempts });
    round.cards.forEach((card, index) => {
      const matched = round.matched.has(card.itemId);
      const visible = matched || round.revealed.includes(index);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'memory-card';
      button.dataset.memoryIndex = String(index);
      button.disabled = matched;
      if (round.pending && !matched) button.setAttribute('aria-disabled', 'true');
      if (visible) {
        button.classList.add(matched ? 'matched' : 'revealed');
        const number = document.createElement('span'); number.className = 'visually-hidden';
        number.textContent = t('memoryCardNumber', { number: index + 1 });
        const side = document.createElement('span'); side.className = 'memory-side';
        side.textContent = t(card.side === 'front' ? 'memoryFront' : 'memoryBack');
        const term = document.createElement('span'); term.className = 'memory-term';
        setTerm(term, card.term, card.language);
        button.append(number, side, term);
      } else {
        const back = document.createElement('span'); back.className = 'memory-back'; back.textContent = '?';
        back.setAttribute('aria-hidden', 'true'); button.append(back);
        button.setAttribute('aria-label', t('memoryFaceDown', { number: index + 1 }));
      }
      button.addEventListener('click', () => chooseMemory(index));
      options.append(button);
    });
    if (!state.locked && focusIndex !== false) {
      const nextIndex = focusIndex === null
        ? round.cards.findIndex(card => !round.matched.has(card.itemId)) : focusIndex;
      options.querySelector(`[data-memory-index="${nextIndex}"]`)?.focus();
    }
  }

  function chooseMemory(index) {
    const state = challenge;
    if (!state || state.mode !== 'memory' || state.locked) return;
    const round = state.memory;
    const result = games.memoryTurn(round, index);
    if (result === 'ignored') return;
    if (result === 'match') state.score = round.matched.size;
    if (round.matched.size === state.items.length) state.locked = true;
    renderMemory(result === 'match' ? null : index);
    const output = byId('challenge-feedback');
    output.className = `challenge-feedback ${result === 'match' ? 'positive' : result === 'mismatch' ? 'negative' : ''}`;
    output.textContent = t(result === 'first' ? 'memoryChooseSecond'
      : result === 'match' ? 'memoryPairFound' : 'memoryMismatch');
    const button = byId('challenge-options').querySelector(`[data-memory-index="${index}"]`);
    effects.animate(button, result === 'mismatch' ? 'wrong' : 'card');
    if (result !== 'first') effects.play(result === 'match' ? 'correct' : 'wrong');
    if (result === 'mismatch') {
      round.timer = setTimeout(() => {
        if (challenge !== state || !games.memoryCover(round)) return;
        round.timer = null;
        const focused = byId('challenge-options').contains(document.activeElement)
          ? Number(document.activeElement.dataset.memoryIndex) : false;
        renderMemory(focused);
        output.className = 'challenge-feedback';
        output.textContent = t('memoryTryAgain');
      }, 950);
    }
    if (state.locked) {
      byId('challenge-next').hidden = false;
      byId('challenge-next').textContent = t('seeResults');
      byId('challenge-next').focus();
    }
  }

  function renderMatching() {
    const state = challenge;
    const round = state.rounds[state.roundIndex];
    state.matched = new Set(); state.selectedFront = null; state.selectedBack = null;
    byId('challenge-progress').textContent = t('roundCount', { current: state.roundIndex + 1, total: state.rounds.length });
    byId('challenge-meter').max = state.rounds.length;
    byId('challenge-meter').value = state.roundIndex + 1;
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
    media.stop();
    if (['wordSearch', 'crossword', 'memory'].includes(state.mode)) { finishChallenge(); return; }
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
    media.stop();
    byId('challenge-options').replaceChildren();
    byId('challenge-media').replaceChildren();
    byId('typing-form').hidden = true;
    byId('challenge-next').hidden = true;
    byId('challenge-progress').textContent = '';
    byId('challenge-prompt').textContent = t('roundComplete');
    byId('challenge-prompt').removeAttribute('lang'); byId('challenge-prompt').removeAttribute('dir');
    byId('challenge-feedback').className = 'challenge-feedback positive';
    byId('challenge-feedback').textContent = state.mode === 'memory'
      ? t('memoryResults', { count: state.items.length, attempts: state.memory.attempts })
      : state.mode === 'matching'
      ? t('matchResults', { attempts: state.attempts })
      : t('finalScore', { score: state.score, total: state.mode === 'pictureLabels' ? state.labelTotal : state.items.length });
    byId('challenge-score').textContent = '';
    effects.animate(byId('challenge-prompt'), 'correct');
    effects.play('complete');
    challenge = null;
  }

  async function initialize() {
    await restoreCache();
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
    byId('import-trigger').addEventListener('click', () => byId('import-file').click());
    byId('import-file').addEventListener('change', importLibrary);
    byId('start-cards').addEventListener('click', startDeck);
    for (const id of ['front-language', 'back-language', 'game-mode']) {
      byId(id).addEventListener('change', () => { resetDeck(); renderReadiness(); });
    }
    byId('sound-toggle').addEventListener('click', () => {
      effects.setMuted(!effects.isMuted()); updateSoundButton();
    });
    byId('typing-form').addEventListener('submit', answerTyping);
    byId('challenge-area').addEventListener('keydown', event => {
      if (!challenge || challenge.mode !== 'guess' || challenge.locked || event.altKey || event.ctrlKey || event.metaKey ||
          ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
      const letter = games.answerKey(event.key, challenge.back);
      const button = [...byId('challenge-options').querySelectorAll('[data-guess-key]')]
        .find(candidate => candidate.dataset.guessKey === letter && !candidate.disabled);
      if (button) { event.preventDefault(); button.click(); }
    });
    byId('challenge-next').addEventListener('click', nextChallenge);
    byId('reveal-card').addEventListener('click', revealCard);
    byId('next-card').addEventListener('click', nextCard);
    byId('flashcard').addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); revealCard(); }
    });
    byId('play-card-front').addEventListener('click', () => playCardAudio('front-language'));
    byId('play-card-back').addEventListener('click', () => playCardAudio('back-language'));
    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  }
  initialize();
})();

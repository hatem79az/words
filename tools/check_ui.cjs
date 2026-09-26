// Optional development check: jsdom provides a DOM, not native layout/audio/dragging.
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const model = require('../js/model.js');
const path = require('node:path');
const repo = path.resolve(__dirname, '..');
const tick = () => new Promise(resolve => setImmediate(resolve));
const errors = [];
process.on('unhandledRejection', error => errors.push(error));

function fixture(title = 'Audit lesson') {
  const lesson = model.createLesson(title);
  const terms = { en: ['cart', 'coat', 'tact', 'tart'], pl: ['kawa', 'woda', 'takt', 'kota'],
    ar: ['كتاب', 'قطة', 'كلب', 'باب'], de: ['Rast', 'Tast', 'Takt', 'Ast'] };
  lesson.categories = ['a','b'].map(id => ({id, names:{ en:id, pl:id, ar:id, de:id }}));
  const assets = {};
  lesson.items = Array.from({length:4}, (_,i) => {
    const item = model.createItem();
    for (const lang of model.LANGUAGES) {
      item.terms[lang] = terms[lang][i];
      item.sentences[lang] = [terms[lang][i], terms[lang][i], `${terms[lang][i]}!`];
      item.completionGaps[lang] = 2;
      item.media.audio[lang] = `audio${i}${lang}`;
      assets[`audio${i}${lang}`] = {mime:'audio/mpeg',data:`data:audio/mpeg;base64,${Buffer.from(`clip${i}${lang}`).toString('base64')}`};
    }
    item.categoryId = i < 2 ? 'a' : 'b';
    item.media.image = `image${i}`;
    assets[`image${i}`] = {mime:'image/webp',data:`data:image/webp;base64,${Buffer.from(`image${i}`).toString('base64')}`};
    return item;
  });
  lesson.items[0].media.hotspots = [{itemId:lesson.items[0].id,x:.2,y:.2},{itemId:lesson.items[1].id,x:.8,y:.8}];
  return model.saveLesson(model.newCollection(),lesson,assets);
}

async function setup(collection=fixture()) {
  const console = new VirtualConsole(); console.on('jsdomError', error => errors.push(error));
  const dom = new JSDOM(fs.readFileSync(path.join(repo,'index.html'),'utf8'), {
    url:'https://words.test/', runScripts:'outside-only', pretendToBeVisual:true, virtualConsole:console
  });
  const w = dom.window;
  w.structuredClone = structuredClone; w.TextEncoder = TextEncoder;
  w.confirm = () => true; w.matchMedia = () => ({matches:true});
  for (const file of ['model','i18n','games','effects','media','progress']) w.eval(fs.readFileSync(path.join(repo,`js/${file}.js`),'utf8'));
  let saved = structuredClone(collection), pending = [], slow = false, played;
  w.WordsStorage = { load: async()=>saved, save(value) {
    saved=structuredClone(value); return slow ? new Promise(resolve=>pending.push(resolve)) : Promise.resolve(true);
  }};
  w.WordsEffects.play=()=>{};
  w.WordsMedia.stop=()=>{}; w.WordsMedia.play=asset=>{played=asset;};
  let puzzle, memory;
  for (const fn of ['generateWordSearch','createMemoryRound']) {
    const original=w.WordsGames[fn]; w.WordsGames[fn]=(...args)=> {
      const result=original(...args); if(fn==='generateWordSearch')puzzle=result;else memory=result;return result;
    };
  }
  const $=selector=>w.document.querySelector(selector), $$=selector=>[...w.document.querySelectorAll(selector)];
  const fire=(node,type)=>node.dispatchEvent(new w.Event(type,{bubbles:true,cancelable:true}));
  const select=(id,value)=>{$(id).value=value;fire($(id),'change');};
  const fill=(node,value)=>{node.value=value;fire(node,'input');};
  const submit=()=>fire($('#lesson-form'),'submit');
  w.eval(fs.readFileSync(path.join(repo,'js/app.js'),'utf8'));
  await tick();
  return {w,dom,$,$$,fire,select,fill,submit, get saved(){return saved;}, get played(){return played;},
    get puzzle(){return puzzle;},get memory(){return memory;}, delay(){slow=true;},
    async release(){slow=false;pending.splice(0).forEach(resolve=>resolve(true));await tick();},
    async import(value) {
      const text=JSON.stringify(value);
      Object.defineProperty($('#import-file'),'files',{configurable:true,value:[{size:Buffer.byteLength(text),text:async()=>text}]});
      fire($('#import-file'),'change');await tick();
    }
  };
}

async function activities() {
  const a=await setup(); const {$,$$,w}=a;
  const lesson=a.saved.lessons[0];let completed=0,gated=0;
  for(const [ui,front,back] of [['en','en','pl'],['pl','ar','de'],['ar','de','ar'],['de','pl','en']]) {
    a.select('#ui-language',ui);a.select('#front-language',front);a.select('#back-language',back);
    for(const mode of $$('#game-mode option').map(o=>o.value)) {
      a.select('#game-mode',mode);$('#start-cards').click();
      if(mode!=='flashcards' && $('#challenge-area').hidden) {assert.equal(back,'ar');assert.ok(['wordSearch','crossword'].includes(mode));gated++;continue;}
      const before=w.WordsProgress.load(w.localStorage).length;
      let count=0;
      while((mode==='flashcards'&&!$('#card-area').hidden)||(mode!=='flashcards'&&!$('#challenge-area').classList.contains('round-finished'))) {
        assert.ok(++count<100,`${ui} ${mode} failed to finish`);
        const findItem=()=>lesson.items.find(i=>i.terms[front]===$('#challenge-prompt').textContent);
        if(mode==='flashcards') {$('#reveal-card').click();assert.equal($('#card-answer').hidden,false);$('#next-card').click();continue;}
        if(!$('#challenge-next').hidden){$('#challenge-next').click();continue;}
        if(['quiz','picture','listening'].includes(mode)) {
          let item=findItem();
          if(mode==='picture')item=lesson.items.find(i=>a.saved.assets[i.media.image].data===$('.question-picture').src);
          if(mode==='listening'){$('.listen-button').click();item=lesson.items.find(i=>a.saved.assets[i.media.audio[front]].data===a.played.data);}
          $$('.quiz-options button').find(b=>b.dataset.itemId===item.id).click();
        } else if(['typing','missing','listenType','sentenceCompletion'].includes(mode)) {
          let item=findItem(),answer;
          if(mode==='listenType'){$('.listen-button').click();item=lesson.items.find(i=>a.saved.assets[i.media.audio[back]].data===a.played.data);}
          if(mode==='sentenceCompletion'){item=lesson.items.find(i=>i.sentences[front].join(' ')===$('#challenge-prompt').textContent);answer=w.WordsGames.completionParts(item,back).answer;}
          else if(mode==='missing'){
            const pattern=w.WordsGames.spellingClusters(item.terms[back],back);
            const displayed=Array.from(new Intl.Segmenter(back,{granularity:'grapheme'}).segment($('.spelling-pattern').textContent),p=>p.segment);
            answer=pattern.filter((_,i)=>displayed[i]==='□').join('');
          } else answer=item.terms[back];
          a.fill($('#typing-answer'),answer);a.fire($('#typing-form'),'submit');
        } else if(['tiles','sentenceOrder'].includes(mode)) {
          const attr=mode==='tiles'?'tileId':'sentenceTileId';
          const ids=$$('.tile-tray button').map(b=>Number(b.dataset[attr])).sort((a,b)=>a-b);
          for(const id of ids)$$('.tile-tray button').find(b=>Number(b.dataset[attr])===id).click();
          $$('.tile-controls button').at(-1).click();
          assert.ok($$('.letter-tile').every(b=>b.disabled&&!b.draggable));
        } else if(mode==='guess') {
          const keys=new Set(w.WordsGames.spellingClusters(findItem().terms[back],back).map(s=>w.WordsGames.answerKey(s,back)));
          for(const key of keys)$$('.guess-key').find(b=>b.dataset.guessKey===key).click();
        } else if(mode==='trueFalse') {
          const values=$$('.true-false-term strong').map(n=>n.textContent);
          const correct=lesson.items.some(i=>i.terms[front]===values[0]&&i.terms[back]===values[1]);
          $$('.true-false-choices button')[correct?0:1].click();
        } else if(mode==='matching') {
          const frontButton=$('.match-column button:not(:disabled)');
          const id=frontButton.dataset.itemId;frontButton.click();
          $$('.match-column button:not(:disabled)').find(b=>b.dataset.itemId===id&&b.dataset.side==='back').click();
        } else if(mode==='memory') {
          const id=a.memory.cards.find(c=>!a.memory.matched.has(c.itemId)).itemId;
          const indexes=a.memory.cards.flatMap((c,i)=>c.itemId===id?[i]:[]);
          for(const index of indexes)$(`[data-memory-index="${index}"]`).click();
        } else if(mode==='categorySort') {
          $$('.category-sort-options button').find(b=>b.dataset.categoryId===findItem().categoryId).click();
        } else if(mode==='pictureLabels') {
          const label=$('.picture-label-choices button:not(:disabled)');
          const scene=lesson.items.find(i=>a.saved.assets[i.media.image].data===$('.play-stage img').src);
          const index=scene.media.hotspots.findIndex(p=>p.itemId===label.dataset.labelId);
          label.click();$$('.label-marker')[index].click();
        } else if(mode==='wordSearch') {
          for(const placement of a.puzzle.placements)for(const {row,col} of [placement.cells[0],placement.cells.at(-1)])$(`.search-cell[data-row="${row}"][data-col="${col}"]`).click();
        } else if(mode==='crossword') {
          const item=lesson.items.find(i=>i.terms[front]===$('.crossword-form label span').textContent);
          a.fill($('#crossword-answer'),item.terms[back]);a.fire($('.crossword-form'),'submit');
        } else throw Error(`Missing driver ${mode}`);
      }
      const history=w.WordsProgress.load(w.localStorage);
      assert.equal(history.length,before+1,`${ui} ${mode} progress`);
      assert.equal(history.at(-1).mode,mode);
      assert.ok(mode==='flashcards'||history.at(-1).score===history.at(-1).total,`${ui} ${mode} score`);
      assert.equal($('#progress-history strong').textContent,$('#game-mode').selectedOptions[0].textContent);
      completed++;
    }
  }
  assert.equal(errors.length,0,errors.map(e=>e.message).join('\n'));
  a.dom.window.close();console.log(`PASS ${completed} completed activity rounds across all four UI languages; ${gated} Arabic grid gates; progress labels and locked tiles`);
}

async function editor() {
  const a=await setup(fixture('X'.repeat(120)));const {$,w}=a;
  $('#duplicate-lesson').click();await tick();
  assert.equal(a.saved.lessons.length,2);assert.equal($('#lesson-name').value.length,120);
  assert.ok($('#lesson-name').value.endsWith('(copy)'));
  a.delay();$('#duplicate-lesson').click();
  const closing=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(closing);
  assert.equal(closing.defaultPrevented,true,'pending cache writes protect against closing');
  $('#new-lesson').click();a.fill($('#lesson-name'),'Keep my newer draft');
  await a.release();assert.equal($('#lesson-name').value,'Keep my newer draft');
  // Saving removes blank rows and their dropped media references from the editor.
  a.$$('.lesson-link')[0].click();
  const blank=a.$$('.item-row')[0];
  blank._media.hotspots=[];
  for(const input of blank.querySelectorAll('[data-language]'))a.fill(input,'');
  a.submit();await tick();assert.equal(a.$$('.item-row').length,3);
  a.fill(a.$$('.item-row')[0].querySelector('[data-language="en"]'),'Changed');
  a.submit();await tick();assert.equal($('#status').textContent,w.WordsI18n.strings.en.saved);
  // Slow deletion must not hide or clear a later new lesson.
  a.delay();$('#delete-lesson').click();$('#new-lesson').click();a.fill($('#lesson-name'),'After deletion');
  await a.release();assert.equal($('#editor').hidden,false);assert.equal($('#lesson-name').value,'After deletion');
  // Slow replacement imports must not reopen the first imported lesson after navigation.
  a.delay();await a.import(fixture('Replacement'));$('#new-lesson').click();a.fill($('#lesson-name'),'After import');
  await a.release();assert.equal($('#lesson-name').value,'After import');
  // Empty replacement clears detached lesson rows and running game state.
  a.$$('.lesson-link')[0].click();a.select('#game-mode','memory');$('#start-cards').click();
  await a.import(model.newCollection());assert.equal(a.$$('.item-row').length,0);assert.equal($('#challenge-area').hidden,true);
  assert.equal(errors.length,0,errors.map(e=>e.message).join('\n'));
  a.dom.window.close();console.log('PASS editor title limit, media/blank-row save, delayed duplicate/delete/import navigation, and empty import reset');
}

async function dragging() {
  const a=await setup(); const {$,$$,w}=a;
  const ids=()=>$$('.tile-assembly button').map(b=>Number(b.dataset.dragTileId));
  const drag=(source,target,x=0,y=0)=>{
    const data=new Map();const transfer={setData:(k,v)=>data.set(k,v),getData:k=>data.get(k)};
    const send=(node,type)=>{
      const event=new w.Event(type,{bubbles:true,cancelable:true});
      Object.assign(event,{dataTransfer:transfer,clientX:x,clientY:y});node.dispatchEvent(event);
    };
    send(source,'dragstart');send(target,'dragover');send(target,'drop');send(source,'dragend');
  };
  const rects=(rtl,wrapped=false)=>{
    $$('.tile-assembly button').forEach((button,i)=>{
      const x=rtl?200-i*60:20+i*60;
      // The first tile is lifted by CSS hover; all three are still on one flex row.
      const y=wrapped&&i===2?100:i===0?17:20;
      button.getBoundingClientRect=()=>({left:x,right:x+50,top:y,bottom:y+52});
    });
  };
  for(const mode of ['tiles','sentenceOrder'])for(const back of ['pl','ar']) {
    a.select('#back-language',back);a.select('#game-mode',mode);$('#start-cards').click();
    const source=id=>$$('.tile-tray button').find(b=>b.dataset.dragTileId===String(id));
    drag(source(0),$('.tile-assembly'));assert.deepEqual(ids(),[0]);
    // Establish the partial answer, then supply row geometry for the simulated drag.
    $$('.tile-controls button')[0].click();source(0).click();source(1).click();
    rects(back==='ar');
    drag(source(2),$('.tile-assembly'),back==='ar'?180:70,35);
    assert.deepEqual(ids(),[0,2,1],`${mode} ${back} insert between lifted tiles`);
    rects(back==='ar',true);
    drag($$('.tile-assembly button')[0],$('.tile-assembly'),back==='ar'?0:300,120);
    assert.deepEqual(ids(),[2,1,0],`${mode} ${back} wrapped reorder`);
    drag($$('.tile-assembly button')[1],$('.tile-tray'));
    assert.deepEqual(ids(),[2,0]);assert.equal(source(1).disabled,false);
    // Completing an answer locks both tray and assembly against further drag events.
    $$('.tile-controls button')[0].click();
    const all=$$('.tile-tray button').map(b=>Number(b.dataset.dragTileId)).sort((a,b)=>a-b);
    for(const id of all)source(id).click();
    $$('.tile-controls button').at(-1).click();
    const before=ids();drag($$('.tile-assembly button')[0],$('.tile-tray'));
    assert.deepEqual(ids(),before);
  }
  a.dom.window.close();console.log('PASS synthetic drag add, hover-shift insertion, wrapped reorder, return, repeated chunks, and lock in LTR/RTL');
}

async function failures() {
  const a=await setup();const {$,w}=a;
  a.select('#game-mode','tiles');$('#start-cards').click();
  a.select('#ui-language','ar');
  assert.equal($('#challenge-area').hidden,true);
  assert.equal($('#practice-message').textContent,w.WordsI18n.strings.ar.practiceLanguageChanged);
  a.select('#ui-language','en');
  w.WordsStorage.save=async()=>false;
  a.fill($('#lesson-name'),'Still usable');a.submit();await tick();
  assert.equal($('#status').textContent,w.WordsI18n.strings.en.storageFull);
  w.WordsProgress.save=()=>false;
  a.select('#game-mode','flashcards');$('#start-cards').click();
  for(let i=0;i<4;i++)$('#next-card').click();
  assert.equal($('#progress-history strong').textContent,w.WordsI18n.strings.en.flashcards);
  assert.equal($('#status').textContent,w.WordsI18n.strings.en.progressStorageUnavailable);
  // Teacher-authored dollar sequences must be displayed literally in answer feedback.
  const row=a.$$('.item-row')[0];a.fill(row.querySelector('[data-language="pl"]'),'$&');a.submit();await tick();
  a.select('#game-mode','typing');$('#start-cards').click();
  let checked=false;
  for(let i=0;i<4;i++){
    const isTarget=$('#challenge-prompt').textContent===row.querySelector('[data-language="en"]').value;
    a.fill($('#typing-answer'),'wrong');a.fire($('#typing-form'),'submit');a.fire($('#typing-form'),'submit');
    if(isTarget){assert.equal($('#challenge-feedback').textContent,'The answer is $&.');checked=true;}
    $('#challenge-next').click();
  }
  assert.ok(checked);
  // An attachment pending on a deleted lesson must never alter the next draft.
  let complete;
  w.WordsMedia.importImage=()=>new Promise(resolve=>{complete=resolve;});
  const file=$('input[type="file"][id^="image-"]');
  Object.defineProperty(file,'files',{value:[{name:'slow.png'}]});a.fire(file,'change');
  const closing=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(closing);assert.ok(closing.defaultPrevented);
  $('#delete-lesson').click();$('#new-lesson').click();
  complete({mime:'image/webp',data:'data:image/webp;base64,UklGRg=='});await tick();
  assert.equal($('.item-row')._media.image,null);
  assert.equal(errors.length,0,errors.map(e=>e.message).join('\n'));
  a.dom.window.close();console.log('PASS failed collection/progress storage, literal answer interpolation, and delayed discarded attachments');
}

(async()=>{await activities();await editor();await dragging();await failures();})().catch(error=>{console.error(error);process.exitCode=1;});

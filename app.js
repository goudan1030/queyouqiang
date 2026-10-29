(() => {
  'use strict';
  const { dialects, sounds, categories, genders, groups, filterSounds } = window.MJCatalog;
  const $ = id => document.getElementById(id);
  const paths = {
    play:'<path d="m8 5 11 7-11 7Z"/>', pause:'<path d="M9 5v14M15 5v14"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>', sort:'<path d="M8 4v16m-3-3 3 3 3-3M16 20V4m-3 3 3-3 3 3"/>',
    previous:'<path d="M5 5v14m14-14L8 12l11 7Z"/>',next:'<path d="M19 5v14M5 5l11 7-11 7Z"/>',
    shuffle:'<path d="m18 3 3 3-3 3m0 6 3 3-3 3M3 6h3c5 0 7 12 12 12h3M3 18h3c2 0 4-2 5-4m2-4c1-2 3-4 5-4h3"/>',
    loop:'<path d="m16 2 4 4-4 4M4 11V9a3 3 0 0 1 3-3h13M8 22l-4-4 4-4m12-1v2a3 3 0 0 1-3 3H4"/>',
    volume:'<path d="m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',mute:'<path d="m11 4-6 5H2v6h3l6 5Zm5 5 6 6m0-6-6 6"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.play}</svg>`;
  document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
  const valid = new Set(sounds.map(s => s.id));
  function readList(key) { try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value.filter(id => valid.has(id)) : []; } catch { return []; } }
  const escape = value => String(value || '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state = {group:'voice',dialect:'all',gender:'all',category:'全部音效',query:'',view:'all',sort:'default',favorites:readList('mj-favorites'),recent:readList('mj-recent'),current:null,playing:false,loading:false};
  const audio = new Audio(); audio.preload = 'auto'; audio.volume = .8;
  const warmed = new Set();
  let warmQueue=[], warming=false;
  function warmVisible(){warmQueue=list.slice(Math.max(0,visibleLimit-30),Math.max(0,visibleLimit-30)+6).map(s=>'/miniprogram'+s.file).filter(url=>!warmed.has(url));drainWarmQueue();}
  async function drainWarmQueue(){if(warming||!warmQueue.length)return;warming=true;const url=warmQueue.shift();warmed.add(url);try{const result=await fetch(url,{cache:'force-cache'});if(!result.ok)throw new Error('audio');await result.arrayBuffer();}catch(_){warmed.delete(url);}finally{warming=false;drainWarmQueue();}}
  let visibleLimit=30, list = [], request = 0, toastTimer, lastVolume = .8;
  const format = value => {value = Math.max(0,Math.floor(value || 0));return Math.floor(value/60)+':'+String(value%60).padStart(2,'0');};
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'),2200); }
  function persist(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch { toast('设备存储不可用，本次记录未保存'); } }
  function render(reset=false) {
    if(reset)visibleLimit=30;
    list = filterSounds(state);
    const group=groups.find(g=>g.id===state.group);
    $('group-list').innerHTML=groups.map(g=>`<button class="group-option ${state.group===g.id?'active':''}" data-group="${g.id}" aria-pressed="${state.group===g.id}">${g.name}</button>`).join('');
    $('dialect-list').innerHTML=dialects.filter(d=>d.id!=='effects').map(d=>`<button class="role-choice ${state.dialect===d.id?'active':''}" data-dialect="${d.id}" aria-pressed="${state.dialect===d.id}">${d.name}</button>`).join('');
    $('gender-tabs').innerHTML=genders.filter(g=>g.id!=='none'||state.group==='tiles').map(g=>`<button class="gender-option ${state.gender===g.id?'active':''}" data-gender="${g.id}" aria-pressed="${state.gender===g.id}">${g.id==='none'?'提示音效':g.name}</button>`).join('');
    $('voice-filters').hidden=state.group==='effects';
    $('filter-done').textContent=`查看 ${list.length} 个声音`;
    $('load-more').hidden=list.length<=visibleLimit;
    $('load-more').textContent=`继续加载 · 已显示 ${Math.min(visibleLimit,list.length)} / ${list.length}`;
    $('category-tabs').innerHTML = ['全部音效',...group.categories].map(c => `<button class="category-tab ${state.category===c?'active':''}" data-category="${c}" aria-pressed="${state.category===c}">${c==='全部音效'?'全部内容':c}</button>`).join('');
    const dialect = dialects.find(d => d.id === state.dialect);
    $('favorite-count').textContent = state.favorites.length;
    document.querySelectorAll('[data-view]').forEach(el => {el.classList.toggle('active',el.dataset.view===state.view);el.setAttribute('aria-pressed',String(el.dataset.view===state.view));});
    $('sound-grid').innerHTML = list.slice(0,visibleLimit).map(s => {
      s={...s,title:escape(s.title),text:escape(s.text),note:escape(s.note)};
      const active = state.current?.id===s.id && state.playing, favorite = state.favorites.includes(s.id);
      return `<article class="sound-card ${active?'is-playing':''}" data-sound="${s.id}"><button class="card-favorite ${favorite?'favorited':''}" data-favorite="${s.id}" aria-label="${favorite?'取消收藏':'收藏'}${s.dialectName}${s.title}" aria-pressed="${favorite}">${icon('heart')}</button><button class="card-play" data-play="${s.id}" aria-label="${active?'暂停':'试听'}${s.dialectName}${s.title}"><div class="card-top"><span class="card-tile" style="color:${s.color}">${s.glyph}</span></div><div class="card-title">${s.text || s.title}</div><p class="card-note"><span class="category-badge">${s.category}</span></p><div class="card-bottom"><span class="dialect-tag" style="color:${s.color}">${s.dialectName}</span><span class="duration-label">${s.durationLabel}</span><span class="waveform" aria-hidden="true">${'<i></i>'.repeat(11)}</span><span class="card-play-icon">${icon(active?'pause':'play')}</span></div></button>${s.variants.length>1?`<label class="variant-picker">版本<select data-variant="${s.id}" aria-label="${s.title}音频版本">${s.variants.map((v,i)=>`<option value="${i}" ${state.current?.id===s.id && state.current.variantKey===v.variantKey?'selected':''}>${v.variantLabel} · ${v.durationLabel}</option>`).join('')}</select></label>`:''}</article>`;
    }).join('');
    $('empty-state').hidden = !!list.length;
    if (!list.length) {
      $('empty-title').textContent = !dialect.available?dialect.name+'，等一声地道乡音':state.query?'没有找到这一声':state.view==='favorites'?'这里还没有收藏':state.view==='recent'?'还没听过这一声':'这个分类暂时没有音效';
      $('empty-message').textContent = !dialect.available?'这个方言还在等待授权录音，先听听其他家乡话吧。':state.query?'试试“碰”“自摸”，或换个角色找找。':state.view==='favorites'?'点击卡片上的爱心，把喜欢的声音留在这里。':state.view==='recent'?'播放过的音效会出现在这里，方便下次再听。':'换一个分类，听听其他好腔调。';
    }
    updatePlayer();warmVisible();
  }
  function updatePlayer() {
    const s = state.current;
    $('player-glyph').textContent = s?.glyph || '听';
    $('player-title').textContent = s?.title || '好腔调，等你来听';
    $('player-meta').textContent = s ? `${s.dialectName} · ${s.durationLabel} · 原声` : '选一张音效卡片，开启你的牌桌';
    $('main-play').innerHTML = icon(state.playing?'pause':'play');
    $('main-play').setAttribute('aria-label',state.playing?'暂停':'播放');
    $('player-status').textContent = state.loading?'正在加载…':state.playing?'乡音响起，快乐开桌':s?'再听一声家乡话':'等一声乡音';
    const fav = !!s && state.favorites.includes(s.id);
    $('player-favorite').innerHTML = icon('heart');
    $('player-favorite').disabled = !s;
    $('player-favorite').classList.toggle('is-active',fav);
    $('player-favorite').setAttribute('aria-label',fav?'取消收藏当前音效':'收藏当前音效');
    $('player-favorite').setAttribute('aria-pressed',String(fav));
  }
  function favorite(id) {
    if (!id) return;
    const existed = state.favorites.includes(id);
    state.favorites = existed?state.favorites.filter(v=>v!==id):[...state.favorites,id];
    persist('mj-favorites',state.favorites); render(); toast(existed?'已取消收藏':'已收藏这一声乡音');
  }
  function updateProgress() { const duration = Number.isFinite(audio.duration)?audio.duration:0; $('elapsed').textContent = format(audio.currentTime);$('duration').textContent = format(Math.ceil(duration));$('progress').value = duration?audio.currentTime/duration*100:0; }
  async function start() {
    const token = ++request; state.loading = true; updatePlayer();
    try { await audio.play(); if (token!==request) return; state.loading=false; }
    catch (error) { if (token!==request) return;state.loading=false;state.playing=false; if (error.name!=='AbortError') toast('声音没有加载成功，请点击重试');render(); }
    updatePlayer();
  }
  function play(sound, restart=false) {
    if (!sound) return;
    if (state.current?.file===sound.file && !restart) { togglePlay(); return; }
    ++request;audio.pause();state.current = sound;state.playing=false;
    audio.src = '/miniprogram'+sound.file;updateProgress();render();start();
  }
  function togglePlay() { if (!state.current) { random();return; } if (!audio.paused) {++request;state.loading=false;audio.pause();} else start(); }
  function random() { if (!list.length) {toast('当前没有可播放的音效');return;} const candidates = list.filter(s=>s.id!==state.current?.id);const pool = candidates.length?candidates:list;play(pool[Math.floor(Math.random()*pool.length)],true); }
  function step(direction) { if (!list.length) {toast('当前没有可播放的音效');return;}const index = list.findIndex(s=>s.id===state.current?.id);play(list[index===-1?0:(index+direction+list.length)%list.length],true); }
  audio.addEventListener('play',() => {
    state.playing=true;state.loading=false;
    if (state.current) {state.recent=[state.current.id,...state.recent.filter(id=>id!==state.current.id)].slice(0,50);persist('mj-recent',state.recent);}
    render();
  });
  audio.addEventListener('pause',() => {state.playing=false;render();});
  audio.addEventListener('ended',() => {state.playing=false;audio.currentTime=0;updateProgress();render();});
  audio.addEventListener('timeupdate',updateProgress); audio.addEventListener('loadedmetadata',updateProgress);
  audio.addEventListener('error',() => {state.loading=false;state.playing=false;render();});
  $('sound-grid').addEventListener('click',e => {const fav=e.target.closest('[data-favorite]');if(fav){favorite(fav.dataset.favorite);return;}const button=e.target.closest('[data-play]');if(button){const sound=sounds.find(s=>s.id===button.dataset.play);play(state.current?.id===sound.id?state.current:sound);}});
  $('group-list').addEventListener('click',e=>{const b=e.target.closest('[data-group]');if(b){Object.assign(state,{group:b.dataset.group,dialect:'all',gender:'all',category:'全部音效'});render(true);}});
  const filterDialog=$('filter-dialog');
  $('filter-trigger').addEventListener('click',()=>filterDialog.showModal());
  $('filter-close').addEventListener('click',()=>filterDialog.close());
  $('filter-done').addEventListener('click',()=>filterDialog.close());
  $('filter-reset').addEventListener('click',()=>{Object.assign(state,{dialect:'all',gender:'all',category:'全部音效'});render(true);});
  filterDialog.addEventListener('click',e=>{if(e.target===filterDialog)filterDialog.close();});
  $('load-more').addEventListener('click',()=>{visibleLimit+=30;render();});
  $('sound-grid').addEventListener('change',e=>{if(!e.target.dataset.variant)return;const sound=sounds.find(s=>s.id===e.target.dataset.variant);play({...sound,...sound.variants[Number(e.target.value)]},true);});
  $('gender-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-gender]');if(b){state.gender=b.dataset.gender;render(true);}});
  $('dialect-list').addEventListener('click',e => {const button=e.target.closest('[data-dialect]');if(button){state.dialect=button.dataset.dialect;render(true);}});
  $('category-tabs').addEventListener('click',e => {const button=e.target.closest('[data-category]');if(button){state.category=button.dataset.category;render(true);}});
  document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click',() => {state.view=el.dataset.view;render(true);}));
  $('search').addEventListener('input',e=>{state.query=e.target.value;render(true);});
  $('sort').addEventListener('change',e=>{state.sort=e.target.value;render(true);});
  $('reset-filters').addEventListener('click',()=>{Object.assign(state,{group:'voice',view:'all',query:'',dialect:'all',gender:'all',category:'全部音效'});$('search').value='';render();});
  $('hero-play').addEventListener('click',random);$('shuffle').addEventListener('click',random);$('main-play').addEventListener('click',togglePlay);$('next').addEventListener('click',()=>step(1));$('previous').addEventListener('click',()=>step(-1));
  $('player-favorite').addEventListener('click',()=>favorite(state.current?.id));
  $('loop').addEventListener('click',()=>{audio.loop=!audio.loop;$('loop').classList.toggle('is-active',audio.loop);$('loop').setAttribute('aria-pressed',String(audio.loop));toast(audio.loop?'已开启单条循环':'已关闭循环');});
  $('progress').addEventListener('input',e=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=Number(e.target.value)/100*audio.duration;});
  function volumeUI(){$('volume').value=audio.volume;$('mute').innerHTML=icon(audio.volume===0?'mute':'volume');$('mute').setAttribute('aria-label',audio.volume===0?'取消静音':'静音');}
  $('volume').addEventListener('input',e=>{audio.volume=Number(e.target.value);if(audio.volume)lastVolume=audio.volume;volumeUI();});
  $('mute').addEventListener('click',()=>{if(audio.volume){lastVolume=audio.volume;audio.volume=0;}else audio.volume=lastVolume;volumeUI();});
  const dialog = $('about-dialog');
  $('about-button').addEventListener('click',()=>dialog.showModal());$('collection-info').addEventListener('click',()=>dialog.showModal());
  function closeDialog(){dialog.close();}
  $('close-dialog').addEventListener('click',closeDialog);$('confirm-dialog').addEventListener('click',closeDialog);
  dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();});
  document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)||dialog.open||filterDialog.open)return;if(e.key==='/'){e.preventDefault();$('search').focus();}else if(e.code==='Space'){e.preventDefault();togglePlay();}});
  render();
})();

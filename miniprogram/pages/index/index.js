const { dialects, sounds, filterSounds, categories, genders, groups } = require('../../utils/catalog');
const loadPack = require('../../utils/load-pack');
const validIds = new Set(sounds.map(s => s.id));
function readList(key) {
  try { const list = wx.getStorageSync(key); return Array.isArray(list) ? list.filter(id => validIds.has(id)) : []; } catch (_) { return []; }
}
Page({
  data: {
    dialects: dialects.map(d => Object.assign({},d,{count:d.id === 'all' ? sounds.length : sounds.filter(s => s.dialect === d.id).length})),
    categories, genders, groups, group:'voice', filterOpen:false, groupCategories:['全部音效','聊天台词','角色试听'], filterSummary:'全部角色 · 全部内容', groupDescription:'聊天、调侃和角色台词，长句优先。', gender: 'all', hasMore: false, dialect: 'all', category: '全部音效', view: 'all', query: '', favorites: [], recent: [], sounds: [], count: 0,
    title: '四川麻将，原声上桌', current: null, playing: false, loading: false, loop: false, progress: 0, elapsed: '0:00', duration: '0:00', volume: 80, currentFavorite: false,
    emptyTitle: '', emptyMessage: '', about: false, sort: 'default'
  },
  onLoad() {
    this.loadedPacks = new Set(); this.packRequests = new Map(); this.playRequest = 0; this.visibleLimit = 30; this.warmQueue = []; this.warming = false;
    this.prepareShareCover();
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
    this.setData({ favorites: readList('mj-favorites'), recent: readList('mj-recent') });
    this.audio = wx.createInnerAudioContext();
    this.audio.obeyMuteSwitch = false;
    this.audio.volume = .8;
    this.audio.onPlay(() => { this.setData({ playing: true, loading: false }); this.remember(); });
    this.audio.onPause(() => this.setData({ playing: false }));
    this.audio.onStop(() => this.setData({ playing: false, progress: 0, elapsed: '0:00' }));
    this.audio.onEnded(() => this.setData({ playing: false, progress: 0, elapsed: '0:00' }));
    this.audio.onTimeUpdate(() => {
      const duration = this.audio.duration || 0;
      this.setData({ progress: duration ? this.audio.currentTime / duration * 100 : 0, elapsed: this.format(this.audio.currentTime), duration: this.format(Math.ceil(duration)) });
    });
    this.audio.onError(() => { this.setData({ playing: false, loading: false }); wx.showToast({ title: '声音没有加载成功，请重试', icon: 'none' }); });
    this.refresh();
  },
  onHide() { ++this.playRequest; this.setData({loading:false}); if (this.audio) this.audio.pause(); },
  onUnload() { ++this.playRequest; this.destroyed = true; if (this.audio) this.audio.destroy(); },
  onReachBottom() { this.loadMore(); },
  format(value) { value = Math.max(0,Math.floor(value || 0)); return Math.floor(value / 60) + ':' + String(value % 60).padStart(2,'0'); },
  save(key, value) { try { wx.setStorageSync(key, value); } catch (_) { wx.showToast({title:'设备存储不可用，本次记录未保存',icon:'none'}); } },
  refresh(reset = true) {
    if (reset) this.visibleLimit = 30;
    const items = filterSounds(this.data).map(s => Object.assign({},s,{favorite:this.data.favorites.includes(s.id)}));
    const d = dialects.find(d => d.id === this.data.dialect);
    const group = groups.find(g => g.id === this.data.group);
    const title = this.data.view === 'favorites' ? '我的收藏' : this.data.view === 'recent' ? '最近播放' : group.title;
    const filterSummary = (d.id === 'all' ? '全部角色' : d.name) + ' · ' + (this.data.category === '全部音效' ? '全部内容' : this.data.category) + (this.data.gender === 'all' ? '' : ' · ' + genders.find(g => g.id === this.data.gender).name);
    let emptyTitle = '没有找到这一声', emptyMessage = '试试“出牌”“干杯”，或换个角色找找。';
    if (this.data.view === 'favorites') { emptyTitle = '这里还没有收藏'; emptyMessage = '点击音效卡片的爱心，把喜欢的声音留在这里。'; }
    else if (this.data.view === 'recent') { emptyTitle = '还没听过这一声'; emptyMessage = '播放过的音效会留在这里，方便下次再听。'; }
    this.filteredSounds = items;
    this.setData({ sounds: items.slice(0,this.visibleLimit), hasMore: items.length > this.visibleLimit, count: items.length, title, filterSummary, groupDescription:group.description, groupCategories:['全部音效'].concat(group.categories), emptyTitle, emptyMessage, currentFavorite: !!this.data.current && this.data.favorites.includes(this.data.current.id) });
    this.warmVisible();
  },
  warmVisible() {
    const offset = Math.max(0,this.visibleLimit-30);
    this.warmQueue = Array.from(new Set((this.filteredSounds || []).slice(offset,offset+6).map(s=>s.pack))).filter(name=>!this.loadedPacks.has(name));
    this.drainWarmQueue();
  },
  drainWarmQueue() {
    if (this.warming || this.destroyed || !this.warmQueue.length) return;
    const name = this.warmQueue.shift(); this.warming = true;
    this.ensurePack(name).catch(()=>{}).then(()=>{this.warming=false;this.drainWarmQueue();});
  },
  selectGroup(e) { this.setData({group:e.currentTarget.dataset.id,dialect:'all',gender:'all',category:'全部音效'}); this.refresh(); },
  openFilters() { this.setData({filterOpen:true}); },
  closeFilters() { this.setData({filterOpen:false}); },
  resetFilters() { this.setData({dialect:'all',gender:'all',category:'全部音效'}); this.refresh(); },
  loadMore() { this.visibleLimit += 30; this.refresh(false); },
  selectGender(e) { this.setData({gender:e.currentTarget.dataset.id}); this.refresh(); },
  selectDialect(e) { this.setData({dialect:e.currentTarget.dataset.id}); this.refresh(); },
  selectCategory(e) { this.setData({category:e.currentTarget.dataset.category}); this.refresh(); },
  selectView(e) { this.setData({view:e.currentTarget.dataset.view}); this.refresh(); },
  search(e) { this.setData({query:e.detail.value}); this.refresh(); },
  clearSearch() { this.setData({query:''}); this.refresh(); },
  reset() { this.setData({group:'voice',dialect:'all',gender:'all',category:'全部音效',view:'all',query:''}); this.refresh(); },
  toggleSort() { this.setData({sort:this.data.sort === 'name' ? 'default' : 'name'}); this.refresh(); },
  playCard(e) {
    const sound = sounds.find(s => s.id === e.currentTarget.dataset.id);
    if (sound) this.play(this.data.current && this.data.current.id === sound.id ? this.data.current : sound);
  },
  chooseVariant(e) {
    const sound = sounds.find(s => s.id === e.currentTarget.dataset.id);
    if (!sound || sound.variants.length < 2) return;
    wx.showActionSheet({itemList:sound.variants.map(v => v.variantLabel+' · '+v.durationLabel),success:result => {
      this.play(Object.assign({},sound,sound.variants[result.tapIndex]),true);
    }});
  },
  ensurePack(name) {
    if (this.loadedPacks.has(name)) return Promise.resolve();
    if (this.packRequests.has(name)) return this.packRequests.get(name);
    const pending = loadPack(name);
    const tracked = pending.then(() => { this.loadedPacks.add(name); this.packRequests.delete(name); },error => { this.packRequests.delete(name); throw error; });
    this.packRequests.set(name,tracked);return tracked;
  },
  play(sound,restart=false) {
    if (!restart && this.data.current && sound.file === this.data.current.file) { this.togglePlay(); return; }
    ++this.playRequest; this.audio.stop();
    this.setData({current:sound,playing:false,loading:false,progress:0,elapsed:'0:00',duration:this.format(Math.ceil(sound.durationSeconds)),currentFavorite:this.data.favorites.includes(sound.id)});
    return this.start(true);
  },
  async start(restart=false) {
    const token = ++this.playRequest, sound = this.data.current;
    this.setData({loading:true});
    try {
      await this.ensurePack(sound.pack);
      if (token !== this.playRequest || this.destroyed) return;
      if (this.audio.src !== sound.file) this.audio.src = sound.file;
      else if (restart) this.audio.seek(0);
      this.audio.play();
    } catch (error) {
      console.error('音效包加载失败',sound.pack,error);
      if (token !== this.playRequest || this.destroyed) return;
      this.setData({loading:false,playing:false});
      wx.showToast({title:'音效包加载失败，请点击重试',icon:'none'});
    }
  },
  togglePlay() {
    if (!this.data.current) return this.randomPlay();
    if (this.data.playing || this.data.loading) { ++this.playRequest; this.setData({loading:false}); this.audio.pause(); }
    else return this.start();
  },
  randomPlay() {
    const list = this.filteredSounds || [];
    if (!list.length) { wx.showToast({title:'当前没有可播放的音效',icon:'none'}); return; }
    const candidates = list.filter(s => !this.data.current || s.id !== this.data.current.id);
    const pool = candidates.length ? candidates : list;
    return this.play(pool[Math.floor(Math.random()*pool.length)],true);
  },
  next() {
    const list = this.filteredSounds || [];
    if (!list.length) { wx.showToast({title:'当前没有可播放的音效',icon:'none'}); return; }
    const index = list.findIndex(s => this.data.current && s.id === this.data.current.id);
    return this.play(list[(index+1)%list.length],true);
  },
  toggleLoop() { this.setData({loop:!this.data.loop}); this.audio.loop = this.data.loop; wx.showToast({title:this.data.loop?'已开启单条循环':'已关闭循环',icon:'none'}); },
  seek(e) { if (this.audio.duration) this.audio.seek(e.detail.value / 100 * this.audio.duration); },
  changeVolume(e) { this.setData({volume:e.detail.value}); this.audio.volume = e.detail.value / 100; },
  remember() {
    if (!this.data.current) return;
    const recent = [this.data.current.id].concat(this.data.recent.filter(id => id !== this.data.current.id)).slice(0,50);
    this.setData({recent}); this.save('mj-recent',recent); if (this.data.view === 'recent') this.refresh(false);
  },
  favorite(e) {
    const id = e.currentTarget.dataset.id || (this.data.current && this.data.current.id);
    if (!id) return;
    const exists = this.data.favorites.includes(id);
    const favorites = exists ? this.data.favorites.filter(v => v !== id) : this.data.favorites.concat(id);
    this.setData({favorites}); this.save('mj-favorites',favorites); this.refresh();
    wx.showToast({title:exists?'已取消收藏':'已收藏这一声',icon:'none'});
  },
  showAbout() { this.setData({about:true}); },
  closeAbout() { this.setData({about:false}); },
  noop() {},
  prepareShareCover() {
    this.shareImage = '/assets/share-cover.png';
    this.shareCoverReady = new Promise(resolve=>{
      if (typeof wx.compressImage !== 'function') {resolve(this.shareImage);return;}
      wx.compressImage({src:'/assets/share-cover.png',quality:88,success:result=>{
        this.shareImage=result.tempFilePath;this.shareReady=true;
        resolve(this.shareImage);
      },fail:error=>{console.error('分享封面读取失败',error);resolve(this.shareImage);}});
    });
  },
  onShareAppMessage() {
    const share={title:'雀有腔 · 四川麻将原声上桌',path:'/pages/index/index',imageUrl:this.shareImage || '/assets/share-cover.png'};
    if(!this.shareReady && this.shareCoverReady)share.promise=this.shareCoverReady.then(imageUrl=>Object.assign({},share,{imageUrl,promise:undefined}));
    return share;
  },
  onShareTimeline() { return {title:'雀有腔 · 四川麻将原声',imageUrl:this.shareImage || '/assets/share-cover.png'}; }
});

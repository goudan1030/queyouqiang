const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const catalog=require('../miniprogram/utils/catalog');
const first=catalog.sounds[0];
const event=data=>({currentTarget:{dataset:data}});
const settle=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
function setup(initial={},defer=false,warm=false,compressImage){
 const store={...initial},events={},notices=[],loads=[];
 const audio={duration:10,currentTime:0,src:'',play(){events.play?.();},pause(){events.pause?.();},stop(){events.stop?.();},seek(n){this.currentTime=n;},destroy(){this.destroyed=true;}};
 for(const event of ['Play','Pause','Stop','Ended','TimeUpdate','Error'])audio['on'+event]=fn=>events[event.toLowerCase()]=fn;
 let config;
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/pages/index/index.js'),'utf8'),{require:path=>path.endsWith('load-pack')?name=>new Promise((resolve,reject)=>{loads.push({name,success:resolve,fail:reject});if(!defer)resolve();}):catalog,Page:p=>config=p,wx:{compressImage,showShareMenu(){},getStorageSync:key=>store[key],setStorageSync:(key,v)=>store[key]=v,createInnerAudioContext:()=>audio,showToast:v=>notices.push(v.title),loadSubpackage:options=>{loads.push(options);if(!defer)options.success();},showActionSheet:options=>options.success({tapIndex:1})}});
 const page={...config,data:JSON.parse(JSON.stringify(config.data)),setData(v){Object.assign(this.data,v);}};
 if(!warm)page.warmVisible=()=>{};
 page.onLoad();return {page,audio,events,store,notices,loads};
}
test('pagination, combined filters and favorites work with old storage',()=>{
 const {page,store}=setup({'mj-favorites':['obsolete',first.id]});
 assert.equal(page.data.favorites.length,1);assert.equal(page.data.sounds.length,30);assert.equal(page.data.count,187);
 page.loadMore();assert.equal(page.data.sounds.length,60);
 page.selectGender(event({id:'female'}));page.selectDialect(event({id:'sc_female'}));page.selectCategory(event({category:'聊天台词'}));
 assert.equal(page.data.count,33);assert.equal(page.data.sounds.length,30);
 page.selectView(event({view:'favorites'}));assert.equal(page.data.count,1);
 page.favorite(event({id:first.id}));assert.equal(page.data.count,0);assert.equal(store['mj-favorites'].length,0);
});
test('subpackage loads once, then playback, progress, pause, next and lifecycle work',async()=>{
 const {page,audio,events,store,loads}=setup();
 await page.play(first);assert.equal(audio.src,first.file);assert.equal(page.data.playing,true);assert.equal(store['mj-recent'][0],first.id);
 audio.currentTime=5;events.timeupdate();assert.equal(page.data.progress,50);
 page.togglePlay();assert.equal(page.data.playing,false);await page.togglePlay();assert.equal(page.data.playing,true);
 await page.next();assert.equal(audio.src,catalog.sounds[1].file);assert.equal(loads.length,2);
 await page.play(first,true);assert.equal(loads.length,2);
 page.toggleLoop();assert.equal(audio.loop,true);page.onHide();assert.equal(page.data.playing,false);page.onUnload();assert.equal(audio.destroyed,true);
});
test('failed package can retry; stale requests cannot override a new choice or start in background',async()=>{
 const {page,audio,loads,notices}=setup({},true);
 const task=page.play(first);loads[0].fail(new Error('offline'));await task;
 assert.equal(page.data.loading,false);assert.ok(notices.length);assert.equal(audio.src,'');
 const retry=page.togglePlay();assert.equal(loads.length,2);loads[1].success();await retry;assert.equal(audio.src,first.file);
 const other=catalog.sounds.find(s=>s.pack!==first.pack);
 const pending=page.play(other);await page.play(first,true);loads[2].success();await pending;assert.equal(audio.src,first.file);
 const third=catalog.sounds.find(s=>s.pack!==first.pack&&s.pack!==other.pack);
 const hidden=page.play(third);page.onHide();loads[3].success();await hidden;assert.equal(page.data.playing,false);assert.equal(page.data.loading,false);assert.equal(audio.src,first.file);
});
test('alternate versions play the selected media while retaining the same favorite ID',async()=>{
 const {page,audio}=setup();const sound=catalog.sounds.find(s=>s.variants.length>1);
 page.chooseVariant(event({id:sound.id}));await settle();assert.equal(audio.src,sound.variants[1].file);assert.equal(page.data.current.id,sound.id);
 page.playCard(event({id:sound.id}));assert.equal(page.data.playing,false);
});
test('empty search, audio errors and corrupt storage recover cleanly',async()=>{
 const {page,audio,events,notices}=setup({'mj-favorites':'bad','mj-recent':{}});
 assert.equal(page.data.count,187);page.search({detail:{value:'无此台词xyz'}});page.randomPlay();assert.equal(audio.src,'');assert.ok(notices.length);
 page.reset();await page.play(first);events.error();assert.equal(page.data.loading,false);assert.equal(page.data.playing,false);
});

test('changing the library removes stale filters and excludes tile calls from voices',()=>{
 const {page}=setup();page.selectGender(event({id:'female'}));page.selectCategory(event({category:'聊天台词'}));
 page.selectGroup(event({id:'tiles'}));assert.equal(page.data.count,327);assert.equal(page.data.gender,'all');assert.equal(page.data.category,'全部音效');
 assert.ok(page.data.sounds.every(s=>['麻将报牌','对局音效'].includes(s.category)));
 page.selectGroup(event({id:'effects'}));assert.equal(page.data.count,89);
 page.selectGroup(event({id:'voice'}));assert.equal(page.data.count,187);assert.ok(page.data.sounds.every(s=>s.category==='聊天台词'));
 page.openFilters();assert.equal(page.data.filterOpen,true);page.closeFilters();assert.equal(page.data.filterOpen,false);
});

test('visible dialogue packages warm before a tap and share the pending load',async()=>{
 const {page,audio,loads}=setup({},true,true);
 assert.equal(loads.length,1);assert.equal(audio.src,'');assert.equal(page.data.current,null);
 const playing=page.play(first);assert.equal(loads.length,1);
 loads[0].success();await playing;await settle();assert.equal(audio.src,first.file);
 assert.equal(loads.length,2);loads[1].success();await settle();assert.equal(loads.length,2);
 await page.play(catalog.sounds[1]);assert.equal(loads.length,2);assert.equal(page.data.playing,true);
});
test('friend sharing explicitly uses the packaged cover PNG',()=>{
 const {page}=setup();const share=page.onShareAppMessage();
 assert.equal(share.imageUrl,'/assets/share-cover.png');assert.equal(share.path,'/pages/index/index');
 const png=fs.readFileSync(require('node:path').join(__dirname,'../miniprogram',share.imageUrl));
 assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1000);assert.equal(png.readUInt32BE(20),800);
 assert.equal(page.onShareTimeline().imageUrl,share.imageUrl);
});

test('sharing waits for the temporary cover and then uses it synchronously',async()=>{
 let complete;const {page}=setup({},false,false,options=>complete=options.success);
 const waiting=page.onShareAppMessage();assert.ok(waiting.promise);
 complete({tempFilePath:'wxfile://tmp/share-cover.jpg'});
 const ready=await waiting.promise;assert.equal(ready.imageUrl,'wxfile://tmp/share-cover.jpg');
 assert.equal(page.onShareAppMessage().imageUrl,ready.imageUrl);assert.equal(page.onShareAppMessage().promise,undefined);
 assert.equal(page.onShareTimeline().imageUrl,ready.imageUrl);
});

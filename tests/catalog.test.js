const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {dialects,sounds,filterSounds,categories,packs}=require('../miniprogram/utils/catalog');
const base=path.join(__dirname,'../miniprogram');
test('all 883 originals and 858 unique source recordings remain represented',()=>{
  assert.equal(sounds.length,603);
  assert.equal(new Set(sounds.map(s=>s.id)).size,603);
  assert.equal(sounds.reduce((sum,s)=>sum+s.sourceCount,0),883);
  assert.equal(new Set(sounds.flatMap(s=>s.sourcePaths)).size,883);
  const files=new Map();
  for(const s of sounds){
    assert.equal(s.source,'蜀山四川麻将原声');
    assert.ok(s.variants.length);
    for(const v of s.variants){
      assert.match(v.sha256,/^[a-f0-9]{64}$/);
      assert.ok(v.bytes>0);
      assert.ok(v.durationSeconds>0);
      assert.ok(packs.some(p=>p.name===v.pack&&v.file.startsWith('/'+p.root+'/')));
      files.set(v.sourceSha256,v.file);
    }
  }
  assert.equal(files.size,858);
  assert.equal(new Set(files.values()).size,858);
  assert.equal(fs.existsSync(path.join(base,'audio')),false);
});
const mediaFiles=[...new Set(sounds.flatMap(s=>s.variants.map(v=>v.file)))];
const presentMedia=mediaFiles.filter(file=>fs.existsSync(path.join(base,file))).length;
test('local recordings match their catalog hashes and sizes',{
  skip:presentMedia===0 && process.env.REQUIRE_AUDIO!=='1' ? 'Third-party audio is intentionally excluded from the public repository' : false
},()=>{
  assert.equal(presentMedia,mediaFiles.length,'Complete authorized local audio is required');
  for(const s of sounds)for(const v of s.variants){
    const bytes=fs.readFileSync(path.join(base,v.file));
    assert.equal(bytes.toString('ascii',4,8),'ftyp');
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),v.sha256);
    assert.equal(bytes.length,v.bytes);
  }
});
test('each declared package is below 2 MB, with a small main package',()=>{
  const app=JSON.parse(fs.readFileSync(path.join(base,'app.json')));
  const size=dir=>fs.readdirSync(dir,{withFileTypes:true}).reduce((n,f)=>n+(f.isDirectory()?size(path.join(dir,f.name)):fs.statSync(path.join(dir,f.name)).size),0);
  assert.equal(app.subPackages.length,15);
  for(const p of packs){assert.ok(size(path.join(base,p.root))<2*1024*1024,p.name);assert.ok(app.subPackages.some(v=>v.name===p.name&&v.root===p.root));}
  assert.ok(size(base)-size(path.join(base,'packs'))<2*1024*1024);
  assert.ok(size(base)<20*1024*1024);
});
test('content, role, gender and text filters compose; chats appear first',()=>{
  assert.equal(sounds[0].category,'聊天台词');
  assert.equal(filterSounds({category:'聊天台词'}).length,172);
  assert.equal(filterSounds({category:'聊天台词',dialect:'sc_female',gender:'female'}).length,33);
  assert.equal(filterSounds({dialect:'sc_female',gender:'male'}).length,0);
  assert.equal(filterSounds({gender:'none',category:'背景音乐'}).length,9);
  assert.ok(filterSounds({query:'清一色',dialect:'sc_male'}).length);
  assert.ok(filterSounds({query:'game_playerInfo/ganbei3'}).length);
  assert.equal(filterSounds({query:'无此台词xyz'}).length,0);
  assert.equal(dialects.length,7);assert.equal(categories.length,9);
});
test('favorites and recent keep only current entries and preserve recent order',()=>{
  const ids=[sounds[33].id,sounds[0].id];
  assert.deepEqual(filterSounds({view:'recent',recent:['obsolete',...ids]}).map(s=>s.id),ids);
  assert.deepEqual(filterSounds({view:'favorites',favorites:['obsolete',sounds[0].id]}).map(s=>s.id),[sounds[0].id]);
});

test('voice, tile and effect libraries are separate and cover every sound',()=>{
 const voice=filterSounds({group:'voice'}),tiles=filterSounds({group:'tiles'}),effects=filterSounds({group:'effects'});
 assert.equal(voice.length,187);assert.equal(tiles.length,327);assert.equal(effects.length,89);
 assert.ok(voice.every(s=>['聊天台词','角色试听'].includes(s.category)));
 assert.ok(tiles.every(s=>['麻将报牌','对局音效'].includes(s.category)));
 assert.equal(new Set([...voice,...tiles,...effects].map(s=>s.id)).size,603);
 assert.ok(voice[0].text.length>=20);
});

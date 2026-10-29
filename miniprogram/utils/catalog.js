(function(root,factory){
  const data=typeof module==='object'&&module.exports?factory(require('./shushan')):factory(root.MJShushan);
  if(typeof module==='object'&&module.exports)module.exports=data;else root.MJCatalog=data;
})(typeof globalThis!=='undefined'?globalThis:this,function(data){
  const {sounds,categories,genders}=data;
  const groups=[{id:'voice',name:'人声台词',title:'听一段牌桌闲聊',description:'聊天、调侃和角色台词，长句优先。',categories:['聊天台词','角色试听']},{id:'tiles',name:'牌型报牌',title:'报牌、碰杠胡，单独听',description:'麻将报牌、花式叫牌和对局提示。',categories:['麻将报牌','对局音效']},{id:'effects',name:'音效音乐',title:'牌桌音效与背景音乐',description:'互动、界面、活动音效与背景音乐。',categories:['互动音效','界面音效','活动音效','背景音乐']}];
  function filterSounds(options){
    options=options||{};const query=(options.query||'').trim().toLowerCase();
    const group=groups.find(g=>g.id===options.group);
    let result=sounds.filter(s=>(!group||group.categories.includes(s.category))&&(!options.dialect||options.dialect==='all'||s.dialect===options.dialect)&&(!options.gender||options.gender==='all'||s.gender===options.gender)&&(!options.category||options.category==='全部音效'||s.category===options.category)&&(!query||[s.title,s.text,s.note,s.dialectName,s.category,...s.sourceNames].join(' ').toLowerCase().includes(query)));
    if(options.view==='favorites')result=result.filter(s=>(options.favorites||[]).includes(s.id));
    if(options.view==='recent')result=(options.recent||[]).map(id=>result.find(s=>s.id===id)).filter(Boolean);
    if(options.sort==='name')result.sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
    return result;
  }
  return {groups,dialects:data.profiles,genders,sounds,categories,filterSounds,sourceName:data.sourceName,originalCount:data.originalCount,packs:data.packs};
});

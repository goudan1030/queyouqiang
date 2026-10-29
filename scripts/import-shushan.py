"""Import all supplied Shushan audio, preserving variants and exact source provenance."""
import argparse,collections,csv,hashlib,json,re,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'data').mkdir(exist_ok=True)
parser=argparse.ArgumentParser()
parser.add_argument('source',type=Path)
args=parser.parse_args()
source=args.source.resolve()
rows=list(csv.DictReader((source/'音频清单.csv').open(encoding='utf-8-sig')))
transcript_path=ROOT/'data/shushan-transcripts.json'
transcripts=json.loads(transcript_path.read_text()) if transcript_path.exists() else {}
corrections=json.loads((ROOT/'data/shushan-text-corrections.json').read_text()) if (ROOT/'data/shushan-text-corrections.json').exists() else {}
stage=ROOT/'.import-stage';stage.mkdir(exist_ok=True)
converted=stage/'converted';converted.mkdir(exist_ok=True)
profiles={
 'sc_female':{'id':'sc_female','name':'四川女声','en':'SICHUAN · FEMALE','short':'川','color':'#a84735','gender':'female'},
 'sc_male':{'id':'sc_male','name':'四川男声','en':'SICHUAN · MALE','short':'川','color':'#486a57','gender':'male'},
 'guozi':{'id':'guozi','name':'锅子哥哥','en':'GUOZI','short':'锅','color':'#aa7939','gender':'male'},
 'normal_female':{'id':'normal_female','name':'普通女声','en':'MANDARIN · FEMALE','short':'女','color':'#9d635c','gender':'female'},
 'normal_male':{'id':'normal_male','name':'普通男声','en':'MANDARIN · MALE','short':'男','color':'#617060','gender':'male'},
 'effects':{'id':'effects','name':'音效与音乐','en':'SFX & MUSIC','short':'音','color':'#8a7855','gender':'none'}
}
categories=['全部音效','聊天台词','麻将报牌','角色试听','对局音效','互动音效','界面音效','活动音效','背景音乐']
roles=[]
for row in rows:
 p=Path(row['文件路径']);parts=p.parts
 role='guozi' if '锅子哥哥' in parts else ('sc_' if '四川话' in parts else 'normal_' if '普通话' in parts else '')+('female' if '女声' in parts else 'male')
 if role not in profiles:role='effects'
 row['_role']=role
 if row['分类']=='02_聊天短句':family='talk_box' if '资源组_talk_box' in parts else 'talk';category='聊天台词'
 elif row['分类']=='01_麻将报牌' and role!='effects':family='card';category='麻将报牌'
 elif row['分类']=='03_试玩语音':family='trial';category='角色试听'
 elif row['分类']=='04_背景音乐':family='music';category='背景音乐'
 else:
  family='effect';raw=row['原始资源名称'].lower()
  if 'game_playerinfo/' in raw:category='互动音效'
  elif any(x in raw for x in ['button','click','select','toggle','anniu','qiehuan','icon_show','icon_hide']):category='界面音效'
  elif 'scmj_sound/main/' in raw or 'scmj_sound/effect/' in raw or 'common_game/' in raw or '/tgcf/' in raw:category='对局音效'
  else:category='活动音效'
 row['_category']=category;row['_family']=family
 row['_key']=role+'|'+family+'|'+(p.stem if role!='effects' else row['原始资源名称'])

unique={}
for row in rows:
 key=row['SHA256'];file=source/row['文件路径']
 if key in unique:continue
 if hashlib.sha256(file.read_bytes()).hexdigest()!=key:raise RuntimeError('Source checksum mismatch: '+str(file))
 target=converted/(key+'.m4a')
 if not target.exists():
  music=row['_category']=='背景音乐';speech=row['_role']!='effects'
  subprocess.run(['/usr/bin/afconvert','-f','m4af','-d','aac@32000' if music else 'aac@24000','-c','2' if music else '1','-b','64000' if music else '24000' if speech else '48000',str(file),str(target)],check=True,stdout=subprocess.DEVNULL)
 if not target.stat().st_size:raise RuntimeError('Empty converted file: '+str(file))
 unique[key]={'source':row,'file':target,'bytes':target.stat().st_size,'hash':hashlib.sha256(target.read_bytes()).hexdigest()}
 if len(unique)%100==0:print('Converted',len(unique),'unique audio files',flush=True)

# Assign assets to packages below 1.45 MiB, leaving room for their page/config files.
pack_groups=collections.defaultdict(list)
for key,item in unique.items():
 row=item['source'];group='music' if row['_category']=='背景音乐' else ('voice_'+row['_role'] if row['_family'] in ['talk','talk_box','trial'] else 'tiles_'+row['_role'] if row['_family']=='card' else row['_role'])
 pack_groups[group].append((key,item))
packs=[]
if (stage/'packs').exists():shutil.rmtree(stage/'packs')
for group,items in sorted(pack_groups.items()):
 batch=1;size=0;pack=None
 for key,item in sorted(items,key=lambda x:x[0]):
  if pack is None or size+item['bytes']>1450000:
   name='shushan_'+group+'_'+str(batch);batch+=1
   pack={'name':name,'root':'packs/'+name,'pages':['index'],'bytes':0};packs.append(pack);size=0
  directory=stage/pack['root']/'audio';directory.mkdir(parents=True,exist_ok=True)
  filename=key[:24]+'-'+item['hash'][:8]+'.m4a';destination=directory/filename
  shutil.copyfile(item['file'],destination)
  item['pack']=pack['name'];item['publicFile']='/'+pack['root']+'/audio/'+filename
  size+=item['bytes'];pack['bytes']=size
for pack in packs:
 directory=stage/pack['root']
 (directory/'ready.js').write_text('module.exports = true;\n')
 (directory/'index.js').write_text("Page({onLoad(){wx.redirectTo({url:'/pages/index/index'});}});\n")
 (directory/'index.wxml').write_text('<view>正在返回语音广场…</view>\n')
 (directory/'index.json').write_text('{"navigationBarTitleText":"雀有腔"}\n')

number_names='零一二三四五六七八九'
def card_title(stem):
 m=re.match(r'(wan|tong|tiao)_(\d)(?:_(\d+))?$',stem)
 if m:
  title=number_names[int(m[2])]+{'wan':'万','tong':'筒','tiao':'条'}[m[1]]
  return title+(' · 花式'+m[3] if m[3] else '')
 if stem=='gang_1_gf':return '刮风'
 if stem=='gang_1_xy':return '下雨'
 if stem.startswith('hu_3'):return '自摸 · 花式'
 if stem.startswith('hu_2'):return '自摸'
 if stem.startswith('hu_1'):return '胡牌'
 if stem.startswith('peng'):return '碰牌'+(' · 花式'+stem.split('_')[1] if stem!='peng_1' else '')
 if stem.startswith('gang'):return '杠牌'+(' · '+stem.split('_',1)[1] if stem!='gang_1' else '')
 return stem.replace('_',' ')
words={'bgmhall':'大厅音乐','bgm_fly':'飞行活动音乐','bgm':'背景音乐','countdown_done':'倒计时结束','countdown':'倒计时','accel':'加速音效','qifu_result':'祈福开奖','anniu':'按钮音效','click':'点击音效','win':'胜利音效','lose':'失败音效','coin':'金币音效','gold':'金币音效','lobby':'大厅音乐','hall':'大厅音乐','game':'对局音乐','bomb':'炸弹音效','flower':'送花音效','egg':'鸡蛋音效','kiss':'亲吻音效','select':'选择音效'}
effect_names={
 'eff_chuPai':'出牌','eff_paihuadong':'牌面滑动','scmj_gangfen':'杠牌计分','scmj_misscard':'缺牌提示','scmj_wind':'刮风','scmj_rain':'下雨','scmj_changecard':'换牌','sfx_gang_wincoin':'杠牌赢金币','sfx_game_countdown2':'对局倒计时','sfx_start':'开局提示','sfx_game_graspcards':'抓牌','sfx_game_points':'对局计分',
 'sys_timer':'计时提醒','beam':'光束','floatingpoints':'飘分','game_dropkk':'落牌','game_lose':'对局失败','rainy':'下雨效果','windy_rainy':'刮风下雨','game_que':'定缺','change_finish':'换牌完成','game_handgive02':'发牌','game_handopenyakuman02':'亮牌','qiehuan':'界面切换','sys_buttonready':'准备按钮','sys_buttonagariready':'听牌准备','roulette_tally':'转盘结算','eff_textbasic':'文字提示','game_handselect':'选择手牌','ting':'听牌提示','game_droptpk':'落牌提示','eff_gamestart':'对局开始','sys_start':'开始提示','game_ndrop02':'摸牌','game_win':'对局胜利','game_paeslide03':'推牌','game_agaripae02':'胡牌效果',
 'resultFail':'结算失败','resultWin':'结算胜利','game_timer':'对局计时','xianhua':'鲜花','daodanjizhong':'导弹击中','drag_jianjiaoji':'尖叫鸡','emoji_brick':'板砖','kafei':'咖啡','sudashui':'苏打水','kachefashe':'卡车发射','kachejizhong':'卡车击中','jiguangqiang2':'激光枪 2','jiguangqiang3':'激光枪 3','emoji_bomb':'炸弹','daodanfashe':'导弹发射','drag_wdddz_xiuhuaxie':'绣花鞋','dianzan':'点赞','ak':'步枪','qinwenxinFive':'爱心亲吻','qinwenxinFly':'飞吻','drag_qinwen':'亲吻','huoguo':'火锅','paishou':'鼓掌','tuoxie':'拖鞋','bianbian':'便便','tenengsu':'特仑苏','ganbei':'干杯','ganbei1':'干杯 1','ganbei2':'干杯 2','ganbei3':'干杯 3',
 'qingshen':'请神','washCardCaishen':'财神洗牌','prayxcq':'祈福·许愿','hulu_sound':'葫芦','luckycome':'好运降临','wulucaishen':'五路财神','prayguangong1':'关公祈福','qingshen_result_win':'请神成功','prayshaoxiang2':'上香','praynj':'祈福·念经','qinshen_fapai':'请神发牌','mj_xipai':'麻将洗牌','washCard':'洗牌','prayUp':'祈福升起','praycaishenye13':'财神爷','prayqfxishou':'祈福洗手','qifu_result':'祈福开奖','qifu_yao':'祈福摇签','qifu_daji':'祈福大吉','Guoqingqifu':'国庆祈福','zadan':'砸蛋','sfx_takeoff':'起飞','sfx_explode':'爆炸','sfx_accel':'加速','sfx_countdown':'倒计时','sfx_countdown_done':'倒计时结束','entrance_card_bean':'入场豆','cast_gold_award':'金币奖励',
 'tgcf_anniu':'挑战按钮','tgcf_anniu02':'挑战按钮 2','tgcf_zjm':'挑战主界面'
}
def effect_title(row):
 stem=Path(row['文件路径']).stem
 if stem in effect_names:return effect_names[stem]
 for prefix,label in [('charm_','魅力互动'),('drawLots','求签'),('yasheng','压胜'),('tgcf_pofeng','破风'),('tgcf_beishu','挑战倍数')]:
  if stem.startswith(prefix):return label+' · '+stem[len(prefix):]
 for key,label in sorted(words.items(),key=lambda x:-len(x[0])):
  if key in stem.lower():return label+' · '+stem.replace('_',' ')
 return ('背景音乐' if row['_category']=='背景音乐' else '活动音效')+' · '+stem.replace('_',' ')

groups=collections.defaultdict(list)
for row in rows:groups[row['_key']].append(row)
items=[]
for key,members in groups.items():
 members.sort(key=lambda r:-int(r['字节数']))
 row=members[0];profile=profiles[row['_role']];stem=Path(row['文件路径']).stem
 variants=[];seen=set()
 for variant in members:
  raw_hash=variant['SHA256']
  if raw_hash in seen:continue
  seen.add(raw_hash);media=unique[raw_hash]
  group=next((p.replace('资源组_','') for p in Path(variant['文件路径']).parts if p.startswith('资源组_')),'原声')
  label={'game':'对局版','mahjong':'基础版','talk':'牌桌版','talk_box':'聊天版'}.get(group,group)
  duration=float(variant['时长秒'])
  variants.append({'file':media['publicFile'],'pack':media['pack'],'durationSeconds':duration,'durationLabel':str(max(1,round(duration,1)))+'秒','sourceSha256':raw_hash,'sha256':media['hash'],'bytes':media['bytes'],'sourcePath':variant['文件路径'],'variantLabel':label,'variantKey':raw_hash})
 transcript=corrections.get(row['文件路径'],transcripts.get(row['SHA256'],{}).get('text',''))
 if row['_category']=='聊天台词':title=transcript.strip('，。！？!?, ')[:16] or '牌桌聊天 · '+stem.replace('talk_','');text=transcript;glyph='聊';note='原声台词 · 文字仅供参考'
 elif row['_category']=='麻将报牌':title=card_title(stem);text='';glyph='萬' if stem.startswith('wan') else '筒' if stem.startswith('tong') else '条' if stem.startswith('tiao') else title[0];note='原声报牌 · '+stem
 elif row['_category']=='角色试听':title={'talk':'角色开场','card':'报牌试听','action':'动作试听'}.get(stem,stem);text='';glyph='声';note='游戏角色试听'
 else:title=effect_title(row);text='';glyph='乐' if row['_category']=='背景音乐' else '音';note=row['原始资源名称']
 item={'id':'ss-'+hashlib.sha256(key.encode()).hexdigest()[:16],'dialect':row['_role'],'dialectName':profile['name'],'gender':profile['gender'],'title':title,'text':text,'glyph':glyph,'category':row['_category'],'note':note,'color':profile['color'],'source':'蜀山四川麻将原声','sourcePaths':[v['文件路径'] for v in members],'sourceNames':[v['原始资源名称'] for v in members],'sourceCount':len(members),'variants':variants,**variants[0]}
 items.append(item)
items.sort(key=lambda x:(categories.index(x['category']),-len(x['text']) if x['category']=='聊天台词' else 0,list(profiles).index(x['dialect']),x['title']))
profile_list=[{'id':'all','name':'全部角色','en':'ALL VOICES','short':'全','color':'#a84735','available':True}]+[{**p,'available':True} for p in profiles.values()]
catalog={'sourceName':'蜀山四川麻将','originalCount':len(rows),'uniqueSourceCount':len(unique),'entryCount':len(items),'profiles':profile_list,'genders':[{'id':'all','name':'全部性别'},{'id':'female','name':'女声'},{'id':'male','name':'男声'},{'id':'none','name':'无人声'}],'categories':categories,'sounds':items,'packs':[{**p,'bytes':p['bytes']} for p in packs]}
(stage/'load-pack.js').write_text('const loaders = {\n'+',\n'.join("  '"+p['name']+"': () => require.async('../"+p['root']+"/ready.js')" for p in packs)+"\n};\nmodule.exports = name => loaders[name] ? loaders[name]() : Promise.reject(new Error('未知音效包'));\n")
(stage/'shushan.js').write_text('(function(root,data){if(typeof module==="object"&&module.exports)module.exports=data;else root.MJShushan=data;})(typeof globalThis!=="undefined"?globalThis:this,'+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+');\n')
report={'source':str(source),'originalCount':len(rows),'uniqueSourceCount':len(unique),'entryCount':len(items),'transcribedCount':sum(bool(x['text']) for x in items if x['category']=='聊天台词'),'packs':catalog['packs'],'categories':dict(collections.Counter(x['category'] for x in items)),'profiles':dict(collections.Counter(x['dialectName'] for x in items))}
(ROOT/'data/shushan-import-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
# Retain a complete source/variant index outside the shipped mini program.
with (ROOT/'data/shushan-inventory.csv').open('w',encoding='utf-8-sig',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=['分类','角色','性别','原始资源名称','文件路径','时长秒','SHA256','包内路径']);writer.writeheader()
 for row in rows:writer.writerow({'分类':row['_category'],'角色':profiles[row['_role']]['name'],'性别':profiles[row['_role']]['gender'],'原始资源名称':row['原始资源名称'],'文件路径':row['文件路径'],'时长秒':row['时长秒'],'SHA256':row['SHA256'],'包内路径':unique[row['SHA256']]['publicFile']})
print(json.dumps(report,ensure_ascii=False,indent=2),flush=True)

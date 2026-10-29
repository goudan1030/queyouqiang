"""Locally transcribe the supplied dialogue clips; no audio is uploaded."""
import argparse,csv,hashlib,json,subprocess,tempfile
from pathlib import Path
import mlx.core as mx
from mlx_audio.stt import load

parser=argparse.ArgumentParser()
parser.add_argument('source',type=Path)
parser.add_argument('--output',type=Path,default=Path('data/shushan-transcripts.json'))
args=parser.parse_args()
rows=list(csv.DictReader((args.source/'音频清单.csv').open(encoding='utf-8-sig')))
args.output.parent.mkdir(parents=True,exist_ok=True)
transcripts=json.loads(args.output.read_text()) if args.output.exists() else {}
model=load('mlx-community/Qwen3-ASR-0.6B-4bit')
selected=[r for r in rows if r['分类'] in ['02_聊天短句','03_试玩语音']]
selected.sort(key=lambda r:('普通话' not in r['文件路径'],r['文件路径']))
for n,row in enumerate(selected):
    key=row['SHA256']
    if key in transcripts:continue
    source=args.source/row['文件路径']
    if hashlib.sha256(source.read_bytes()).hexdigest()!=key:raise RuntimeError('Source checksum mismatch: '+str(source))
    with tempfile.TemporaryDirectory(prefix='shushan-asr-') as temp:
        wav=Path(temp)/'clip.wav'
        subprocess.run(['/usr/bin/afconvert','-f','WAVE','-d','LEI16@16000','-c','1',str(source),str(wav)],check=True,stdout=subprocess.DEVNULL)
        result=model.generate(str(wav),language='Chinese',max_tokens=100,temperature=0,verbose=False)
    text=result.text.strip()
    transcripts[key]={'text':text,'sourcePath':row['文件路径'],'method':'Qwen3-ASR-0.6B-4bit · 本地识别'}
    args.output.write_text(json.dumps(transcripts,ensure_ascii=False,indent=2)+'\n')
    print(str(n+1)+'/'+str(len(selected)),row['文件路径'],text,flush=True)
    mx.clear_cache()

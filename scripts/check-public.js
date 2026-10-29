// Inspect the index, so local ignored recordings are never read or uploaded.
const {execFileSync}=require('node:child_process');
const path=require('node:path');
const files=execFileSync('git',['ls-files','--stage','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const blocked=[];
for(const entry of files){
  const [info,file]=entry.split('\t');
  const [mode,sha]=info.split(' ');
  const ext=path.extname(file).toLowerCase();
  if(/\.(mp3|m4a|m4b|m4p|aac|wav|wave|ogg|oga|opus|flac|aif|aiff|wma|amr|caf|mid|midi|mp4|mov|webm|zip|7z|tar|gz)$/i.test(file)
    || /(^|\/)(audio|data|artifacts|\.import-stage|node_modules)(\/|$)/i.test(file)
    || /(^|\/)(project\.(private\.)?config\.json|\.env(?:\..*)?)$/.test(file)
    || ['.pem','.key'].includes(ext) || mode==='120000'){
    blocked.push(file);continue;
  }
  const bytes=execFileSync('git',['cat-file','blob',sha],{maxBuffer:16*1024*1024});
  const first=bytes.subarray(0,12).toString('ascii');
  if(first.startsWith('ID3') || first.startsWith('OggS') || first.startsWith('fLaC')
    || first.startsWith('RIFF') || first.startsWith('FORM') || first.startsWith('caff')
    || first.slice(4,8)==='ftyp' || (bytes[0]===0xff && (bytes[1]&0xe0)===0xe0))blocked.push(file);
}
if(blocked.length){console.error('Blocked public files:\n'+blocked.join('\n'));process.exit(1);}
if(!files.length){console.error('No staged/tracked files to inspect. Run git add first.');process.exit(1);}
console.log(`Public source audit passed: ${files.length} indexed files; no blocked media or private paths.`);

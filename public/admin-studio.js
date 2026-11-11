/* Artemis Game Content Studio — authenticated Admin-only authoring UI.
 * All writes use /api/admin/studio; game only reads /api/content-studio.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const slots=[10,20,30,40,50],actions=['idle','attack','hit','death'];
const counts={idle:6,attack:6,hit:4,death:6};
const speed={idle:170,attack:125,hit:95,death:145};
const state={items:[],biomes:[],img:null,cell:0,pngBase64:null,action:'idle',actionAt:0,
  mapRenderer:null,editorGame:null,selectedTab:'boss'};
function status(text,type='info'){
 const node=$('studioMessage');
 node.textContent=text;node.hidden=false;node.className='message '+(type==='error'?'error':type==='success'?'good':'');
}
async function request(payload=null){
 const options=payload?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}:{};
 const response=await fetch('/api/admin/studio',{...options,credentials:'same-origin',cache:'no-store'});
 let data;
 try{data=await response.json();}catch(_){throw Error('Máy chủ không trả JSON hợp lệ.');}
 if(!response.ok || !data.ok)throw Error(data.error||('HTTP '+response.status));
 return data;
}
function actionButton(name,kind,id,text){
 return '<button type="button" data-studio="'+esc(name)+'" data-kind="'+esc(kind)+'" data-id="'+esc(id)+'">'+esc(text)+'</button>';
}
function renderLists(){
 const list=state.items.filter(x=>x.kind==='boss');
 $('bossList').innerHTML=list.length?list.map(x=>'<div class="item"><div><strong>'+esc(x.draft?.name||x.published?.name||x.id)+'</strong>'+
 '<span class="pill '+(x.published?'live':'')+'">'+(x.published?'Published':'Draft')+'</span>'+
 '<small>'+esc(x.draft?.element||x.published?.element||'')+' · '+esc(x.id)+'</small></div><div class="actionrow">'+
 actionButton('preview','boss',x.id,'▶ Xem')+actionButton('publish','boss',x.id,'Publish')+'</div></div>').join(''):'<p class="hint">Chưa có boss được tạo.</p>';
 const maps=state.items.filter(x=>x.kind==='map');
 $('mapList').innerHTML=maps.length?maps.map(x=>'<div class="item"><div><strong>'+esc(x.draft?.name||x.published?.name||x.id)+'</strong>'+
 '<span class="pill '+(x.published?'live':'')+'">'+(x.published?'Published':'Draft')+'</span>'+
 '<small>Biome: '+esc(x.draft?.biome||x.published?.biome)+'</small></div><div class="actionrow">'+
 actionButton('edit','map',x.id,'Xem')+actionButton('publish','map',x.id,'Publish')+'</div></div>').join(''):'<p class="hint">Chưa có map tùy chỉnh.</p>';
 const assignments=state.items.filter(x=>x.kind==='assignment').sort((a,b)=>{
 const [ca,ra]=a.id.split(':').map(Number),[cb,rb]=b.id.split(':').map(Number);
 return ca-cb || ra-rb;
 });
 $('assignmentList').innerHTML=assignments.length?assignments.map(x=>{
 const a=x.published||x.draft||{};
 const boss=list.find(b=>b.id===a.bossId),map=maps.find(m=>m.id===a.mapId);
 return '<div class="item"><div><strong>Chương '+esc(a.chapter)+' · Ải '+esc(a.room)+'</strong> '+
 '<span class="pill '+(x.published?'live':'')+'">'+(x.published?'Published':'Draft')+'</span>'+
 '<small>Boss: '+esc(boss?.published?.name||boss?.draft?.name||'Mặc định')+
 ' · Map: '+esc(map?.published?.name||map?.draft?.name||'Mặc định')+'</small></div>'+
 '<div class="actionrow">'+actionButton('edit','assignment',x.id,'Chỉnh')+
 actionButton('publish','assignment',x.id,'Publish')+'</div></div>';
 }).join(''):'<p class="hint">Chưa có phân bổ nào được tạo.</p>';
 fillSelect('assignBoss',list,'Giữ boss mặc định');
 fillSelect('assignMap',maps,'Giữ biome mặc định');
}
function fillSelect(id,records,defaultLabel){
 const element=$(id),old=element.value;
 element.innerHTML='<option value="">'+esc(defaultLabel)+'</option>'+
 records.map(x=>'<option value="'+esc(x.id)+'">'+
 esc(x.draft?.name||x.published?.name||x.id)+(x.published?' ✔':' (Draft)')+'</option>').join('');
 if(records.some(x=>x.id===old))element.value=old;
}
async function loadAll(){
 const data=await request();
 state.items=data.items||[];state.biomes=data.biomes||[];
 const previous=$('mapBiome').value;
 $('mapBiome').innerHTML=state.biomes.map(id=>'<option value="'+esc(id)+'">'+esc(id)+'</option>').join('');
 if(state.biomes.includes(previous))$('mapBiome').value=previous;
 renderLists();
}
async function decodeImage(url,clear=true){
 const image=new Image();
 await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Ảnh không thể giải mã.'));image.src=url;});
 if(image.naturalWidth%6 || image.naturalHeight%4 || image.naturalWidth/6!==image.naturalHeight/4 ||
   image.naturalWidth/6<64 || image.naturalWidth/6>512)
   throw Error('Sprite bắt buộc 6 cột × 4 hàng, ô vuông từ 64 đến 512px.');
 if(clear)state.pngBase64=null;
 state.img=image;state.cell=image.naturalWidth/6;state.actionAt=performance.now();
 $('spriteInfo').textContent='Sprite '+image.naturalWidth+' × '+image.naturalHeight+
   ' · cell '+state.cell+'px · tổng 22 frame (6/6/4/6)';
}
async function atlasFile(file){
 if(!file)throw Error('Hãy chọn sprite PNG.');
 if(file.type!=='image/png' || file.size>1_200_000)throw Error('Chỉ nhận PNG nhỏ hơn 1,2MB.');
 const data=await new Promise((resolve,reject)=>{
   const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));
   reader.onerror=()=>reject(Error('Không đọc được file.'));reader.readAsDataURL(file);
 });
 const encoded=data.split(',')[1];
 await decodeImage(data,false);
 state.pngBase64=encoded;
 status('Đã đọc sprite. Chọn tên boss và lưu bản nháp.','success');
}
async function composeFrames(files){
 const expected={idle:6,attack:6,hit:4,death:6},found=new Map();
 for(const file of files){
   if(file.type!=='image/png')throw Error('Chỉ nhận frame PNG.');
   const match=/^(idle|attack|hit|death)[_\-\s]*(\d{1,2})\.png$/i.exec(file.name);
   if(!match)throw Error('Tên file cần dạng idle_01.png, attack_01.png, hit_01.png hoặc death_01.png: '+file.name);
   const action=match[1].toLowerCase(),idx=Number(match[2]);
   if(idx<1||idx>expected[action])throw Error('Frame ngoài phạm vi: '+file.name);
   const key=action+':'+idx;
   if(found.has(key))throw Error('Frame bị trùng: '+file.name);
   found.set(key,file);
 }
 const missing=[];
 for(const action of actions)for(let i=1;i<=expected[action];i++)
   if(!found.has(action+':'+i))missing.push(action+'_'+String(i).padStart(2,'0'));
 if(missing.length)throw Error('Thiếu frame: '+missing.join(', '));
 const canvas=document.createElement('canvas');canvas.width=1152;canvas.height=768;
 const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('Canvas 2D không được hỗ trợ.');
 for(let row=0;row<actions.length;row++){
   const action=actions[row];
   for(let i=1;i<=expected[action];i++){
     const file=found.get(action+':'+i);
     const url=URL.createObjectURL(file);
     try{
       const image=new Image();
       await new Promise((resolve,reject)=>{
         image.onload=resolve;image.onerror=()=>reject(Error('Frame lỗi: '+file.name));image.src=url;
       });
       const scale=Math.min(192/image.naturalWidth,192/image.naturalHeight);
       const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
       ctx.drawImage(image,(i-1)*192+(192-w)/2,row*192+192-h,w,h);
     }finally{URL.revokeObjectURL(url);}
   }
 }
 const data=canvas.toDataURL('image/png');
 await decodeImage(data,false);state.pngBase64=data.split(',')[1];
 if(state.pngBase64.length>1_600_000)throw Error('Atlas ghép lớn hơn 1,2MB. Hãy tối ưu ảnh đầu vào.');
 status('Đã ghép đủ 22 frame: Idle 6 / Attack 6 / Hit 4 / Death 6.','success');
}
function previewAction(action){
 if(!Object.hasOwn(counts,action))return;
 state.action=action;state.actionAt=performance.now();
 document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.action===action)));
}
async function saveBoss(){
 if(!state.pngBase64)throw Error('Hãy import ảnh PNG trước khi lưu.');
 const boss={name:$('bossName').value.trim(),element:$('bossElement').value.trim(),
   aiPreset:$('bossAI').value,color:$('bossColor').value,pngBase64:state.pngBase64};
 const data=await request({action:'saveBoss',boss});
 await loadAll();status('Đã tạo boss '+boss.name+' • '+data.id+' (Draft). Bấm Publish trong thư viện.','success');
}
async function saveMap(){
 const map={name:$('mapName').value.trim(),biome:$('mapBiome').value};
 const data=await request({action:'saveMap',map});
 await loadAll();status('Đã lưu map '+map.name+' • '+data.id+' (Draft).','success');
}
function fieldsForPlacement(){
 return {chapter:Number($('assignChapter').value),room:Number($('assignRoom').value),
  bossId:$('assignBoss').value||null,mapId:$('assignMap').value||null};
}
async function saveAssignment(publish){
 const assignment=fieldsForPlacement();
 const saved=await request({action:'saveAssignment',assignment});
 if(publish)await request({action:'publishAssignment',id:saved.id});
 await loadAll();
 status(publish?'Đã Publish. Trận mới sẽ nạp boss/map mới.':'Đã lưu vị trí nháp. Chưa ảnh hưởng game.','success');
}
async function resetAssignment(){
 const a=fieldsForPlacement();
 if(!confirm('Trả ải '+a.room+' Chương '+a.chapter+' về nội dung mặc định?'))return;
 await request({action:'clearAssignment',id:a.chapter+':'+a.room});
 await loadAll();status('Đã trả về boss và biome mặc định.','success');
}
async function published(kind,id){
 const action=kind==='boss'?'publishBoss':kind==='map'?'publishMap':'publishAssignment';
 await request({action,id});await loadAll();
 status('Đã Publish '+kind+' '+id+' thành công.','success');
}
async function showDraft(id){
 const item=state.items.find(x=>x.kind==='boss'&&x.id===id);
 if(!item)throw Error('Không có boss này.');
 await decodeImage('/api/admin/studio?asset='+encodeURIComponent(id)+'&t='+Date.now());
 $('bossName').value=item.draft?.name||'';
 $('bossElement').value=item.draft?.element||'';
 $('bossColor').value=item.draft?.color||'#fbbf24';
 $('bossAI').value=item.draft?.aiPreset||'golem';
 state.pngBase64=null; // Viewing is non-destructive; re-upload to create new boss.
 status('Đang xem bản nháp '+(item.draft?.name||id)+'. Muốn tạo bản mới hãy import ảnh.','success');
}
function editMap(id){
 const item=state.items.find(x=>x.kind==='map'&&x.id===id);
 if(!item)return;
 $('mapName').value=item.draft?.name||'';
 $('mapBiome').value=item.draft?.biome||state.biomes[0];
 drawMapPreview();
}
function editPlacement(id){
 const item=state.items.find(x=>x.kind==='assignment'&&x.id===id);
 if(!item)return;
 const a=item.draft||item.published;
 $('assignChapter').value=a.chapter;
 $('assignRoom').value=a.room;
 $('assignBoss').value=a.bossId||'';
 $('assignMap').value=a.mapId||'';
}
async function handleClick(button){
 const kind=button.dataset.kind,id=button.dataset.id,action=button.dataset.studio;
 if(action==='publish')return published(kind,id);
 if(action==='preview'&&kind==='boss')return showDraft(id);
 if(action==='edit'&&kind==='map'){editMap(id);return;}
 if(action==='edit'&&kind==='assignment'){editPlacement(id);return;}
}
function drawBossPreview(now){
 const c=$('bossCanvas'),ctx=c.getContext('2d');
 if(!ctx)return;
 ctx.clearRect(0,0,c.width,c.height);
 if(!state.img)return;
 const action=state.action,count=counts[action],elapsed=Math.max(0,now-state.actionAt);
 const duration=count*speed[action];
 const frame=Math.floor((action==='idle'?elapsed%(duration):elapsed%(duration+450))/speed[action]);
 const index=Math.min(count-1,frame),cell=state.cell;
 const size=250;
 ctx.drawImage(state.img,index*cell,actions.indexOf(action)*cell,cell,cell,
   (c.width-size)/2,(c.height-size)/2,size,size);
}
let mapTime=0;
function drawMapPreview(now=performance.now()){
 if(!window.ArtemisArenaRenderer)return;
 if(!state.mapRenderer){
   state.mapRenderer=window.ArtemisArenaRenderer.create();
 }
 const c=$('mapCanvas'),ctx=c.getContext('2d');if(!ctx)return;
 const biome=$('mapBiome').value||'stone';
 const game={chapter:{id:1},room:10,maxRooms:50,mode:'campaign',
   previewOnly:true,previewBiome:biome,width:780,height:420,wallPad:36,
   floorDecals:[],enemies:[],wallTorches:[],obstacles:[
     {x:145,y:120,w:40,h:34},{x:595,y:120,w:40,h:34},
     {x:145,y:295,w:40,h:34},{x:595,y:295,w:40,h:34}
   ],portalRect:{x:365,y:20,w:50,h:36},portalOpen:false,ultraGfx:false};
 try{
   state.mapRenderer.init(game);
   ctx.clearRect(0,0,c.width,c.height);
   state.mapRenderer.drawArena(ctx,780,420,36,now,1);
   $('mapInfo').textContent='Biomes từ renderer Artemis: '+biome+' • Vật cản trong preview là minh họa; khi Publish chỉ thay giao diện nền.';
 }catch(e){$('mapInfo').textContent='Không tạo được preview map: '+e.message;}
}
function animate(now){
 if(!document.hidden){
   if(state.selectedTab==='boss')drawBossPreview(now);
   if(state.selectedTab==='map'&&now-mapTime>=65){mapTime=now;drawMapPreview(now);}
 }
 requestAnimationFrame(animate);
}
function tab(name){
 state.selectedTab=name;
 document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===name)));
 document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active',s.id===name));
 if(name==='map')drawMapPreview();
}
function bind(){
 $('spriteAtlas').addEventListener('change',async e=>{
   try{await atlasFile(e.target.files?.[0]);}catch(err){status(err.message,'error');}
 });
 $('spriteFrames').addEventListener('change',async e=>{
   try{await composeFrames([...e.target.files]);}catch(err){status(err.message,'error');}
 });
 $('bossSave').onclick=()=>saveBoss().catch(e=>status(e.message,'error'));
 $('mapSave').onclick=()=>saveMap().catch(e=>status(e.message,'error'));
 $('assignSave').onclick=()=>saveAssignment(false).catch(e=>status(e.message,'error'));
 $('assignPublish').onclick=()=>saveAssignment(true).catch(e=>status(e.message,'error'));
 $('assignReset').onclick=()=>resetAssignment().catch(e=>status(e.message,'error'));
 $('bossRefresh').onclick=()=>loadAll().then(()=>status('Đã cập nhật thư viện.')).catch(e=>status(e.message,'error'));
 $('mapPreviewBtn').onclick=()=>drawMapPreview();
 $('mapBiome').onchange=()=>drawMapPreview();
 document.addEventListener('click',e=>{
   const b=e.target.closest('button');
   if(!b)return;
   if(b.dataset.tab)tab(b.dataset.tab);
   if(b.dataset.action)previewAction(b.dataset.action);
   if(b.dataset.studio)handleClick(b).catch(err=>status(err.message,'error'));
 });
 for(let i=1;i<=12;i++)$('assignChapter').add(new Option('Chương '+i,String(i)));
}
bind();
loadAll().catch(e=>status('Không thể tải Studio. Hãy đăng nhập tài khoản Admin. '+e.message,'error'));
requestAnimationFrame(animate);
})();

/* Artemis Content Studio domain contracts.
 * No game/save writes here. Draft content becomes public only after Publish.
 */
export const STUDIO_COLLECTION = 'content_studio';
export const BOSS_SLOTS = Object.freeze([10,20,30,40,50]);
export const CHAPTERS = 12;
export const MAX_PNG_BYTES = 1_200_000;
export const BIOMES = Object.freeze([
  'stone','forest','mine','swamp','crypt','lava','desert','ash',
  'canyon','void','crystal','ice','astral','temple','zodiac_leo',
  'zodiac_aries','zodiac_taurus','zodiac_gemini','zodiac_cancer',
  'zodiac_virgo','zodiac_libra','zodiac_scorpio','zodiac_sagittarius',
  'zodiac_capricorn','zodiac_aquarius','zodiac_pisces'
]);
const pngSignature = Buffer.from('89504e470d0a1a0a','hex');
const validId = id => typeof id === 'string' && /^[a-z0-9-]{5,64}$/.test(id);
const simpleText = (str, len = 80) => typeof str === 'string' && str.trim().length > 0 && str.trim().length <= len && !/[<>]/.test(str);
function problem(message) { return {ok:false,error:message}; }
export function cleanBoss(data) {
  if (!data || typeof data !== 'object') return problem('Thiếu dữ liệu boss.');
  if (!simpleText(data.name,80)) return problem('Tên boss phải có 1–80 ký tự.');
  if (!simpleText(data.element,30)) return problem('Hệ nguyên tố không hợp lệ.');
  if (!['golem','queen','demon_king','elder_dragon','zodiac_leo'].includes(data.aiPreset))
    return problem('Chọn một mẫu AI được hỗ trợ.');
  const color = /^#[0-9a-fA-F]{6}$/.test(data.color||'') ? data.color : '#fbbf24';
  const encoded = data.pngBase64;
  if (typeof encoded !== 'string' || encoded.length > Math.ceil(MAX_PNG_BYTES*4/3)+100 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length%4 !== 0)
    return problem('Sprite phải là PNG base64 hợp lệ (tối đa 1,2MB).');
  const png=Buffer.from(encoded,'base64');
  if (png.length<100 || png.length>MAX_PNG_BYTES || !png.subarray(0,8).equals(pngSignature))
    return problem('File không phải PNG hoặc vượt giới hạn kích thước.');
  if (png.toString('ascii',12,16)!=='IHDR') return problem('PNG thiếu header IHDR.');
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20),bits=png[24],colorType=png[25];
  if (bits!==8 || colorType!==6 || width%6!==0 || height%4!==0 ||
      width/6!==height/4 || width/6<64 || width/6>512)
    return problem('Cần spritesheet RGBA 6 cột × 4 hàng, các cell vuông 64–512px.');
  return {ok:true,data:{
    name:data.name.trim(),element:data.element.trim(),aiPreset:data.aiPreset,
    color, pngBase64:encoded,width,height,cell:width/6,
    counts:{idle:6,attack:6,hit:4,death:6},
    createdFrom:'admin-upload'
  }};
}
export function cleanMap(data) {
  if (!data || !simpleText(data.name,80)) return problem('Tên map phải có 1–80 ký tự.');
  if (!BIOMES.includes(data.biome)) return problem('Chọn biome có sẵn trong Artemis.');
  return {ok:true,data:{name:data.name.trim(),biome:data.biome,mode:'visual-theme'}};
}
export function cleanAssignment(data) {
  const chapter=Number(data?.chapter),room=Number(data?.room);
  if (!Number.isInteger(chapter)||chapter<1||chapter>CHAPTERS ||
      !BOSS_SLOTS.includes(room)) return problem('Bản đầu hỗ trợ chương 1–12 và ải boss 10/20/30/40/50.');
  if (data.bossId && !validId(data.bossId)) return problem('ID boss không hợp lệ.');
  if (data.mapId && !validId(data.mapId)) return problem('ID map không hợp lệ.');
  if (!data.bossId && !data.mapId) return problem('Chọn ít nhất một boss hoặc map.');
  return {ok:true,data:{chapter,room,bossId:data.bossId||null,mapId:data.mapId||null}};
}
export function studioId(kind) {
  if (kind!=='boss' && kind!=='map') throw Error('kind invalid');
  return kind + '-' + crypto.randomUUID();
}
export function isValidId(id){return validId(id);}
export function publicSummary(doc){
  const v=doc.published;
  if(!v)return null;
  if(doc.kind==='boss')
    return {id:doc.id,name:v.name,element:v.element,aiPreset:v.aiPreset,
      color:v.color,cell:v.cell,counts:v.counts,asset:'/api/content-studio?asset='+encodeURIComponent(doc.id)};
  if(doc.kind==='map') return {id:doc.id,name:v.name,biome:v.biome,mode:v.mode};
  return null;
}
export function adminSummary(doc){
  const brief=v=>v?Object.fromEntries(Object.entries(v).filter(([key])=>key!=='pngBase64')):null;
  return {kind:doc.kind,id:doc.id,version:doc.version||0,
    draft:brief(doc.draft),published:brief(doc.published)};
}

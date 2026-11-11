import { requireAdmin } from '../../lib/adminAuth.js';
import { getMongoDb } from '../../lib/mongo.js';
import { json, fail, readJsonBody } from '../../lib/http.js';
import {
  STUDIO_COLLECTION,cleanBoss,cleanMap,cleanAssignment,studioId,isValidId,adminSummary
} from '../../lib/contentStudio.js';

export const config={runtime:'nodejs'};
const col=async()=> (await getMongoDb()).collection(STUDIO_COLLECTION);
const allowed = new Set(['saveBoss','publishBoss','saveMap','publishMap',
  'saveAssignment','publishAssignment','clearAssignment']);
const record = async (c,kind,id)=>c.findOne({kind,id});

function originOk(request) {
  const origin=request.headers.get('origin');
  if(!origin) return true; // same-origin requests can omit Origin.
  const url=new URL(request.url);
  return origin===url.origin;
}
function pngResponse(data) {
  const bytes=Buffer.from(data,'base64');
  return new Response(bytes,{
    headers:{'content-type':'image/png','cache-control':'private, no-store',
      'x-content-type-options':'nosniff','content-length':String(bytes.length)}
  });
}
export async function GET(request) {
  const guard=await requireAdmin(request);
  if(!guard.ok)return guard.response;
  const c=await col();
  const url=new URL(request.url),asset=url.searchParams.get('asset');
  if(asset){
    if(!isValidId(asset))return fail('ID asset không hợp lệ.',400);
    const doc=await record(c,'boss',asset);
    if(!doc?.draft?.pngBase64)return fail('Không có sprite nháp.',404);
    return pngResponse(doc.draft.pngBase64);
  }
  const docs=await c.find({}).limit(500).toArray();
  return json({ok:true,items:docs.map(adminSummary),limit:500});
}
export async function POST(request) {
  const guard=await requireAdmin(request);
  if(!guard.ok)return guard.response;
  if(!originOk(request))return fail('Origin không hợp lệ.',403);
  const result=await readJsonBody(request,1_750_000);
  if(!result.ok)return fail(result.error,result.status);
  const {action}=result.data;
  if(!allowed.has(action))return fail('Thao tác Content Studio không hợp lệ.',400);
  const c=await col(), now=new Date().toISOString();
  if(action==='saveBoss'||action==='saveMap'){
    const kind=action==='saveBoss'?'boss':'map';
    const validation=kind==='boss'?cleanBoss(result.data.boss):cleanMap(result.data.map);
    if(!validation.ok)return fail(validation.error,400);
    let id=result.data.id;
    if(id&&!isValidId(id))return fail('ID nội dung không hợp lệ.',400);
    if(!id)id=studioId(kind);
    const existing=await record(c,kind,id);
    // Non-matching record kinds may never overwrite one another.
    if(existing?.kind!==undefined && existing.kind!==kind)return fail('ID đã được dùng.',409);
    await c.updateOne({kind,id},{$set:{
      kind,id,draft:validation.data,updatedAt:now,
      ...(existing?{}:{published:null,version:0,createdAt:now})
    },$inc:{version:1}},{upsert:!existing});
    return json({ok:true,id,kind,message:'Đã lưu bản nháp; chưa thay đổi production.'});
  }
  if(action==='publishBoss'||action==='publishMap'){
    const kind=action==='publishBoss'?'boss':'map';
    const id=result.data.id;
    if(!isValidId(id))return fail('ID không hợp lệ.',400);
    const doc=await record(c,kind,id);
    if(!doc?.draft)return fail('Chưa có bản nháp.',404);
    const update=await c.updateOne({kind,id,version:doc.version},{$set:{
      published:doc.draft,publishedAt:now,updatedAt:now
    },$inc:{version:1}});
    if(!update.matchedCount)return fail('Nội dung đã được sửa ở cửa sổ khác. Tải lại.',409);
    return json({ok:true,id,published:true});
  }
  if(action==='saveAssignment'){
    const valid=cleanAssignment(result.data.assignment);
    if(!valid.ok)return fail(valid.error,400);
    const a=valid.data,id=a.chapter+':'+a.room;
    if(a.bossId && !(await record(c,'boss',a.bossId)))return fail('Boss chưa có trong thư viện.',404);
    if(a.mapId && !(await record(c,'map',a.mapId)))return fail('Map chưa có trong thư viện.',404);
    const existing=await record(c,'assignment',id);
    await c.updateOne({kind:'assignment',id},{$set:{
      kind:'assignment',id,draft:a,updatedAt:now,...(existing?{}:{published:null,version:0,createdAt:now})
    },$inc:{version:1}},{upsert:!existing});
    return json({ok:true,id,message:'Đã lưu vị trí nháp. Hãy Publish để áp dụng.'});
  }
  if(action==='publishAssignment'){
    const id=String(result.data.id||'');
    if(!/^(?:[1-9]|1[0-2]):(?:10|20|30|40|50)$/.test(id))return fail('Vị trí không hợp lệ.',400);
    const doc=await record(c,'assignment',id);
    if(!doc?.draft)return fail('Chưa có vị trí nháp.',404);
    const {bossId,mapId}=doc.draft;
    if(bossId && !(await record(c,'boss',bossId))?.published)
      return fail('Phải Publish boss trước khi gắn vào chiến dịch.',409);
    if(mapId && !(await record(c,'map',mapId))?.published)
      return fail('Phải Publish map trước khi gắn vào chiến dịch.',409);
    const changed=await c.updateOne({kind:'assignment',id,version:doc.version},{$set:{
      published:doc.draft,publishedAt:now,updatedAt:now
    },$inc:{version:1}});
    if(!changed.matchedCount)return fail('Vị trí đã thay đổi. Tải lại.',409);
    return json({ok:true,id,published:true,message:'Đã Publish. Tải lại trận để nhận asset mới.'});
  }
  if(action==='clearAssignment'){
    const id=String(result.data.id||'');
    if(!/^(?:[1-9]|1[0-2]):(?:10|20|30|40|50)$/.test(id))return fail('Vị trí không hợp lệ.',400);
    await c.updateOne({kind:'assignment',id},{$set:{
      draft:null,published:null,updatedAt:now
    },$inc:{version:1}});
    return json({ok:true,id,message:'Đã trả về boss và biome mặc định.'});
  }
  return fail('Không hỗ trợ thao tác.',400);
}

/* Public read-only, published-only Content Studio manifest and sprite delivery.
 * Drafts, credentials and Mongo object IDs never leave the server.
 */
import { getMongoDb } from './mongo.js';
import { json,fail } from './http.js';
import { STUDIO_COLLECTION,publicSummary,isValidId } from './contentStudio.js';
export async function GET(request){
  const url=new URL(request.url);
  const c=(await getMongoDb()).collection(STUDIO_COLLECTION);
  const id=url.searchParams.get('asset');
  if(id!==null){
    if(!isValidId(id))return fail('ID sprite không hợp lệ.',400);
    const doc=await c.findOne({kind:'boss',id});
    if(!doc?.published?.pngBase64)return fail('Asset chưa được Publish.',404);
    const png=Buffer.from(doc.published.pngBase64,'base64');
    return new Response(png,{status:200,headers:{
      'content-type':'image/png','content-length':String(png.length),
      'cache-control':'public, max-age=60, must-revalidate',
      'x-content-type-options':'nosniff'
    }});
  }
  const items=await c.find({}).limit(500).toArray();
  const bosses=items.filter(d=>d.kind==='boss'&&d.published).map(publicSummary);
  const maps=items.filter(d=>d.kind==='map'&&d.published).map(publicSummary);
  const bossIds=new Set(bosses.map(b=>b.id)),mapIds=new Set(maps.map(m=>m.id));
  const assignments=items.filter(d=>d.kind==='assignment'&&d.published).map(d=>d.published)
    .filter(a=>(!a.bossId||bossIds.has(a.bossId))&&(!a.mapId||mapIds.has(a.mapId)));
  return json({ok:true,version:1,bosses,maps,assignments});
}

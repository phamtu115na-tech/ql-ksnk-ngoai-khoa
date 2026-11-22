import {actor,db} from '../../../../lib/auth'
import {privateSheet} from '../../../../lib/google-sheet'
import {validSource,sourceMetrics,type SourceConfig} from '../../../../lib/source-metrics'
const sheet='NGUON_BAO_CAO_NGOAI_KHOA'
const keys=['cssd','vsmt','linen','monitor']
type Source={id:string;config:SourceConfig;enabled:boolean}
async function fetchRows(key:string){
 const r=await db().from('nk_legacy_rows').select('data').eq('sheet_name',sheet).eq('row_no',keys.indexOf(key)+1).maybeSingle()
 if(r.error)throw r.error
 return {sources:(r.data?.data?.sources||[]) as Source[],version:r.data?.data?.version??null}
}
async function calculate(cfg:SourceConfig,from:string,to:string){
 const tab=await privateSheet(cfg.spreadsheet,cfg.sheet)
 if(!tab)throw Error('Chưa cấu hình tài khoản dịch vụ Google Sheets phía máy chủ.')
 return {sheet:tab.name,metrics:sourceMetrics(cfg,tab.rows,from,to)}
}
export async function GET(req:Request){
 const user=await actor(),params=new URL(req.url).searchParams,key=params.get('key')||''
 if(!user||!keys.includes(key))return Response.json({error:'Ngoài phạm vi'},{status:403})
 try{
  if(params.get('config')==='1'){if(!user.admin)return Response.json({error:'Thiếu quyền cấu hình'},{status:403});return Response.json(await fetchRows(key),{headers:{'Cache-Control':'no-store'}})}
  if(!(user.admin||user.legacy_operator&&user.work_view))return Response.json({error:'Thiếu quyền xem báo cáo bộ phận'},{status:403})
  const {sources}=await fetchRows(key)
  return Response.json({results:await Promise.all(sources.filter(s=>s.enabled).map(async s=>{try{return {id:s.id,name:s.config.name,...await calculate(s.config,params.get('from')||'',params.get('to')||'')}}catch(e){return {id:s.id,name:s.config.name,error:e instanceof Error?e.message:'Không đọc được nguồn'}}}))},{headers:{'Cache-Control':'private,no-store'}})
 }catch{return Response.json({error:'Không tải được danh mục nguồn'},{status:503})}
}
export async function POST(req:Request){
 const user=await actor();if(!user?.admin||req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Thiếu quyền cấu hình'},{status:403})
 const b=await req.json();if(!keys.includes(b.key)||!validSource(b.config))return Response.json({error:'Kiểm tra tên nguồn, ID bảng, tab, cột ngày và chỉ số.'},{status:400})
 try{
  if(b.op==='test')return Response.json(await calculate(b.config,'',''))
  const current=await fetchRows(b.key)
  if(b.version!==current.version)return Response.json({error:'Danh mục đã thay đổi. Tải lại trước khi lưu.'},{status:409})
  const id=b.id||crypto.randomUUID(),old=current.sources.find(s=>s.id===id)
  if(b.id&&!old)return Response.json({error:'Không tìm thấy nguồn'},{status:404})
  const sources=old?current.sources.map(s=>s.id===id?{id,config:b.config,enabled:b.enabled===true}:s):[...current.sources,{id,config:b.config,enabled:true}]
  if(sources.length>24)return Response.json({error:'Mỗi bộ phận hỗ trợ 24 nguồn.'},{status:400})
  const data={sources,version:crypto.randomUUID(),updatedBy:user.id},table=db().from('nk_legacy_rows')
  const q=current.version?table.update({data}).eq('sheet_name',sheet).eq('row_no',keys.indexOf(b.key)+1).eq('data->>version',current.version):table.insert({sheet_name:sheet,row_no:keys.indexOf(b.key)+1,legacy_id:b.key,data})
  const r=await q.select('row_no').maybeSingle();if(r.error||!r.data)return Response.json({error:'Không lưu được nguồn. Kiểm tra phiên bản danh mục.'},{status:409})
  return Response.json(data)
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Không kiểm tra được nguồn'},{status:503})}
}

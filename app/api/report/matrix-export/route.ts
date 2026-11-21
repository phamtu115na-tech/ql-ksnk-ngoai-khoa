import {scopedReport} from '../../../../lib/report-access'
import {actor,db} from '../../../../lib/auth'
import {GET as report} from '../../modules/route'
import {columns,defaults,dimensions,levels,ranked,severity,type Dimension,type Mark} from '../../../../lib/matrix'
import {excel,powerpoint} from '../../../../lib/export-matrix'
export async function POST(req:Request){
 const user=await actor()
 if(!user||req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Thiếu quyền xuất báo cáo'},{status:403})
 const {format,code,filters,dimension,kind,limit,mode}=await req.json()
 if(!['xlsx','pptx'].includes(format)||!Object.hasOwn(dimensions,dimension)||![0,5,10].includes(limit)||!['count','rate'].includes(mode)||typeof code!=='string')return Response.json({error:'Bộ lọc không hợp lệ'},{status:400})
 const url=new URL(req.url);url.searchParams.set('module','reports')
 for(const key of ['from','to','department','person'])if(typeof filters?.[key]==='string')url.searchParams.set(key,filters[key])
 let reportData
 if(user.admin){const response=await report(new Request(url));if(!response.ok)return response;reportData=await response.json()}else{reportData=await scopedReport(user,filters||{},true);if(!reportData)return Response.json({error:'Thiếu quyền xuất báo cáo'},{status:403})}
 const matrix=reportData.formMatrices.find((r:{formCode:string})=>r.formCode===code)
 if(!matrix)return Response.json({error:'Không tìm thấy mẫu trong kỳ báo cáo'},{status:404})
 const setting=await db().from('nk_legacy_rows').select('data').eq('sheet_name','CAI_DAT_MA_TRAN').eq('row_no',1).maybeSingle()
 if(setting.error)return Response.json({error:'Không đọc được thang cảnh báo'},{status:503})
 const scale=setting.data?.data?.scale??defaults
 const rankedRows=ranked(matrix.marks as Mark[],dimension,kind,limit)
 const rows=rankedRows.map(r=>{const level=severity(r,mode,scale);return [r.label,r.key,r.forms,r.total,r.pass,r.fail,r.poor,r.errors,r.passRate,r.errorRate,level<0?(r.total?'Chưa đủ lượt':'Chưa có dữ liệu'):levels[level]]})
 const data={title:[reportData.reportHero?.title,matrix.formName,dimensions[dimension as Dimension]].filter(Boolean).join(' · '),period:[filters?.from,filters?.to].join(' – '),department:reportData.reportHero?.department||filters?.department||'Ngoại khoa 115 Nghệ An',columns,rows}
 const bytes=format==='xlsx'?await excel(data):await powerpoint(data)
 return new Response(bytes as ArrayBuffer,{headers:{'Content-Type':format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/vnd.openxmlformats-officedocument.presentationml.presentation','Content-Disposition':'attachment; filename="ma-tran.'+format+'"','Cache-Control':'private, no-store'}})
}

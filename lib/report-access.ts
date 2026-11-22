import {db,type Person} from './auth'
import type {Mark} from './matrix'
export async function reportAccess(user:Person){
 if(user.admin)return {scope:'hospital',can_export:true}
 const {data,error}=await db().from('nk_report_permissions').select('scope,can_export').eq('person',user.id).maybeSingle()
 if(error&&error.code!=='PGRST205'&&error.code!=='42P01')throw error
 return data??{scope:'none',can_export:false}
}
export async function scopedReport(user:Person,filters:Record<string,string>,forExport=false){
 const access=await reportAccess(user)
 if(access.scope==='none'||forExport&&!access.can_export)return null
 const matrices=new Map<string,{formCode:string;formName:string;marks:Mark[]}>()
 let after=0
 for(;;){
  const result=await db().rpc('nk_matrix_marks',{who:user.id,for_export:forExport,after_row:after,page_size:500})
  if(result.error)throw result.error
  const page=result.data||[]
  for(const r of page){
   const h=r.header
   let date=String(h.date||'').slice(0,10)
   const parts=/^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(date)
   if(parts)date=parts[3]+'-'+parts[2].padStart(2,'0')+'-'+parts[1].padStart(2,'0')
   if((filters.from&&date<filters.from)||(filters.to&&date>filters.to)||(filters.department&&h.department!==filters.department)||(filters.person&&h.name!==filters.person))continue
   const code=h.formCode||r.form_id
   const matrix=matrices.get(code)??{formCode:code,formName:h.formName||code,marks:[] as Mark[]}
   matrix.marks.push({...Object.fromEntries(Object.entries({...h,...r.mark}).map(([k,v])=>[k,v??''])),row_no:r.row_no,formId:r.form_id,date} as Mark)
   matrices.set(code,matrix)
  }
  if(page.length<500)break
  after=page[page.length-1].row_no
 }
 return {formMatrices:[...matrices.values()],canExport:access.can_export,reportHero:null}
}

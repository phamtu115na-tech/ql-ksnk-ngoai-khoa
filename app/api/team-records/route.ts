import {actor,db} from '../../../lib/auth';
import {teamRecords,TeamModule} from '../../../lib/team-records';
export async function POST(req:Request){
 const a=await actor();
 if(!a||!(a.team_lead||a.legacy_operator)||!a.work_view||(!a.legacy_operator&&!(a.team_department||a.department||'').trim()))return Response.json({error:'Ngoài phạm vi quản lý.'},{status:403});
 const b=await req.json();
 if(!Object.hasOwn(teamRecords,b.module))return Response.json({error:'Phân hệ không hợp lệ.'},{status:400});
 const def=teamRecords[b.module as TeamModule];
 if(b.op==='save'){
  if(!a.work_edit||!def.edit.includes(b.field)||typeof b.value!=='string'||b.value.length>6000||!Number.isSafeInteger(b.id))return Response.json({error:'Không có quyền sửa trường này.'},{status:403});
  const result=await db().rpc('nk_team_field',{who:a.id,row_id:b.id,sheets:def.sheets,field_name:b.field,previous:b.previous??null,new_value:b.value});
  if(result.error||!result.data)return Response.json({error:'Hồ sơ đã thay đổi hoặc ngoài phạm vi. Tải lại để kiểm tra.'},{status:409});
  return Response.json({ok:true});
 }
 if(b.op!=='list'||!Number.isSafeInteger(b.offset)||b.offset<0)return Response.json({error:'Yêu cầu không hợp lệ.'},{status:400});
 const result=await db().rpc('nk_team_records',{who:a.id,sheets:def.sheets,fields:[...def.read,...def.edit],start_at:b.offset});
 return result.error?Response.json({error:'Không tải được hồ sơ.'},{status:503}):Response.json({rows:result.data,editable:a.work_edit});
}

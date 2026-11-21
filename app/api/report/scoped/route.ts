import {actor} from '../../../../lib/auth'
import {scopedReport} from '../../../../lib/report-access'
export async function GET(req:Request){
 const user=await actor();if(!user)return Response.json({error:'Chưa đăng nhập'},{status:401})
 try{const report=await scopedReport(user,Object.fromEntries(new URL(req.url).searchParams));return report?Response.json(report,{headers:{'Cache-Control':'private,no-store'}}):Response.json({error:'Chưa được cấp quyền xem ma trận.'},{status:403})}
 catch{return Response.json({error:'Không đọc được dữ liệu ma trận theo phạm vi.'},{status:503})}
}

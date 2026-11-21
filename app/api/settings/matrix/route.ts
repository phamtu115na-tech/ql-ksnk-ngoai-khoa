import {NextResponse} from 'next/server'
import {actor,db} from '../../../../lib/auth'
import {defaults,validScale} from '../../../../lib/matrix'
const sheet='CAI_DAT_MA_TRAN'
export async function GET(){
 const user=await actor()
 if(!user)return NextResponse.json({error:'Chưa đăng nhập'},{status:401})
 const {data,error}=await db().from('nk_legacy_rows').select('data').eq('sheet_name',sheet).eq('row_no',1).maybeSingle()
 if(error)return NextResponse.json({error:'Không đọc được cài đặt ma trận'},{status:503})
 return NextResponse.json({scale:data?.data?.scale??defaults,version:data?.data?.version??null,editable:user.admin},{headers:{'Cache-Control':'private, no-store'}})
}
export async function POST(req:Request){
 const user=await actor()
 if(!user?.admin||req.headers.get('origin')!==new URL(req.url).origin)return NextResponse.json({error:'Thiếu quyền cấu hình'},{status:403})
 const body=await req.json()
 if(!validScale(body.scale))return NextResponse.json({error:'Kiểm tra thứ tự và giới hạn các ngưỡng.'},{status:400})
 const version=crypto.randomUUID(),data={version,scale:body.scale,updatedBy:user.id}
 const table=db().from('nk_legacy_rows')
 const query=body.version?table.update({data}).eq('sheet_name',sheet).eq('row_no',1).eq('data->>version',body.version):table.insert({sheet_name:sheet,row_no:1,legacy_id:sheet,data})
 const result=await query.select('row_no').maybeSingle()
 if(result.error&&result.error.code!=='23505')return NextResponse.json({error:'Không lưu được cài đặt.'},{status:503})
 if(!result.data)return NextResponse.json({error:'Cài đặt vừa thay đổi. Hãy tải lại trước khi sửa.'},{status:409})
 return NextResponse.json({version})
}

import {NextResponse} from 'next/server';
import {sheetRows,saveRow,deleteRow} from '../../../../lib/legacy';
import {hasSession} from '../../../../lib/auth';

export const runtime='nodejs';

export async function GET(req:Request,{params}:{params:Promise<{sheet:string}>}){
  if(!await hasSession())return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
  try{
    const {sheet}=await params;
    const url=new URL(req.url);
    const page=Math.max(1,Number(url.searchParams.get('page'))||1);
    const result=await sheetRows(decodeURIComponent(sheet),page,url.searchParams.get('q')||'');
    return NextResponse.json({ok:true,...result},{headers:{'Cache-Control':'private, max-age=15, stale-while-revalidate=45'}});
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}

export async function POST(req:Request,{params}:{params:Promise<{sheet:string}>}){
  if(!await hasSession())return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
  try{
    const {sheet}=await params;const b=await req.json();
    const rowNo=await saveRow(decodeURIComponent(sheet),b.row_no,b.data||{});
    return NextResponse.json({ok:true,row_no:rowNo});
  }catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}

export async function DELETE(req:Request,{params}:{params:Promise<{sheet:string}>}){
  if(!await hasSession())return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
  try{const {sheet}=await params;const b=await req.json();await deleteRow(decodeURIComponent(sheet),Number(b.row_no));return NextResponse.json({ok:true});}
  catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}

import {NextResponse} from 'next/server';
import {sheetRows,saveRow,deleteRow} from '../../../../lib/legacy';

export async function GET(_:Request,{params}:{params:Promise<{sheet:string}>}){
  try{
    const {sheet}=await params;
    return NextResponse.json({ok:true,rows:await sheetRows(decodeURIComponent(sheet))});
  }catch(e){
    return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});
  }
}

export async function POST(req:Request,{params}:{params:Promise<{sheet:string}>}){
  try{
    const {sheet}=await params;
    const b=await req.json();
    const rowNo=await saveRow(decodeURIComponent(sheet),b.row_no,b.data||{});
    return NextResponse.json({ok:true,row_no:rowNo});
  }catch(e){
    return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});
  }
}

export async function DELETE(req:Request,{params}:{params:Promise<{sheet:string}>}){
  try{
    const {sheet}=await params;
    const b=await req.json();
    await deleteRow(decodeURIComponent(sheet),Number(b.row_no));
    return NextResponse.json({ok:true});
  }catch(e){
    return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});
  }
}

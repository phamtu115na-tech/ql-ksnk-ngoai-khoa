import {NextResponse} from 'next/server';import {sheetRows} from '../../../../lib/legacy';
export async function GET(_:Request,{params}:{params:Promise<{sheet:string}>}){try{const {sheet}=await params;return NextResponse.json({ok:true,rows:await sheetRows(decodeURIComponent(sheet))})}catch(e){return NextResponse.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500})}}

import { supabaseAdmin } from './supabase';
export async function sheetRows(sheet:string){
 const db=supabaseAdmin(); if(!db) throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');
 const {data,error}=await db.from('ksnk_legacy_rows').select('row_no,legacy_id,data').eq('sheet_name',sheet).order('row_no');
 if(error) throw error; return data||[];
}
export async function upsertLegacy(sheet:string,rowNo:number,data:Record<string,unknown>){
 const db=supabaseAdmin(); if(!db) throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');
 const legacy=String(Object.values(data)[0]??'');
 const {error}=await db.from('ksnk_legacy_rows').upsert({sheet_name:sheet,row_no:rowNo,legacy_id:legacy,data},{onConflict:'sheet_name,row_no'});
 if(error) throw error;
}

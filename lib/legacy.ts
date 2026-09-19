import { supabaseAdmin } from './supabase';

export async function sheetRows(sheet:string){
  const db=supabaseAdmin();
  if(!db) throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');
  const {data,error}=await db.from('ksnk_legacy_rows')
    .select('row_no,legacy_id,data')
    .eq('sheet_name',sheet)
    .order('row_no');
  if(error) throw error;
  return data||[];
}

export async function saveRow(sheet:string,rowNo:number|undefined,data:Record<string,unknown>){
  const db=supabaseAdmin();
  if(!db) throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');
  let n=rowNo;
  if(!n){
    const {data:last,error:lastError}=await db.from('ksnk_legacy_rows')
      .select('row_no')
      .eq('sheet_name',sheet)
      .order('row_no',{ascending:false})
      .limit(1);
    if(lastError) throw lastError;
    n=(last?.[0]?.row_no||0)+1;
  }
  const legacy=String(Object.values(data)[0]??'');
  const {error}=await db.from('ksnk_legacy_rows')
    .upsert({sheet_name:sheet,row_no:n,legacy_id:legacy,data},{onConflict:'sheet_name,row_no'});
  if(error) throw error;
  return n;
}

export async function deleteRow(sheet:string,rowNo:number){
  const db=supabaseAdmin();
  if(!db) throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');
  const {error}=await db.from('ksnk_legacy_rows')
    .delete()
    .eq('sheet_name',sheet)
    .eq('row_no',rowNo);
  if(error) throw error;
}

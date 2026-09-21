import {NextResponse} from 'next/server';
import {hasSession} from '../../../../lib/auth';
import {supabaseAdmin} from '../../../../lib/supabase';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const SHEET='DM_BOPHAN';
const PAGE_SIZE=1000;
const BASE_DEPARTMENTS=['VỆ SINH MÔI TRƯỜNG','ĐỒ VẢI','ĐỒ VẢI - PHÒNG VIP','GIÁM SÁT','DỤNG CỤ','VI PHẠM CHUNG'];
const DEPARTMENT_KEYS=['Bộ phận','Thuộc bộ phận','Bộ phận phụ trách','Bộ phận thực hiện','Khoa/Bộ phận','Bộ phận/Phòng'];
const INACTIVE=['da xoa','xoa','ngung','tam ngung'];
type AnyRecord=Record<string,any>;
type LegacyRow={sheet_name:string;row_no:number;legacy_id?:string|null;data:AnyRecord};

function db(){const client=supabaseAdmin();if(!client)throw new Error('SUPABASE_SERVICE_ROLE_KEY chưa cấu hình');return client;}
function text(value:unknown){return value==null?'':String(value).trim();}
function norm(value:unknown){return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/\s+/g,' ');}
function same(a:unknown,b:unknown){return norm(a)===norm(b);}
function activeStatus(value:unknown){return !INACTIVE.includes(norm(value));}
function departmentName(data:AnyRecord){for(const key of DEPARTMENT_KEYS){const value=text(data[key]);if(value)return value;}return '';}
function validName(value:unknown,label='Tên bộ phận'){
 const name=text(value).replace(/\s+/g,' ');
 if(!name)throw new Error(`${label} không được để trống.`);
 if(name.length>120)throw new Error(`${label} không được vượt quá 120 ký tự.`);
 return name;
}

async function readRows(sheet?:string){
 const client=db();const rows:LegacyRow[]=[];
 for(let from=0;;from+=PAGE_SIZE){
  let query=client.from('ksnk_legacy_rows').select('sheet_name,row_no,legacy_id,data').order('row_no',{ascending:true}).range(from,from+PAGE_SIZE-1);
  if(sheet)query=query.eq('sheet_name',sheet);
  const {data,error}=await query;if(error)throw error;
  const page=(data||[]) as LegacyRow[];rows.push(...page);
  if(page.length<PAGE_SIZE)break;
 }
 return rows;
}

function catalogRow(row:LegacyRow){
 const name=text(row.data['Tên bộ phận']||row.data['Tên']||row.data['Bộ phận']);
 return {row_no:row.row_no,legacy_id:row.legacy_id||'',name,status:text(row.data['Trạng thái'])||'Hoạt động',updatedAt:text(row.data['Cập nhật lúc']),previousName:text(row.data['Tên bộ phận trước'])};
}
function catalogNames(rows:LegacyRow[]){return rows.map(catalogRow).filter(x=>x.name&&activeStatus(x.status)).map(x=>x.name);}
function fallbackNames(allRows:LegacyRow[]){
 const names=[...BASE_DEPARTMENTS];
 for(const row of allRows){const name=departmentName(row.data);if(name)names.push(name);}
 return [...new Set(names.map(text).filter(Boolean))];
}
function allNames(allRows:LegacyRow[]){return [...new Set([...fallbackNames(allRows),...catalogNames(allRows.filter(x=>x.sheet_name===SHEET))])];}
function references(rows:LegacyRow[],name:string){return rows.filter(row=>row.sheet_name!==SHEET&&DEPARTMENT_KEYS.some(key=>same(row.data[key],name)));}
function publicCatalog(rows:LegacyRow[],allRows:LegacyRow[]){
 const refs=new Map<string,number>();
 for(const row of allRows.filter(x=>x.sheet_name!==SHEET)){for(const key of DEPARTMENT_KEYS){const value=departmentName({[key]:row.data[key]});if(value)refs.set(norm(value),(refs.get(norm(value))||0)+1);}}
 const catalog=rows.map(catalogRow).filter(x=>x.name).map(x=>({...x,referenceCount:refs.get(norm(x.name))||0}));
 const active=catalog.filter(x=>activeStatus(x.status)).map(x=>x.name);
 const departments=rows.length?active:fallbackNames(allRows);
 return {catalog,departments:[...new Set(departments)].sort((a,b)=>a.localeCompare(b,'vi')),references:refs,referenceCounts:Object.fromEntries(refs)};
}
async function saveCatalog(rowNo:number,data:AnyRecord){
 const {error}=await db().from('ksnk_legacy_rows').upsert({sheet_name:SHEET,row_no:rowNo,legacy_id:data['Mã bộ phận']||`BP:${rowNo}`,data},{onConflict:'sheet_name,row_no'});
 if(error)throw error;return rowNo;
}
async function ensureCatalog(allRows:LegacyRow[],catalogRows:LegacyRow[]){
 const existing=new Map(catalogRows.map(row=>[norm(catalogRow(row).name),row]));
 let next=Math.max(0,...catalogRows.map(x=>x.row_no))+1;
 for(const name of allNames(allRows)){
  if(existing.has(norm(name)))continue;
  await saveCatalog(next,{'Mã bộ phận':`BP${String(next).padStart(3,'0')}`,'Tên bộ phận':name,'Trạng thái':'Hoạt động','Cập nhật lúc':new Date().toISOString()});
  existing.set(norm(name),{sheet_name:SHEET,row_no:next,data:{'Tên bộ phận':name}} as LegacyRow);next++;
 }
 return readRows(SHEET);
}
async function renameReferences(rows:LegacyRow[],oldName:string,newName:string){
 const client=db();let changed=0;
 for(const row of references(rows,oldName)){
  const data={...row.data};let touched=false;
  for(const key of DEPARTMENT_KEYS){if(same(data[key],oldName)){data[key]=newName;touched=true;}}
  if(touched){const {error}=await client.from('ksnk_legacy_rows').update({data}).eq('sheet_name',row.sheet_name).eq('row_no',row.row_no);if(error)throw error;changed++;}
 }
 return changed;
}

export async function GET(){
 if(!await hasSession())return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
 try{
  const [catalogRows,allRows]=await Promise.all([readRows(SHEET),readRows()]);
  const result=publicCatalog(catalogRows,allRows);
  return NextResponse.json({ok:true,...result},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){console.error('[departments:get]',error);return NextResponse.json({ok:false,error:'Không đọc được danh mục bộ phận',detail:error instanceof Error?error.message:'Lỗi Supabase'},{status:503});}
}

export async function POST(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)return NextResponse.json({ok:false,error:'Yêu cầu không hợp lệ'},{status:403});
 if(!await hasSession())return NextResponse.json({ok:false,error:'Chưa đăng nhập'},{status:401});
 try{
  const body=(await req.json()) as AnyRecord;const action=text(body.action);const [catalogRows,allRows]=await Promise.all([readRows(SHEET),readRows()]);
  const seeded=action==='add'||action==='edit'||action==='delete'?await ensureCatalog(allRows,catalogRows):catalogRows;
  const existing=seeded.map(catalogRow);const now=new Date().toISOString();
  if(action==='add'){
   const name=validName(body.name);const active=existing.find(x=>activeStatus(x.status)&&same(x.name,name));if(active)throw new Error(`Bộ phận "${name}" đã tồn tại.`);
   const reusable=existing.find(x=>!activeStatus(x.status)&&same(x.name,name));
   const rowNo=reusable?.row_no||Math.max(0,...existing.map(x=>x.row_no))+1;
   await saveCatalog(rowNo,{...(reusable?catalogRows.find(x=>x.row_no===rowNo)?.data||{}:{}),'Mã bộ phận':reusable?.legacy_id||`BP${String(rowNo).padStart(3,'0')}`,'Tên bộ phận':name,'Trạng thái':'Hoạt động','Cập nhật lúc':now,'Xóa lúc':''});
   return NextResponse.json({ok:true,message:`Đã thêm bộ phận "${name}".`});
  }
  if(action==='edit'){
   const oldName=validName(body.oldName,'Tên bộ phận hiện tại');const newName=validName(body.newName,'Tên bộ phận mới');
   if(same(oldName,newName))throw new Error('Tên bộ phận mới phải khác tên hiện tại.');
   if(existing.some(x=>activeStatus(x.status)&&same(x.name,newName)))throw new Error(`Bộ phận "${newName}" đã tồn tại.`);
   const row=existing.find(x=>activeStatus(x.status)&&same(x.name,oldName));if(!row)throw new Error(`Không tìm thấy bộ phận "${oldName}".`);
   const changed=await renameReferences(allRows,oldName,newName);
   const source=catalogRows.find(x=>x.row_no===row.row_no)?.data||{};
   await saveCatalog(row.row_no,{...source,'Mã bộ phận':row.legacy_id||`BP${String(row.row_no).padStart(3,'0')}`,'Tên bộ phận':newName,'Tên bộ phận trước':oldName,'Trạng thái':'Hoạt động','Cập nhật lúc':now});
   return NextResponse.json({ok:true,message:`Đã sửa tên bộ phận từ "${oldName}" thành "${newName}".`,updatedReferences:changed});
  }
  if(action==='delete'){
   const name=validName(body.name);const row=existing.find(x=>activeStatus(x.status)&&same(x.name,name));if(!row)throw new Error(`Không tìm thấy bộ phận "${name}".`);
   const used=references(allRows,name);if(used.length)return NextResponse.json({ok:false,error:`Không thể xóa "${name}" vì đang được tham chiếu ở ${used.length} bản ghi. Hãy chuyển nhân sự/công việc sang bộ phận khác trước.`},{status:409});
   const source=catalogRows.find(x=>x.row_no===row.row_no)?.data||{};
   await saveCatalog(row.row_no,{...source,'Mã bộ phận':row.legacy_id||`BP${String(row.row_no).padStart(3,'0')}`,'Tên bộ phận':name,'Trạng thái':'Đã xóa','Cập nhật lúc':now,'Xóa lúc':now});
   return NextResponse.json({ok:true,message:`Đã xóa bộ phận "${name}" khỏi danh sách lựa chọn.`});
  }
  throw new Error('Thao tác bộ phận không hợp lệ.');
 }catch(error){console.error('[departments:post]',error);return NextResponse.json({ok:false,error:error instanceof Error?error.message:'Không lưu được bộ phận'},{status:503});}
}

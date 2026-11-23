export const STAFF_POSITIONS=['Trưởng khoa','Điều dưỡng trưởng','Tổ trưởng','Nhân viên'] as const;
export const STAFF_EMPLOYMENT_STATUSES=['Đang làm việc','Đã nghỉ việc'] as const;
export type AccountWorkRole='chief'|'team'|'staff';
const n=(v:unknown)=>String(v??'').trim().toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/\s+/g,' ');
export function staffPosition(value:unknown):string{
 const v=n(value);const synonyms:Record<string,string>={
  'truong khoa':'Trưởng khoa','dieu duong truong':'Điều dưỡng trưởng','dd truong':'Điều dưỡng trưởng',
  'to truong':'Tổ trưởng','to truong bo phan':'Tổ trưởng',
  'nhan vien':'Nhân viên','nv':'Nhân viên','ho ly':'Nhân viên',
  'xu ly dung cu':'Nhân viên','dung cu':'Nhân viên',
  'nv dung cu':'Nhân viên','nhan vien dung cu':'Nhân viên',
  'nhan vien xu ly dung cu':'Nhân viên',
  'nhan vien giam sat':'Nhân viên','giam sat':'Nhân viên',
  'nhan vien giat la':'Nhân viên','giat la':'Nhân viên',
  'ky thuat vien':'Nhân viên','ktv':'Nhân viên'
 };
 return synonyms[v]||'';
}
export function staffEmploymentStatus(value:unknown):string{
 const v=n(value);return (!v||['dang lam viec','dang lam','lam viec','hoat dong'].includes(v))?'Đang làm việc':['da nghi viec','nghi viec','da nghi','nghi lam'].includes(v)?'Đã nghỉ việc':'';
}
export function roleForStaffPosition(value:unknown):AccountWorkRole|null{
 const position=staffPosition(value);return !position?null:['Trưởng khoa','Điều dưỡng trưởng'].includes(position)?'chief':position==='Tổ trưởng'?'team':'staff';
}
export function roleAllowedByPosition(role:AccountWorkRole,position:unknown):boolean{
 const expected=roleForStaffPosition(position);return Boolean(expected&&(role==='staff'||role===expected));
}

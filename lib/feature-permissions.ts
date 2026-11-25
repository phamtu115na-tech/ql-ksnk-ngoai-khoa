import {db,type Person} from './auth'

/** Grant values are stored on the server; no browser-supplied role or scope is trusted. */
export const FEATURE_ACTIONS={
 tasks:['view','create','edit','delete','approve','history'],
 reminders:['view','create','edit','delete','history'],
 checklists:['view','create','edit','delete','history'],
 checklistTemplates:['view','create','edit','delete'],
 violations:['view','create','edit','delete'],
 plans:['view','create','edit','delete'],
 issues:['view','create','edit','delete'],
 reports:['view','edit','history','export'],
 staff:['view','create','edit','delete'],
 kpi:['view','create','edit','delete','history'],
 alerts:['view','edit']
} as const
export type Feature=keyof typeof FEATURE_ACTIONS
export type Action='view'|'create'|'edit'|'delete'|'approve'|'history'|'export'
export type Scope='none'|'self'|'team'|'hospital'
export type GrantMatrix=Partial<Record<Feature,Partial<Record<Action,Scope>>>>
export type Role='staff'|'team'|'chief'
export const ROLES:readonly Role[]=['staff','team','chief']
export const roleNames:Record<Role,string>={staff:'Nhân viên',team:'Tổ trưởng',chief:'Trưởng khoa / Điều dưỡng trưởng'}
export function roleOf(person:Person):Role{
 return person.legacy_operator&&person.work_view?'chief':person.team_lead&&person.work_role_reviewed&&person.work_view?'team':'staff'
}

export const scopeValues:readonly Scope[]=['none','self','team','hospital']
export const scopeRank=(scope:Scope)=>scopeValues.indexOf(scope)
export const normalized=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').trim().toLowerCase()

export const featureLabels:Record<Feature,string>={
 tasks:'Giao việc',reminders:'Nhắc việc',checklists:'Phiếu giám sát đã chấm',
 checklistTemplates:'Mẫu phiếu và tiêu chí',violations:'Lỗi đột xuất / vi phạm',
 plans:'Kế hoạch tuần / tháng',issues:'Tồn tại / kiến nghị',reports:'Báo cáo tổng hợp',
 staff:'Nhân sự & hợp đồng',kpi:'KPI 100 điểm',alerts:'Cảnh báo'
}
export const actionLabels:Record<Action,string>={
 view:'Xem',create:'Thêm mới',edit:'Sửa',delete:'Xóa',approve:'Phê duyệt',history:'Lịch sử',export:'Xuất Excel / PPT'
}

/** Permissions granted by a position before an administrator saves an override.
 * Staff members may still participate and edit their assigned work threads.
 */
export function defaultFeatureScope(person:Person,feature:Feature,action:Action):Scope{
 if(person.admin)return 'hospital'
 const chief=Boolean(person.legacy_operator&&person.work_view)
 const lead=Boolean(person.team_lead&&person.work_role_reviewed&&person.work_view)
 const workCanEdit=Boolean(person.work_edit)
 const base:Scope=chief?'hospital':lead?'team':'self'
 if(action==='view'||action==='history'){
  if(feature==='checklistTemplates'&&!chief&&!lead)return 'none'
  return base
 }
 if(feature==='reports'&&action==='export')return chief?'hospital':lead?'team':'none'
 if(['tasks','reminders'].includes(feature)&&action==='edit'&&!chief&&!lead)return 'self'
 if(feature==='checklists'&&['create','edit','delete'].includes(action))
  return workCanEdit?(chief?'hospital':lead?'team':'none'):'none'
 if(feature==='checklistTemplates'&&['create','edit','delete'].includes(action))
  return workCanEdit?(chief?'hospital':lead?'team':'none'):'none'
 if(feature==='staff'&&['create','edit','delete'].includes(action))return workCanEdit&&chief?'hospital':'none'
 if(['plans','issues'].includes(feature)&&['create','edit'].includes(action)&&!chief&&!lead)return 'self'
 if(feature==='tasks'&&action==='approve')
  return workCanEdit&&Boolean(person.can_approve_work)&&(chief||lead)?base:'none' // Actual approval also needs the named reviewer.
 if(['create','edit','delete'].includes(action))return workCanEdit?(chief?'hospital':lead?'team':'none'):'none'
 return 'none'
}
/** One shared source of truth for role defaults, used by both API checks and UI previews. */
export function baselineForRole(role:Role):GrantMatrix{
 const model={
  admin:false,legacy_operator:role==='chief',team_lead:role==='team',work_role_reviewed:true,
  work_view:true,work_edit:role!=='staff',can_approve_work:false
 } as Person
 const out:GrantMatrix={}
 for(const [feature,actions] of Object.entries(FEATURE_ACTIONS) as [Feature,readonly Action[]][]){
  const grants:Partial<Record<Action,Scope>>={}
  for(const action of actions)grants[action]=defaultFeatureScope(model,feature,action)
  out[feature]=grants
 }
 return out
}
export function effectiveMatrix(person:Person,overrides:GrantMatrix={},legacy?:{scope?:Scope;can_export?:boolean}|null,roleDefaults:GrantMatrix={}){
 const result:GrantMatrix={}
 for(const [feature,actions] of Object.entries(FEATURE_ACTIONS) as [Feature,readonly Action[]][]){
  const row:Partial<Record<Action,Scope>>={}
  for(const action of actions){
   let fallback=defaultFeatureScope(person,feature,action)
   if(feature==='reports'&&legacy&&!person.admin){
    if(action==='view'&&legacy.scope&&legacy.scope!=='none')fallback=legacy.scope
    if(action==='export'&&legacy.can_export&&legacy.scope&&legacy.scope!=='none')fallback=legacy.scope
   }
   row[action]=person.admin?'hospital':overrides?.[feature]?.[action]??roleDefaults?.[feature]?.[action]??fallback
  }
  // An administrator may explicitly delegate team/hospital access to a staff member.
  // Role ceilings apply to inherited defaults, not to grants written by the audited RPC.
  // Approval is never a generic delegation: reviewer eligibility remains mandatory.
  if(feature==='tasks'&&!person.admin&&!(person.can_approve_work&&person.work_edit&&(person.legacy_operator||person.team_lead&&person.work_role_reviewed)))row.approve='none'
  const read=row.view||'none'
  for(const action of actions){
   if(action!=='view'&&scopeRank(row[action]||'none')>scopeRank(read))row[action]=read
  }
  result[feature]=row
 }
 return result
}
export function validateMatrix(input:unknown):GrantMatrix{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Bảng quyền không hợp lệ')
 const data=input as Record<string,unknown>,result:GrantMatrix={}
 for(const [feature,value] of Object.entries(data)){
  if(!Object.hasOwn(FEATURE_ACTIONS,feature)||!value||typeof value!=='object'||Array.isArray(value))
   throw Error('Phân hệ cấp quyền không hợp lệ')
  const actions=FEATURE_ACTIONS[feature as Feature] as readonly string[]
  const row:Partial<Record<Action,Scope>>={}
  for(const [action,scope] of Object.entries(value)){
   if(!actions.includes(action)||!scopeValues.includes(scope as Scope))throw Error('Quyền hoặc phạm vi không hợp lệ')
   row[action as Action]=scope as Scope
  }
  const read=row.view
  if(read!==undefined){
   for(const [action,scope] of Object.entries(row)){
    if(action!=='view'&&scopeRank(scope as Scope)>scopeRank(read))
     throw Error('Quyền thao tác không được rộng hơn phạm vi xem')
   }
  }
  result[feature as Feature]=row
 }
 return result
}
export async function featureMatrix(person:Person){
 let overrides:GrantMatrix={}
 const result=await db().from('nk_feature_permissions').select('grants').eq('person',person.id).maybeSingle()
 if(result.error&&!['42P01','PGRST205'].includes(result.error.code))throw result.error
 if(result.data?.grants&&typeof result.data.grants==='object')overrides=result.data.grants as GrantMatrix
 const [old,rolePolicy]=await Promise.all([
  db().from('nk_report_permissions').select('scope,can_export').eq('person',person.id).maybeSingle(),
  db().from('nk_role_permission_defaults').select('grants').eq('role',roleOf(person)).maybeSingle()
 ])
 if(old.error&&!['42P01','PGRST205'].includes(old.error.code))throw old.error
 if(rolePolicy.error&&!['42P01','PGRST205'].includes(rolePolicy.error.code))throw rolePolicy.error
 return effectiveMatrix(person,overrides,old.data as {scope:Scope;can_export:boolean}|null,(rolePolicy.data?.grants||{}) as GrantMatrix)
}
export async function featureScope(person:Person,feature:Feature,action:Action):Promise<Scope>{
 return (await featureMatrix(person))[feature]?.[action]??'none'
}
export function inFeatureScope(person:Person,scope:Scope,department?:unknown,staffId?:unknown,staffName?:unknown):boolean{
 if(!person.active||person.unit!=='surgery'||scope==='none')return false
 if(scope==='hospital')return true
 const ownDepartment=person.team_department||person.department
 if(!department||!ownDepartment||normalized(department)!==normalized(ownDepartment))return false
 if(scope==='team')return true
 return Boolean(person.staff_code&&staffId&&normalized(person.staff_code)===normalized(staffId)||
  staffName&&normalized(staffName)===normalized(person.name))
}

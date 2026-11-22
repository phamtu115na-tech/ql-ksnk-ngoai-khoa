export type Mark = {
 row_no:number; formId:string; date:string; staffId:string; name:string; department:string;
 area:string; criterionId:string; group:string; content:string; result:string;
}
export type Dimension = 'criterion'|'group'|'form'|'staff'|'day'
export type Counts = {pass:number; fail:number; poor:number; na:number; missing:number}
export function normalized(s:string){return (s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d')}
export function outcome(value:string):keyof Counts {
 switch(normalized(value)){
 case 'dat':return 'pass'; case 'khong dat':return 'fail'; case 'kem':return 'poor';
 case 'khong ap dung':case 'n/a':case 'na':return 'na';default:return 'missing';
 }
}
export function rates(c:Counts){
 const errors=c.fail+c.poor, total=c.pass+errors
 return {total,errors,passRate:total?100*c.pass/total:null,errorRate:total?100*errors/total:null}
}
export function identify(m:Mark,d:Dimension){
 switch(d){
 case 'staff':return [m.staffId||JSON.stringify([m.department,m.name]),m.name||'Chưa ghi tên'];
 case 'criterion':return [m.criterionId||JSON.stringify([m.group,m.content]),m.content||m.criterionId||'Chưa ghi tiêu chí'];
 case 'group':return [m.group,m.group||'Chưa phân nhóm'];
 case 'day':return [m.date,m.date||'Chưa ghi ngày'];
 default:return ['form','Toàn bộ mẫu phiếu'];
 }
}
export function aggregate(marks:Mark[],d:Dimension){
 const groups=new Map<string,{key:string;label:string;counts:Counts;forms:Set<string>;areas:Set<string>;departments:Set<string>}>()
 for(const mark of marks){
  const [key,label]=identify(mark,d)
  const row=groups.get(key)??{key,label,counts:{pass:0,fail:0,poor:0,na:0,missing:0},forms:new Set<string>(),areas:new Set<string>(),departments:new Set<string>()}
  row.counts[outcome(mark.result)]++
  row.forms.add(mark.formId)
  if(mark.area)row.areas.add(mark.area)
  if(mark.department)row.departments.add(mark.department)
  groups.set(key,row)
 }
 return [...groups.values()].map(r=>({key:r.key,label:r.label,forms:r.forms.size,area:[...r.areas].join(', '),department:[...r.departments].join(', '),...r.counts,...rates(r.counts)}))
}
export type Metric=ReturnType<typeof aggregate>[number]
export const levels=['Không ghi nhận lỗi','Thấp','Trung bình','Cao','Rất cao']
export const colors=['#187649','#e6c534','#e5a02e','#d65c22','#981e31']
export const defaults={count:[0,2,5,10],rate:[0,5,10,20],minimum:1,colors:[...colors],labels:[...levels],mode:'criterion' as Dimension}
export type Scale=typeof defaults
export function validScale(s:Scale){
 return !!s&&[s.colors??colors,s.labels??levels].every(v=>Array.isArray(v)&&v.length===5)&& (s.colors??colors).every(v=>/^#[0-9a-f]{6}$/i.test(v))&&(s.labels??levels).every(v=>typeof v==='string'&&v.trim()&&v.length<=60)&&['criterion','staff'].includes(s.mode)&&Number.isInteger(s.minimum)&&s.minimum>0&&
 [s.count,s.rate].every((list,i)=>Array.isArray(list)&&list.length===4&&list[0]===0&&list.every((v,j)=>Number.isFinite(v)&&(!j||v>list[j-1])&&(i?v<100:Number.isInteger(v))))
}
export function severity(r:Metric,mode:'count'|'rate',s:Scale){
 if(!r.total||(mode==='rate'&&r.total<s.minimum))return -1
 const value=mode==='count'?r.errors:r.errorRate!
 const index=s[mode].findIndex(v=>value<=v)
 return index<0?4:index
}
export const dimensions={criterion:'Theo tiêu chí',group:'Theo nhóm tiêu chí',form:'Toàn bộ mẫu phiếu',staff:'Theo nhân viên',day:'Theo ngày'}
export const columns=['Nội dung','Mã / nhóm','Phiếu','Lượt hợp lệ','Đạt','Không đạt','Kém','Tổng lỗi','Đạt (%)','Không đạt (%)','Cảnh báo']
export function ranked(marks:Mark[],dimension:Dimension,kind:string,limit:number){
 const all=aggregate(marks,dimension)
 all.sort((a,b)=>dimension==='day'?a.key.localeCompare(b.key):kind==='pareto'?b.errors-a.errors:(b.errorRate??-1)-(a.errorRate??-1)||b.errors-a.errors)
 return limit&&dimension!=='day'?all.slice(0,limit):all
}

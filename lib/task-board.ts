export type BoardTask = {row_no?: number; id?: string; title?: string; endDate?: string; status?: string; assignee?: string; assigner?: string; department?: string; priority?: string; approvalStatus?: string; workType?: string; description?: string};
export const BOARD_COLUMNS = [
  {id:'overdue',label:'Quá hạn',color:'#f05260'},
  {id:'today',label:'Hạn hôm nay',color:'#c4e744'},
  {id:'week',label:'Hạn tuần này',color:'#26c4ee'},
  {id:'nextWeek',label:'Hạn tuần sau',color:'#54d4d9'},
  {id:'fortnight',label:'Hạn trong 2 tuần',color:'#7bb1ff'},
  {id:'later',label:'Xa hơn',color:'#b8a0f5'},
  {id:'noDate',label:'Không có hạn chót',color:'#c5ccd7'},
  {id:'done',label:'Đã hoàn thành',color:'#a6ddb9'},
] as const;
export type BoardColumn = typeof BOARD_COLUMNS[number]['id'];
export function vietnamDay(now = new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
function dateDay(value: string) {
  const raw=value.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return NaN;
  const ms=Date.parse(raw+'T00:00:00Z');
  return Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===raw?ms/86400000:NaN;
}
export function taskColumn(task: BoardTask, today = vietnamDay()): BoardColumn {
  const status=(task.status||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
  if(['hoan thanh','dong','da khac phuc','hoan tat','da xong'].some(word=>status.includes(word)))return 'done';
  const end=dateDay(task.endDate||'');const current=dateDay(today);
  if(!Number.isFinite(end))return 'noDate';
  if(end<current)return 'overdue';
  if(end===current)return 'today';
  const weekday=new Date(current*86400000).getUTCDay()||7;
  const sunday=current+7-weekday;
  if(end<=sunday)return 'week';
  if(end<=sunday+7)return 'nextWeek';
  if(end<=current+14)return 'fortnight';
  return 'later';
}

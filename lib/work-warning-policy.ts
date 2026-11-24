/**
 * A work warning disappears only when its *own* trigger is resolved.
 * Reading a message never marks the work completed. A daily reminder has a
 * per-day acknowledgement, distinct from "Hoàn thành" for the whole task.
 */
export type WorkAlertItem={
 id:string;kind:'task'|'reminder';title:string;status:string;due:string|null;
 owner_id:string;performers:string[];received_by?:string[];
 daily?:boolean;daily_done_today?:boolean
}
export type WorkAlertRow={item:WorkAlertItem;unread:number}
export type WorkWarningType='Mới giao'|'Đến hạn hôm nay'|'Quá hạn'|'Tin chưa đọc'|'Nhắc hằng ngày'
const ended=(status:string)=>['hoan thanh','da xong','huy'].includes(
 status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim()
)
export function workWarningReasons(row:WorkAlertRow,who:string,supervisor:boolean,today:string):WorkWarningType[]{
 const item=row.item,done=ended(item.status||''),recipients=item.performers||[],received=item.received_by||[]
 const own=recipients.includes(who)
 const unconfirmed=recipients.some(id=>!received.includes(id))
 const assignedNew=!done&&item.status==='Mới'&&(
  own?!received.includes(who):(supervisor||item.owner_id===who)&&unconfirmed
 )
 const daily=Boolean(item.daily)&&!done
 const due=typeof item.due==='string'?item.due:''
 const types:WorkWarningType[]=[]
 if(assignedNew)types.push('Mới giao')
 if(!done&&!daily&&due===today)types.push('Đến hạn hôm nay')
 if(!done&&!daily&&due&&due<today)types.push('Quá hạn')
 if(Number(row.unread)>0)types.push('Tin chưa đọc')
 if(daily&&!item.daily_done_today&&(!due||due<=today))types.push('Nhắc hằng ngày')
 return types
}

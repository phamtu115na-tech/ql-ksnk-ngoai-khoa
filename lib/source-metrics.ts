export type SourceMetric={label:string;unit:string;method:'sum'|'count'|'distinct'|'ratio'|'latest';column:string;denominator?:string}
export type SourceConfig={name:string;spreadsheet:string;sheet:string;dateColumn:string;metrics:SourceMetric[]}
export function validSource(s:SourceConfig){
 if(!s||![s.name,s.sheet,s.dateColumn].every(v=>typeof v==='string'&&v.trim()&&v.length<=160)||typeof s.spreadsheet!=='string')return false
 if(!/^[\w-]{20,}$/.test(s.spreadsheet)&&!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+(?:[/?#]|$)/.test(s.spreadsheet))return false
 return Array.isArray(s.metrics)&&s.metrics.length>0&&s.metrics.length<=40&&s.metrics.every(m=>m&&['sum','count','distinct','ratio','latest'].includes(m.method)&&typeof m.label==='string'&&m.label.trim()&&m.label.length<=160&&typeof m.unit==='string'&&m.unit.length<=60&&(m.method==='count'||typeof m.column==='string'&&m.column.trim())&&(m.method!=='ratio'||typeof m.denominator==='string'&&m.denominator.trim()))
}
function numberValue(raw:string){
 const t=(raw??'').trim().replace(/\s/g,'')
 if(!t||!/^[-+]?\d+(?:[.,]\d+)?$/.test(t))throw Error('Ô số không hợp lệ. Định dạng số nguồn cần thống nhất và bỏ dấu phân tách hàng nghìn.')
 return Number(t.replace(',','.'))
}
function isoDate(raw:string){
 const iso=/^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/.exec(raw)
 const dmy=/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:$| )/.exec(raw)
 const key=iso?iso.slice(1).join('-'):dmy?[dmy[3],dmy[2].padStart(2,'0'),dmy[1].padStart(2,'0')].join('-'):''
 if(!key||!Number.isFinite(Date.parse(key))||new Date(key).toISOString().slice(0,10)!==key)throw Error('Ngày nguồn không hợp lệ.')
 return key
}
export function sourceMetrics(cfg:SourceConfig,table:string[][],from:string,to:string){
 if(!table.length)throw Error('Tab nguồn rỗng.')
 if(table.length>50001)throw Error('Nguồn vượt quá 50.000 dòng. Chọn tab đã tổng hợp.')
 const headers=table[0].map(v=>v.trim().toLocaleLowerCase('vi'))
 function column(label:string){const key=label.trim().toLocaleLowerCase('vi'),idx=headers.indexOf(key);if(idx<0||headers.lastIndexOf(key)!==idx)throw Error('Cột bị thiếu hoặc trùng tên: '+label);return idx}
 const date=column(cfg.dateColumn)
 const rows=table.slice(1).filter(row=>row.some(v=>v.trim())).map(row=>({row,date:isoDate(row[date]||'')})).filter(r=>(!from||r.date>=from)&&(!to||r.date<=to))
 return cfg.metrics.map(m=>{
  const idx=m.method==='count'?-1:column(m.column),den=m.method==='ratio'?column(m.denominator!):-1
  let value:number|null=null
  if(rows.length){
   switch(m.method){
    case 'count':value=rows.length;break;
    case 'sum':value=rows.reduce((s,r)=>s+numberValue(r.row[idx]),0);break;
    case 'distinct':value=new Set(rows.map(r=>r.row[idx]?.trim()).filter(Boolean)).size;break;
    case 'ratio':{const denominator=rows.reduce((s,r)=>s+numberValue(r.row[den]),0);value=denominator?100*rows.reduce((s,r)=>s+numberValue(r.row[idx]),0)/denominator:null;break}
    case 'latest':value=numberValue(rows.reduce((a,b)=>a.date>b.date?a:b).row[idx]);break
   }
  }
  return {label:m.label,unit:m.method==='ratio'?'%':m.unit,value,rows:rows.length}
 })
}

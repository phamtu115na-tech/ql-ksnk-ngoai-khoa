export function ksnkDepartment(value:unknown){return typeof value==='string'&&/ksnk/i.test(value)}
export function activeDepartment(value:unknown){
 const normalized=String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim()
 return !['da xoa','xoa','ngung','ngung su dung','tam ngung'].includes(normalized)
}

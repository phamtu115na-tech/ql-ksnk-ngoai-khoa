'use client'
import {useEffect,useState} from 'react'
import {defaultMenu,type MenuItem} from '../lib/menu'
export default function MenuSettings(){
 const [items,set]=useState<MenuItem[]>(defaultMenu),[version,setVersion]=useState<string|null>(null),[message,notify]=useState(''),[ready,setReady]=useState(false)
 useEffect(()=>{fetch('/api/settings/menu').then(async r=>{if(!r.ok)throw Error('Không tải được danh mục.');const d=await r.json();set(d.items);setVersion(d.version);setReady(true)}).catch(e=>notify(e.message))},[])
 function move(i:number,j:number){const next=[...items];[next[i],next[j]]=[next[j],next[i]];set(next)}
 async function save(){setReady(false);try{const r=await fetch('/api/settings/menu',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items,version})});const d=await r.json();if(!r.ok)throw Error(d.error);setVersion(d.version);window.dispatchEvent(new Event('ksnk-menu-updated'));notify('Đã cập nhật thanh điều hướng.')}catch(e){notify(String(e))}finally{setReady(true)}}
 return <details><summary>Tên hiển thị và thứ tự các phân hệ</summary><fieldset disabled={!ready}>{items.map((x,i)=><div key={x.key}><label>{i+1}. <input value={x.label} maxLength={90} onChange={e=>set(items.map((v,j)=>j===i?{...v,label:e.target.value}:v))}/></label><button aria-label={'Đưa lên '+x.label} disabled={i===0} onClick={()=>move(i,i-1)}>↑</button><button aria-label={'Đưa xuống '+x.label} disabled={i===items.length-1} onClick={()=>move(i,i+1)}>↓</button></div>)}<button onClick={save}>Lưu tên và thứ tự</button></fieldset><p role="status">{message}</p></details>
}

'use client'
import {useEffect,useState} from 'react'
import MatrixExplorer from './MatrixExplorer'
import type {Mark} from '../lib/matrix'
type Payload={formMatrices:{formCode:string;formName:string;marks:Mark[]}[];canExport:boolean}
export default function ScopedMatrix(){
 const [filters,setFilters]=useState({from:'',to:''}),[payload,setPayload]=useState<Payload|null>(null),[msg,message]=useState(''),[code,setCode]=useState('')
 useEffect(()=>{let active=true;setPayload(null);message('Đang tải ma trận…');fetch('/api/report/scoped?'+new URLSearchParams(filters)).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);if(active){setPayload(d);setCode(d.formMatrices[0]?.formCode||'');message(d.formMatrices.length?'':'Chưa có lượt chấm trong kỳ.')}}).catch(e=>{if(active)message(e.message)});return()=>{active=false}},[filters])
 const matrix=payload?.formMatrices.find(r=>r.formCode===code)
 return <section className="panel-card"><h3>Ma trận giám sát theo quyền được cấp</h3>{(['from','to'] as const).map(k=><label key={k}>{k==='from'?'Từ ngày':'Đến ngày'} <input type="date" value={filters[k]} onChange={e=>setFilters({...filters,[k]:e.target.value})}/></label>)}<p role="status">{msg}</p>{matrix&&<><select aria-label="Mẫu phiếu" value={code} onChange={e=>setCode(e.target.value)}>{payload?.formMatrices.map(r=><option key={r.formCode} value={r.formCode}>{r.formName}</option>)}</select><MatrixExplorer key={code} form={matrix.formName} code={code} marks={matrix.marks} filters={filters} canExport={!!payload?.canExport}/></>}</section>
}

'use client';
import {useEffect,useState} from 'react';

export default function WorkBoard(){
 const [src,setSrc]=useState('');
 useEffect(()=>{
  const params=new URLSearchParams(location.search);
  const tab=params.get('work')||'task',query=new URLSearchParams({board:'1'});
  if(params.get('thread'))query.set('thread',params.get('thread')!);
  setSrc('/connect/index.html?'+query+'#'+(['chat','reminder','all','admin','account','task'].includes(tab)?tab:'task'));
 },[]);
 return src?<iframe title="Giao việc và nhắc việc Ngoại khoa" className="nk-workboard" src={src}/>:null;
}

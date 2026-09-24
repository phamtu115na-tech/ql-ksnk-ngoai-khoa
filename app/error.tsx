'use client';

import {useEffect} from 'react';

type AppError=Error & {digest?:string};

export default function Error({error,reset}:{error:AppError;reset:()=>void}){
 useEffect(()=>{
  console.error('[app/error] client render failed',{
   message:error?.message||'Unknown client error',
   stack:error?.stack||'',
   digest:error?.digest||''
  });
 },[error]);
 return <main className="login-screen"><section className="login-card" role="alert"><h1>Không tải được màn hình</h1><p>Ứng dụng gặp lỗi khi hiển thị dữ liệu. Bấm tải lại để thử lại phiên hiện tại.</p><button type="button" onClick={()=>reset()}>TẢI LẠI ỨNG DỤNG</button></section></main>;
}

'use client';

import {useEffect} from 'react';

type AppError=Error & {digest?:string};

export default function GlobalError({error,reset}:{error:AppError;reset:()=>void}){
 useEffect(()=>{
  console.error('[global-error] client render failed',{
   message:error?.message||'Unknown client error',
   stack:error?.stack||'',
   digest:error?.digest||''
  });
 },[error]);
 return <html lang="vi"><body><main style={{fontFamily:'Arial,sans-serif',maxWidth:640,margin:'80px auto',padding:24}}><h1>Không tải được ứng dụng</h1><p>Ứng dụng gặp lỗi khi khởi tạo. Bấm tải lại để thử lại.</p><button type="button" onClick={()=>reset()}>TẢI LẠI ỨNG DỤNG</button></main></body></html>;
}

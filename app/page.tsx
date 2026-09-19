'use client';

const LEGACY_APP_URL='https://script.google.com/macros/s/AKfycbwH2uQG6rF24UqobU3wgbqd0cAhOay-ZxiVK77FuFWCWKBR7DTV7ahHcc7UL7SUH0Gv/exec';

export default function Home(){
 return <main style={{position:'fixed',inset:0,width:'100vw',height:'100dvh',background:'#f4f6f9',overflow:'hidden'}}>
  <iframe
   src={LEGACY_APP_URL}
   title="Hệ thống Quản lý KSNK - Bệnh viện 115"
   allow="camera; microphone; clipboard-read; clipboard-write"
   referrerPolicy="no-referrer-when-downgrade"
   style={{display:'block',width:'100%',height:'100%',border:0,background:'#f4f6f9'}}
  />
 </main>;
}

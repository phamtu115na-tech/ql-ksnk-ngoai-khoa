/**
 * Collect evidence from visible report rows only. Never follow a remote image
 * URL or bypass /api/evidence: every download is re-authorised by the server.
 */
export type ReportPhoto={url:string;title:string;context:string;filename:string}
export function reportPhotoCandidates(card:HTMLElement):ReportPhoto[]{
 const result:ReportPhoto[]=[],unique=new Set<string>()
 const links=card.querySelectorAll<HTMLAnchorElement>('a.report-image-preview, a.report-evidence-link, .evidence-item a')
 for(const link of Array.from(links)){
  if(!link.getClientRects().length||getComputedStyle(link).visibility==='hidden')continue
  const url=new URL(link.getAttribute('href')||'',window.location.origin)
  if(url.origin!==window.location.origin||url.pathname!=='/api/evidence'||url.searchParams.get('open')!=='1')continue
  const image=link.querySelector('img')
  const label=(link.textContent||'').trim()
  const imageFile=image?.getAttribute('alt')||label
  if(!image&&!/XEM ẢNH|\.(?:jpe?g|png|webp)(?:\s|$)/i.test(imageFile))continue
  if(unique.has(url.href))continue
  const tableRow=link.closest('tr')
  const title=tableRow?.querySelector('.report-row-title')?.textContent?.trim()||
    tableRow?.querySelector('.report-error-content')?.textContent?.trim()||
    tableRow?.querySelector('td')?.textContent?.trim()||
    card.querySelector('h3')?.textContent?.trim()||'Minh chứng hoạt động'
  const owner=tableRow?.querySelector('.report-row-meta')?.textContent?.trim()||
    tableRow?.querySelector('td:nth-child(2)')?.textContent?.trim()||''
  result.push({url:url.pathname+url.search,title:title.slice(0,155),
   context:owner.slice(0,100),filename:imageFile.slice(0,155)})
  unique.add(url.href)
 }
 return result
}
export async function readReportPhoto(url:string):Promise<{data:string;ratio:number}>{
 const target=new URL(url,window.location.origin)
 if(target.origin!==window.location.origin||target.pathname!=='/api/evidence'||target.searchParams.get('open')!=='1')
  throw Error('Liên kết ảnh không thuộc API minh chứng được xác thực.')
 const reply=await fetch(target.pathname+target.search,{cache:'no-store',credentials:'same-origin'})
 if(!reply.ok)throw Error(reply.status===403?'Không có quyền xem ảnh này.':reply.status===401?
  'Phiên đăng nhập đã hết hạn.':'Không tải được ảnh ('+reply.status+').')
 const blob=await reply.blob()
 if(blob.size>9*1024*1024||!blob.type.startsWith('image/'))
  throw Error('Tệp minh chứng không phải ảnh được hỗ trợ.')
 const objectUrl=URL.createObjectURL(blob)
 try{
  const image=new Image()
  await new Promise<void>((resolve,reject)=>{
   image.onload=()=>resolve()
   image.onerror=()=>reject(Error('Không thể giải mã hình ảnh minh chứng.'))
   image.src=objectUrl
  })
  const naturalW=image.naturalWidth,naturalH=image.naturalHeight
  if(!naturalW||!naturalH)throw Error('Kích thước ảnh không hợp lệ.')
  const ratio=naturalW/naturalH
  const scale=Math.min(1,1600/naturalW,1200/naturalH)
  const canvas=document.createElement('canvas')
  canvas.width=Math.max(1,Math.round(naturalW*scale))
  canvas.height=Math.max(1,Math.round(naturalH*scale))
  const ctx=canvas.getContext('2d')
  if(!ctx)throw Error('Trình duyệt không hỗ trợ xuất ảnh báo cáo.')
  ctx.fillStyle='#FFFFFF'
  ctx.fillRect(0,0,canvas.width,canvas.height)
  ctx.drawImage(image,0,0,canvas.width,canvas.height)
  return {data:canvas.toDataURL('image/jpeg',.83),ratio}
 }finally{URL.revokeObjectURL(objectUrl)}
}

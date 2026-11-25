'use client'

import {useState,type RefObject} from 'react'
import {captureVisibleReportCharts,fitChartImage} from '../lib/report-chart-capture'
import {reportPhotoCandidates,readReportPhoto,type ReportPhoto} from '../lib/report-evidence-export'

type Region={id:string;label:string}
type ExportMode='summary'|'detailed'
const BLUE='153E68',RED='CF4554',PEACH='11A18B',INK='1D334C',GREY='62748B',LIGHT='F2F6FC'
const PAGE_ROWS=6

function shortened(value:unknown,max=150):string{
 const text=String(value??'').replace(/\s+/g,' ').trim()
 return text.length>max?text.slice(0,max-1).trimEnd()+'…':text
}
function shown(el:HTMLElement):boolean{
 return el.getClientRects().length>0&&getComputedStyle(el).visibility!=='hidden'
}
function cellText(el:HTMLElement):string{
 const clone=el.cloneNode(true) as HTMLElement
 clone.querySelectorAll('button,script,style,svg,input,select,textarea').forEach(node=>node.remove())
 return shortened(clone.textContent||'',450)||'—'
}
function formatPeriod(period:string){
 return period.replace(/(\d{4})-(\d\d)-(\d\d)/g,(_s,y,m,d)=>d+'/'+m+'/'+y)
}
function fileSafe(value:string){return value.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,64)||'bao-cao'}
function bars(slide:any,pptx:any,y:number){
 for(const [x,w,color] of [[0,6.66,BLUE],[6.66,3.34,RED],[10,3.34,PEACH]] as const){
  slide.addShape(pptx.ShapeType.rect,{x,y,w,h:.09,line:{color},fill:{color}})
 }
}
function write(slide:any,text:string,x:number,y:number,w:number,h:number,size:number,color=INK,bold=false,align:'left'|'center'|'right'='left'){
 slide.addText(shortened(text,400),{x,y,w,h,fontFace:'Arial',fontSize:size,color,bold,align,
  margin:0,breakLine:false,fit:'shrink',valign:'mid'})
}
function brand(slide:any,pptx:any,small=false){
 slide.background={color:'FFFFFF'}
 slide.addShape(pptx.ShapeType.rect,{x:0,y:0,w:13.333,h:small?.12:.2,line:{color:BLUE},fill:{color:BLUE}})
 const lx=small?.35:.32,ly=small?.29:.42,diameter=small?.47:.72
 slide.addShape(pptx.ShapeType.ellipse,{x:lx,y:ly,w:diameter,h:diameter,line:{color:BLUE,width:small?1:2},fill:{color:'FFFFFF'}})
 slide.addShape(pptx.ShapeType.ellipse,{x:lx+.065,y:ly+.065,w:diameter-.13,h:diameter-.13,line:{color:BLUE,width:.6},fill:{color:'E9F0FF'}})
 write(slide,'115',lx+.06,ly+diameter*.34,diameter-.12,diameter*.34,small?12:17,RED,true,'center')
 if(small){
  write(slide,'BỆNH VIỆN NGOẠI KHOA 115 NGHỆ AN',.99,.23,9.8,.28,16,BLUE,true)
  write(slide,'KHOA KSNK',1,.57,4.8,.19,10,BLUE,true)
  bars(slide,pptx,.93)
 }else{
  write(slide,'BỆNH VIỆN NGOẠI KHOA 115 NGHỆ AN',1.10,.38,10.8,.34,23,BLUE,true)
  write(slide,'“Tất cả vì sức khỏe của bạn”',1.28,.75,8.1,.23,13,BLUE)
  write(slide,'KHOA KSNK',1.28,1.04,5.8,.34,23,BLUE,true)
  bars(slide,pptx,1.39)
 }
 bars(slide,pptx,7.4)
}
function sectionSlide(pptx:any,title:string,scope:string,period:string,page:number){
 const slide=pptx.addSlide()
 brand(slide,pptx,true)
 write(slide,shortened(title,100),.63,1.18,12,.52,23,INK,true)
 slide.addShape(pptx.ShapeType.rect,{x:.64,y:1.79,w:1.15,h:.055,line:{color:RED},fill:{color:RED}})
 write(slide,formatPeriod(period),.65,1.95,6,.24,10,GREY)
 write(slide,shortened(scope,95),6.5,1.95,6.15,.24,10,GREY,false,'right')
 write(slide,'KHOA KIỂM SOÁT NHIỄM KHUẨN',.66,7.06,9,.2,9,GREY)
 write(slide,'Trang '+page,11.4,7.06,1.2,.2,9,GREY,false,'right')
 return slide
}
function fillEmpty(slide:any,reason:string,pptx:any){
 slide.addShape(pptx.ShapeType.roundRect,{x:.7,y:2.72,w:11.9,h:1.05,line:{color:'D7E0F0'},fill:{color:LIGHT},radius:.08})
 write(slide,reason,.92,3.01,11.4,.43,17,GREY,false,'center')
}
function getTables(card:HTMLElement){
 return Array.from(card.querySelectorAll('table')).filter(table=>shown(table as HTMLElement)).map(table=>{
  const all=Array.from(table.rows).filter(row=>shown(row))
  const header=table.tHead?.rows[0]||all[0]
  const columns=header?Array.from(header.cells).map(cell=>cellText(cell)):[]
  const body=table.tBodies.length?Array.from(table.tBodies).flatMap(b=>Array.from(b.rows)):all.slice(1)
  const rows=body.filter(r=>shown(r)).map(r=>Array.from(r.cells).map(c=>cellText(c)))
  return {columns,rows}
 }).filter(t=>t.columns.length||t.rows.length)
}
function getNotes(card:HTMLElement){
 const selection=card.querySelectorAll<HTMLElement>('h4,h5,p,li,.report-matrix-metrics>div,.cssd-metric-grid>div,.report-kpi-summary>div')
 const notes=Array.from(selection).filter(el=>shown(el)&&!el.closest('table')&&!el.closest('button'))
  .map(el=>shortened(cellText(el),175)).filter(x=>x.length>2)
 return [...new Set(notes)].slice(0,36)
}
function addChartPages(pptx:any,card:HTMLElement,heading:string,scope:string,period:string,inc:()=>number){
 const snapshots=captureVisibleReportCharts(card,heading)
 for(const snapshot of snapshots){
  const slide=sectionSlide(pptx,heading,scope,period,inc())
  write(slide,shortened(snapshot.title,100),.73,2.24,11.8,.40,17,BLUE,true)
  let chartTop=2.82
  if(snapshot.metrics.length){
   const n=snapshot.metrics.length,gap=.13,width=(11.87-(n-1)*gap)/n
   snapshot.metrics.forEach((metric,i)=>{
    const x=.73+i*(width+gap)
    slide.addShape(pptx.ShapeType.roundRect,{x,y:2.75,w:width,h:.75,
     rectRadius:.06,line:{color:'D7E2F5'},fill:{color:LIGHT}})
    write(slide,metric.label,x+.10,2.85,width-.20,.19,10,GREY,true)
    write(slide,metric.value,x+.10,3.13,width-.20,.24,18,BLUE,true)
   })
   chartTop=3.65
  }
  const availableHeight=6.68-chartTop
  const image=fitChartImage(snapshot.ratio,11.9,availableHeight)
  // Preserve the actual chosen Chart.js type, ranking, labels and colour
  // through a PNG snapshot; tables remain separately editable PPT elements.
  slide.addImage({data:snapshot.png,x:.72+(11.9-image.w)/2,
   y:chartTop+(availableHeight-image.h)/2,w:image.w,h:image.h})
  write(slide,shortened(snapshot.caption,170),.75,6.77,11.8,.16,9,GREY)
 }
 return snapshots.length
}
/**
 * Evidence slide: original image with source item and responsible department.
 * Two photographs per page keep the layout legible on 16:9 meeting screens.
 */
function addEvidenceSlide(pptx:any,heading:string,scope:string,period:string,
 images:Array<{photo:ReportPhoto;data:string;ratio:number}>,inc:()=>number){
 const slide=sectionSlide(pptx,heading+' · ẢNH MINH CHỨNG',scope,period,inc())
 write(slide,'ẢNH MINH CHỨNG THỰC TẾ',.73,2.27,10.7,.3,16,BLUE,true)
 images.forEach(({photo,data,ratio},i)=>{
  const x=.71+i*6.04,boxWidth=5.89,photoHeight=3.40,top=2.74
  slide.addShape(pptx.ShapeType.roundRect,{x,y:top,w:boxWidth,h:3.85,
   rectRadius:.09,line:{color:'D5E2F1',width:1},fill:{color:'F8FAFD'}})
  const fitted=fitChartImage(ratio,boxWidth-.36,photoHeight-.28)
  slide.addImage({data,x:x+(boxWidth-fitted.w)/2,y:top+.12+(photoHeight-.28-fitted.h)/2,
   w:fitted.w,h:fitted.h})
  write(slide,shortened(photo.title,93),x+.18,6.20,boxWidth-.36,.25,11,INK,true)
  if(photo.context)write(slide,shortened(photo.context,90),x+.18,6.48,boxWidth-.36,.17,9,GREY)
 })
}
async function addEvidencePages(pptx:any,card:HTMLElement,heading:string,scope:string,period:string,
 maxImages:number,inc:()=>number){
 const candidates=reportPhotoCandidates(card)
 const loaded:Array<{photo:ReportPhoto;data:string;ratio:number}>=[]
 const errors:string[]=[]
 for(const photo of candidates.slice(0,maxImages)){
  try{
   const image=await readReportPhoto(photo.url)
   loaded.push({photo,...image})
  }catch(err){
   errors.push(shortened(photo.title,70)+': '+(err instanceof Error?err.message:'Không tải được'))
  }
 }
 for(let i=0;i<loaded.length;i+=2)addEvidenceSlide(pptx,heading,scope,period,loaded.slice(i,i+2),inc)
 return {count:loaded.length,skipped:Math.max(0,candidates.length-maxImages),errors}
}
function addTablePages(pptx:any,heading:string,scope:string,period:string,table:{columns:string[];rows:string[][]},limit:number,inc:()=>number){
 const headers=table.columns.length?table.columns:table.rows[0]?.map((_,i)=>'Cột '+(i+1))||[]
 const rows=table.rows.slice(0,limit)
 const bandCount=Math.max(1,Math.ceil(Math.max(0,headers.length-1)/4))
 for(let b=0;b<bandCount;b++){
  const indices=[0,...Array.from({length:4},(_,i)=>b*4+i+1).filter(i=>i<headers.length)]
  for(let start=0;start<Math.max(1,rows.length);start+=PAGE_ROWS){
   const slide=sectionSlide(pptx,heading,scope,period,inc())
   write(slide,'Bảng dữ liệu '+(b+1)+'/'+bandCount+'  ·  Dòng '+(rows.length?start+1:0)+'–'+Math.min(start+PAGE_ROWS,rows.length)+'/'+table.rows.length,.72,2.27,11.4,.22,11,GREY)
   const top=2.63,x0=.68,totalWidth=11.96,hh=.53,rowH=.63
   const count=indices.length,widths=indices.map((_,i)=>count===1?totalWidth:i===0?Math.min(3.15,totalWidth*.33):(totalWidth-Math.min(3.15,totalWidth*.33))/(count-1))
   const drawCell=(text:string,j:number,y:number,h:number,fill:string,fg:string,bold:boolean)=>{
    const x=x0+widths.slice(0,j).reduce((n,w)=>n+w,0)
    slide.addShape(pptx.ShapeType.rect,{x,y,w:widths[j],h,line:{color:'DCE5F3',width:.5},fill:{color:fill}})
    write(slide,shortened(text,85),x+.09,y+.055,widths[j]-.18,h-.11,bold?12:11,fg,bold)
   }
   indices.forEach((col,j)=>drawCell(headers[col]||'Cột '+(col+1),j,top,hh,BLUE,'FFFFFF',true))
   rows.slice(start,start+PAGE_ROWS).forEach((row,i)=>indices.forEach((col,j)=>drawCell(row[col]||'—',j,top+hh+i*rowH,rowH,i%2===0?'F1F5FC':'FFFFFF',INK,j===0)))
   if(!rows.length)write(slide,'Không có dữ liệu trong bảng.',.95,3.4,11,.43,17,GREY)
  }
 }
 return Math.max(0,table.rows.length-rows.length)
}
export default function ScreenReportExport({root,regions,scope,period,canExport}:{
 root:RefObject<HTMLDivElement|null>;regions:Region[];scope:string;period:string;canExport:boolean
}){
 const [region,setRegion]=useState(''),[mode,setMode]=useState<ExportMode>('summary'),[includePhotos,setIncludePhotos]=useState(true)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const active=regions.some(r=>r.id===region)?region:''
 async function download(){
  if(!canExport||!root.current||busy)return
  const targets=Array.from(root.current.querySelectorAll<HTMLElement>('[data-report-region]'))
   .filter(card=>shown(card)&&(!active||card.dataset.reportRegion===active))
  if(!targets.length){setError('Chưa có vùng báo cáo đang hiển thị để xuất.');return}
  setBusy(true);setError('');setNotice('')
  try{
   const {default:PptxGenJS}=await import('pptxgenjs')
   const pptx=new PptxGenJS()
   pptx.layout='LAYOUT_WIDE'
   pptx.author='Khoa Kiểm soát nhiễm khuẩn – Bệnh viện Ngoại khoa 115 Nghệ An'
   pptx.subject='Báo cáo theo các mục và bộ lọc đang hiển thị'
   pptx.title='BÁO CÁO CÔNG TÁC KSNK – '+formatPeriod(period)
   let pages=0,omitted=0,chartCount=0,photoCount=0
   let remainingPhotos=mode==='summary'?20:40
   const photoWarnings:string[]=[]
   const next=()=>++pages
   const cover=pptx.addSlide();next();brand(cover,pptx)
   write(cover,'BÁO CÁO CÔNG TÁC',1.45,2.55,10.45,.68,37,BLUE,true,'center')
   write(cover,'GIÁM SÁT KSNK',1.45,3.32,10.45,.65,35,BLUE,true,'center')
   write(cover,'TỪ '+formatPeriod(period).toUpperCase(),1.00,4.13,11.33,.54,25,RED,true,'center')
   write(cover,scope.toUpperCase(),1.68,5.05,9.95,.43,20,BLUE,true,'center')
   write(cover,'Dữ liệu theo kỳ, bộ phận và nội dung đã chọn',2.0,5.58,9.34,.29,12,GREY,false,'center')

   const stats=root.current.querySelector('.summary-cards')
   if(stats&&shown(stats as HTMLElement)){
    const tiles=Array.from(stats.children).slice(0,6).map(el=>({
     value:shortened(el.querySelector('b')?.textContent,20),
     label:shortened(el.querySelector('span')?.textContent,56)
    }))
    if(tiles.length){
     const s=sectionSlide(pptx,'TỔNG QUAN KẾT QUẢ',scope,period,next())
     tiles.forEach((item,i)=>{
      const x=.71+(i%3)*4.16,y=2.54+Math.floor(i/3)*1.65
      s.addShape(pptx.ShapeType.roundRect,{x,y,w:3.93,h:1.39,rectRadius:.09,line:{color:'D7E2F5'},fill:{color:LIGHT}})
      write(s,item.label.toUpperCase(),x+.2,y+.17,3.5,.36,12,GREY,true)
      write(s,item.value,x+.2,y+.62,3.48,.58,30,i===2?RED:BLUE,true)
     })
    }
   }
   const limit=mode==='summary'?12:60
   for(const card of targets){
    const item=regions.find(r=>r.id===card.dataset.reportRegion)
    const heading=item?.label||card.querySelector('h3')?.textContent||'Nội dung giám sát KSNK'
    chartCount+=addChartPages(pptx,card,heading,scope,period,next)
    if(includePhotos){
     const photos=await addEvidencePages(pptx,card,heading,scope,period,remainingPhotos,next)
     remainingPhotos=Math.max(0,remainingPhotos-photos.count)
     photoCount+=photos.count
     omitted+=photos.skipped
     photoWarnings.push(...photos.errors)
    }
    const tables=getTables(card)
    if(tables.length){
     let budget=limit
     for(const table of tables){
      if(budget<=0){omitted+=table.rows.length;continue}
      const allocated=Math.min(table.rows.length,budget)
      omitted+=addTablePages(pptx,heading,scope,period,table,allocated,next)
      budget-=allocated
     }
    }else{
     const notes=getNotes(card)
     if(!notes.length){const s=sectionSlide(pptx,heading,scope,period,next());fillEmpty(s,'Không có dữ liệu trong kỳ hoặc phạm vi đã chọn.',pptx);continue}
     const content=notes.slice(0,limit)
     omitted+=Math.max(0,notes.length-content.length)
     for(let start=0;start<content.length;start+=PAGE_ROWS){
      const slide=sectionSlide(pptx,heading,scope,period,next())
      content.slice(start,start+PAGE_ROWS).forEach((note,i)=>{
       const y=2.47+i*.69
       slide.addShape(pptx.ShapeType.roundRect,{x:.7,y,w:11.95,h:.60,line:{color:'DFE6F2'},fill:{color:i%2===0?LIGHT:'FFFFFF'}})
       slide.addShape(pptx.ShapeType.rect,{x:.7,y,w:.055,h:.60,line:{color:i%2===0?BLUE:PEACH},fill:{color:i%2===0?BLUE:PEACH}})
       write(slide,note,.94,y+.11,11.37,.35,14,INK,i===0)
      })
     }
    }
   }
   if(omitted){
    const s=sectionSlide(pptx,'GHI CHÚ GIỚI HẠN TRÌNH CHIẾU',scope,period,next())
    fillEmpty(s,'Có '+omitted+' dòng ngoài giới hạn '+limit+' dòng/mục; xem đầy đủ trong hệ thống.',pptx)
   }
   const fileName='Bao-cao-KSNK-'+fileSafe(period)+'-'+mode+'.pptx'
   await pptx.writeFile({fileName})
   setNotice('Đã tạo '+pages+' slide, '+chartCount+' biểu đồ và '+photoCount+' ảnh minh chứng. '+
    (omitted?'Đã rút gọn '+omitted+' mục theo chế độ trình chiếu. ':'')+
    (photoWarnings.length?'Có '+photoWarnings.length+' ảnh không thể xuất (quyền truy cập/tệp không hợp lệ): '+photoWarnings.slice(0,3).join(' | '):'Ảnh đã được kiểm tra quyền trước khi đưa vào báo cáo.'))
  }catch(e){setError(e instanceof Error?'Xuất PowerPoint thất bại: '+e.message:'Không xuất được PowerPoint.')}
  finally{setBusy(false)}
 }
 return <section className="panel-card screen-export" aria-label="Xuất PowerPoint theo nội dung đang hiển thị">
  <div><strong>XUẤT BÁO CÁO POWERPOINT · 16:9</strong><small>Biểu đồ, chỉ số và bảng trong vùng đã chọn · {scope} · {formatPeriod(period)} · Chỉ xuất các mục đã chọn, trong quyền được xem</small></div>
  <div className="screen-export-controls">
   <label>Vùng xuất<select value={active} onChange={e=>setRegion(e.target.value)} disabled={busy}>
    <option value="">Tất cả mục đang hiển thị ({regions.length})</option>
    {regions.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
   </select></label>
   <label>Chế độ trình chiếu<select value={mode} onChange={e=>setMode(e.target.value as ExportMode)} disabled={busy}>
    <option value="summary">Gọn · 12 dòng/mục</option>
    <option value="detailed">Chi tiết · 60 dòng/mục</option>
   </select></label>
   <label className="screen-export-photos"><input type="checkbox" checked={includePhotos} onChange={e=>setIncludePhotos(e.target.checked)} disabled={busy}/> Kèm ảnh minh chứng</label>
   <button type="button" className="add-btn" disabled={!canExport||busy||!regions.length} onClick={download}>{busy?'ĐANG TẠO POWERPOINT…':'⇩ XUẤT POWERPOINT (.PPTX)'}</button>
  </div>
  {!canExport&&<p role="status">Chưa được cấp quyền xuất báo cáo. Quản trị viên có thể bật quyền trong Cài đặt → Phân quyền báo cáo.</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>
}

'use client'

import {useState, type RefObject} from 'react'

type Region = {id:string; label:string}

function visibleText(element:HTMLElement):string {
  if (!element.getClientRects().length || element.matches('button,.report-autosave-hint,script,style')) return ''
  if (element instanceof HTMLSelectElement) return element.selectedOptions[0]?.text || ''
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) return element.value
  return Array.from(element.childNodes).map(node => node instanceof HTMLElement
    ? visibleText(node) : node.textContent || '').join(' ').replace(/\s+/g,' ').trim()
}

export default function ScreenReportExport({root,regions,scope,period}:{
  root:RefObject<HTMLDivElement|null>;regions:Region[];scope:string;period:string
}) {
  const [region,choose]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState('')
  const active=regions.some(r=>r.id===region)?region:''
  async function download() {
    if (!root.current || busy) return
    const cards=Array.from(root.current.querySelectorAll<HTMLElement>('[data-report-region]'))
      .filter(card=>card.getClientRects().length && (!active || card.dataset.reportRegion===active))
    if (!cards.length) return
    setBusy(true)
    setError('')
    try {
      const {default:Pptx}=await import('pptxgenjs')
      const deck=new Pptx()
      deck.layout='LAYOUT_WIDE'
      deck.title='Báo cáo KSNK · '+scope
      let slideCount=0
      const newSlide=(title:string)=>{
        slideCount++
        const slide=deck.addSlide()
        slide.addText(title,{x:.5,y:.3,w:12.3,h:.7,fontSize:23,bold:true,color:'17416F',fit:'shrink'})
        slide.addText([scope,period].filter(Boolean).join('  ·  '),{x:.5,y:7,w:12.3,h:.27,fontSize:11,color:'496179'})
        return slide
      }
      for (const card of cards) {
        const heading=card.querySelector('h3')
        const title=heading?.textContent || 'Báo cáo KSNK'
        let notes:string[]=[]
        const flush=()=>{
          if (!notes.length) return
          const lines=notes.join('\n').match(/[\s\S]{1,950}(?:\s|$)|[\s\S]{1,950}/g)||[]
          for(const line of lines) newSlide(title).addText(line.trim(),{x:.6,y:1.15,w:12,h:5.5,fontSize:18,fit:'shrink',valign:'top'})
          notes=[]
        }
        function render(el:HTMLElement) {
          if (!el.getClientRects().length || el===heading || el.matches('button,.report-autosave-hint,script,style')) return
          if (el instanceof HTMLCanvasElement) {
            if (!el.width || !el.height) return
            flush()
            const data=el.toDataURL('image/png')
            newSlide(title).addImage({data,...deckSizing(el.width,el.height)})
            return
          }
          if (el instanceof HTMLTableElement) {
            flush()
            const rows=Array.from(el.rows).filter(r=>r.getClientRects().length).map(r=>Array.from(r.cells).map(c=>visibleText(c)||c.querySelector('button')?.textContent||'—'))
            if(!rows.length)return
            const count=Math.max(...rows.map(row=>row.length))
            for(let start=1;start<Math.max(count,2);start+=5) {
              const band=rows.map((row,i)=>[row[0],...row.slice(start,start+5)].map(cell=>({text:cell||'—',options:i===0?{bold:true,color:'FFFFFF',fill:{color:'17416F'}}:{}})))
              newSlide(title).addTable(band,{x:.5,y:1.1,w:12.3,h:5.65,fontSize:13,margin:.06,border:{pt:.5,color:'CDD9E4'},autoPage:true,autoPageRepeatHeader:true,newSlideStartY:.55})
            }
            return
          }
          if (el.querySelector('table,canvas') || el===card) {
            for (const child of Array.from(el.children)) if(child instanceof HTMLElement) render(child)
          } else {
            const content=visibleText(el)
            if(content) notes.push(content)
          }
        }
        const before=slideCount
        render(card)
        flush()
        if(slideCount===before)newSlide(title).addText('Chưa có dữ liệu trong kỳ',{x:.6,y:1.3,w:12,h:.6,fontSize:18})
      }
      await deck.writeFile({fileName:'Bao-cao-KSNK-'+(period||'hien-tai').replace(/[^0-9-]+/g,'_')+'.pptx'})
    } catch {setError('Xuất PowerPoint chưa thành công. Vui lòng thử lại.')}
    finally {setBusy(false)}
  }
  return <section className="panel-card screen-export" aria-label="Xuất PowerPoint theo màn hình">
    <div><strong>Xuất PowerPoint theo màn hình</strong><small>{scope} · {period}</small></div>
    <label>Vùng xuất<select value={active} onChange={e=>choose(e.target.value)} disabled={busy}>
      <option value="">Tất cả mục đang hiển thị ({regions.length})</option>
      {regions.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
    </select></label>
    <button className="add-btn" disabled={busy||!regions.length} onClick={download}>{busy?'Đang tạo tệp…':'Xuất PowerPoint'}</button>
    {error&&<p role="alert">{error}</p>}
  </section>
}

function deckSizing(width:number,height:number) {
  const ratio=Math.min(12.2/width,5.5/height)
  const w=width*ratio,h=height*ratio
  return {x:(13.333-w)/2,y:1.1+(5.5-h)/2,w,h}
}

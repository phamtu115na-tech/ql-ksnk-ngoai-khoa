/**
 * Read rendered Chart.js canvases from the currently selected report region.
 * All pixels come from the authorised on-screen report; there is no extra data
 * fetch, and the exported graph preserves the chart kind/top-N filters.
 */
export type ChartSnapshot={
 title:string
 caption:string
 png:string
 ratio:number
 metrics:{label:string;value:string}[]
}
function visible(element:HTMLElement){
 return element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden'
}
export function captureVisibleReportCharts(card:HTMLElement,fallbackTitle:string):ChartSnapshot[]{
 const snapshots:ChartSnapshot[]=[]
 const sources=Array.from(card.querySelectorAll<HTMLElement>('[data-export-chart]'))
 for(const source of sources){
  if(!visible(source))continue
  const canvas=source.querySelector('canvas') as HTMLCanvasElement|null
  if(!canvas||!visible(canvas)||canvas.width<=0||canvas.height<=0)continue
  const parent=source.closest<HTMLElement>('.report-matrix-card')
  const title=parent?.querySelector<HTMLElement>('.report-matrix-head')?.textContent?.trim()||fallbackTitle
  const metrics=parent?Array.from(parent.querySelectorAll<HTMLElement>('.report-matrix-metrics > div'))
   .map(item=>({label:item.querySelector('small')?.textContent?.trim()||'',
    value:item.querySelector('b')?.textContent?.trim()||''}))
   .filter(item=>item.label&&item.value).slice(0,5):[]
  let png=''
  try{png=canvas.toDataURL('image/png')}catch{
   throw new Error('Không đọc được biểu đồ "'+title+'". Vui lòng tải lại báo cáo và thử xuất.')
  }
  if(!png.startsWith('data:image/png;base64,')||png.length<100)
   throw new Error('Biểu đồ "'+title+'" chưa được vẽ xong. Vui lòng thử xuất lại.')
  snapshots.push({title,caption:source.dataset.chartCaption||'Biểu đồ theo lựa chọn đang hiển thị',
   png,ratio:canvas.width/canvas.height,metrics})
 }
 return snapshots
}
export function fitChartImage(ratio:number,maxW:number,maxH:number){
 if(!Number.isFinite(ratio)||ratio<=0)throw new Error('Kích thước biểu đồ không hợp lệ.')
 const w=Math.min(maxW,maxH*ratio)
 return {w,h:w/ratio}
}

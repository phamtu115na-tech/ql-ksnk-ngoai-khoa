import {colors,levels} from './matrix'
export type ExportTable={
 title:string;period:string;department:string;columns:string[];rows:(number|string|null)[][]
 palette?:string[];labels?:string[];accent?:string;kind?:string;slogan?:string;unit?:string;chartImage?:string;chartCaption?:string;chart?:{labels:string[];pass:(number|null)[];fail:(number|null)[];errors:number[];passed:number[]}
}
export async function excel(data:ExportTable){
 const {Workbook}=await import('exceljs')
 const book=new Workbook()
 if(data.chartImage){
  const visual=book.addWorksheet('Biểu đồ')
  visual.mergeCells('A1:M2')
  visual.getCell('A1').value=data.title
  visual.getCell('A1').font={name:'Arial',size:19,bold:true,color:{argb:'FF'+(data.accent||'#17416F').replace('#','')}}
  visual.getCell('A3').value=data.department
  visual.getCell('A4').value=data.period
  visual.getCell('A5').value=data.chartCaption||'Kết quả giám sát theo biểu đồ đang hiển thị'
  visual.getCell('A5').font={name:'Arial',size:12,bold:true}
  for(let i=1;i<=14;i++)visual.getColumn(i).width=14
  const raw=Buffer.from(data.chartImage.slice('data:image/png;base64,'.length),'base64')
  const imageWidth=raw.readUInt32BE(16),imageHeight=raw.readUInt32BE(20)
  const ratio=imageWidth>0&&imageHeight>0?imageWidth/imageHeight:2.5
  const width=Math.min(1220,520*ratio),height=width/ratio
  const imageId=book.addImage({base64:data.chartImage,extension:'png'})
  visual.addImage(imageId,{tl:{col:.05,row:6},ext:{width,height}})
  visual.getCell('A34').value='Nguồn: Biểu đồ ma trận được chọn khi xuất. Dữ liệu chi tiết tại trang Ma trận.'
  visual.getCell('A34').font={italic:true,color:{argb:'FF64748B'}}
 }
 const sheet=book.addWorksheet('Ma trận')
 sheet.addRows([[data.title],[data.department,data.period],data.columns,...data.rows])
 sheet.views=[{state:'frozen',ySplit:3}]
 sheet.getRow(3).font={bold:true,color:{argb:'FFFFFFFF'}}
 sheet.getRow(3).eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+(data.accent||'#17416F').slice(1)}}})
 sheet.columns.forEach((c,i)=>{c.width=i===0?46:20;c.alignment={wrapText:true,vertical:'middle'}})
 for(let i=0;i<data.rows.length;i++){
  const row=sheet.getRow(i+4)
  data.columns.forEach((label,index)=>{
   const cell=row.getCell(index+1)
   if(label.endsWith('(%)')&&typeof cell.value==='number'){cell.value=cell.value/100;cell.numFmt='0.0%'}
   if(label==='Cảnh báo'){const shade=(data.palette||colors)[(data.labels||levels).indexOf(String(cell.value))]||'#9ca3af';cell.font={bold:true,color:{argb:'FF'+shade.slice(1)}}}
  })
 }
 return book.xlsx.writeBuffer()
}
export async function powerpoint(data:ExportTable){
 const {default:Pptx}=await import('pptxgenjs')
 const deck=new Pptx();deck.layout='LAYOUT_WIDE';deck.title=data.title
 const accent=(data.accent||'#17416F').slice(1),cover=deck.addSlide()
 cover.addText(data.unit||'Bệnh viện Ngoại khoa 115 Nghệ An · Khoa KSNK',{x:.6,y:.55,w:12,h:.65,fontSize:18,color:accent})
 cover.addText(data.title,{x:.6,y:1.4,w:12,h:1.8,fontSize:32,color:accent,fit:'shrink'})
 cover.addText([data.department,data.period,data.slogan].filter(Boolean).join('\n'),{x:.6,y:3.5,w:12,h:2,fontSize:20,fit:'shrink'})
 const c=data.chart
 if(c&&data.kind!=='table'&&data.kind!=='heat'){
  const size=12
  for(let i=0;i<c.labels.length;i+=size){
   const slide=deck.addSlide()
   slide.addText(data.title,{x:.5,y:.25,w:12,h:.65,fontSize:20,color:accent,fit:'shrink'})
   const labels=c.labels.slice(i,i+size),kind=data.kind
   const opts={x:.65,y:1.1,w:12,h:5.7,showLegend:true,showTitle:false,chartColors:['197446','C64235'],catAxisLabelFontSize:10,valAxisLabelFontSize:11}
   if(kind==='donut'){
    slide.addChart(deck.ChartType.doughnut,[{name:'Lượt chấm',labels:['Đạt','Không đạt và Kém'],values:[c.passed.reduce((a,b)=>a+b,0),c.errors.reduce((a,b)=>a+b,0)]}],opts)
    break
   }
   if(kind==='pareto'){
    const total=c.errors.reduce((a,b)=>a+b,0);let sum=c.errors.slice(0,i).reduce((a,b)=>a+b,0)
    const values=c.errors.slice(i,i+size)
    // @ts-expect-error PptxGenJS 4 accepts a two-argument combination chart at runtime.
    slide.addChart([{type:deck.ChartType.bar,options:{},data:[{name:'Số lỗi',labels,values}]},{type:deck.ChartType.line,data:[{name:'Tích lũy (%)',labels,values:values.map(v=>total?100*(sum+=v)/total:0)}],options:{secondaryValAxis:true,secondaryCatAxis:true}}],opts)
   }else{
    const type=kind==='line'?deck.ChartType.line:kind==='area'?deck.ChartType.area:deck.ChartType.bar
    slide.addChart(type,[{name:'Đạt (%)',labels,values:c.pass.slice(i,i+size)},{name:'Không đạt (%)',labels,values:c.fail.slice(i,i+size)}],{...opts,barDir:kind==='horizontal'||kind==='stack'?'bar':'col',barGrouping:kind==='stack'?'stacked':'clustered',valAxisMinVal:0,valAxisMaxVal:100})
   }
  }
 }
 const slide=deck.addSlide()
 slide.addTable([data.columns,...data.rows].map((row,i)=>row.map((v,j)=>{
  const warning=data.columns[j]==='Cảnh báo'?(data.palette||colors)[(data.labels||levels).indexOf(String(v))]:undefined
  return {text:typeof v==='number'&&data.columns[j].endsWith('(%)')?v.toLocaleString('vi-VN',{maximumFractionDigits:1})+'%':String(v??'—'),options:{bold:!i,color:!i?'FFFFFF':warning?.slice(1)||'17375F',...(!i?{fill:{color:accent}}:{})}}
 })),{x:.35,y:.55,w:12.6,h:6.3,fontSize:10,border:{pt:.5,color:'CBD5E1'},margin:.05,autoPage:true,autoPageRepeatHeader:true,autoPageHeaderRows:1,newSlideStartY:.55})
 return deck.write({outputType:'arraybuffer'}) as Promise<ArrayBuffer>
}

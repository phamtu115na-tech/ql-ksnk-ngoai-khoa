export type ExportTable={title:string;period:string;department:string;columns:string[];rows:(number|string|null)[][]}
export async function excel(data:ExportTable){
 const {Workbook}=await import('exceljs')
 const book=new Workbook(),sheet=book.addWorksheet('Ma trận')
 sheet.addRows([[data.title],[data.department,data.period],data.columns,...data.rows])
 sheet.views=[{state:'frozen',ySplit:3}]
 sheet.getRow(3).font={bold:true}
 sheet.columns.forEach((c,i)=>{c.width=i===0?46:20;c.alignment={wrapText:true,vertical:'middle'}})
 return book.xlsx.writeBuffer()
}
export async function powerpoint(data:ExportTable){
 const {default:Pptx}=await import('pptxgenjs')
 const deck=new Pptx();deck.layout='LAYOUT_WIDE';deck.title=data.title
 const cover=deck.addSlide()
 cover.addText(data.title,{x:.6,y:1.4,w:12,h:1.8,fontSize:32,color:'17416F',fit:'shrink'})
 cover.addText([data.department,data.period].join('\n'),{x:.6,y:3.5,w:12,h:1.3,fontSize:20})
 const slide=deck.addSlide()
 slide.addTable([data.columns,...data.rows].map(row=>row.map(v=>({text:String(v??'—')}))),{x:.35,y:.55,w:12.6,h:6.3,fontSize:10,border:{pt:.5,color:'CBD5E1'},margin:.05,autoPage:true,autoPageRepeatHeader:true,autoPageHeaderRows:1,newSlideStartY:.55})
 return deck.write({outputType:'arraybuffer'}) as Promise<ArrayBuffer>
}

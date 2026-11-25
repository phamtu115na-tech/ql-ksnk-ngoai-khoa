import {actor,db} from '../../../../lib/auth'
import {featureScope,inFeatureScope} from '../../../../lib/feature-permissions'
import {GET as reports} from '../../modules/route'
import {aggregate,colors,defaults,levels,severity} from '../../../../lib/matrix'
import {sectionTitles,type Section,type SectionKey} from '../../../../lib/briefing-sections'
import {briefingGraphs} from '../../../../lib/briefing-charts'
export const runtime='nodejs'
type Row=Record<string,any>
function sections(data:Row,keys:SectionKey[],scale:typeof defaults){
 const result:Section[]=[]
 const plain=(key:SectionKey,cols:string[],fields:string[],rows:Row[])=>result.push({title:sectionTitles[key],columns:cols,rows:rows.map(r=>fields.map(f=>r[f]??''))})
 for(const key of keys){
  switch(key){
   case 'overview':plain(key,['Bộ phận','Giao việc','Hoàn thành','Quá hạn','Phiếu giám sát','Vi phạm'],['department','taskCount','completedTasks','overdueTasks','checklistCount','violationCount'],data.rows);break
   case 'tasks':plain(key,['Công việc','Thực hiện','Hạn','Trạng thái','Phê duyệt'],['title','assignee','endDate','status','approvalStatus'],data.tasks);break
   case 'issues':plain(key,['Tồn tại','Phương án','Phụ trách','Hạn'],['issue','action','owner','deadline'],data.issues);break
   case 'next':plain(key,['Nội dung','Phụ trách','Từ ngày','Đến ngày','Trạng thái'],['title','owner','fromDate','toDate','status'],data.nextWeekPlan);break
   case 'opinions':plain(key,['Bộ phận','Mẫu phiếu','Ý kiến'],['department','formName','opinion'],data.opinions);break
   case 'errors':plain(key,['Loại','Lỗi','Số lần','Cảnh báo'],['type','errorName','count','alertLabel'],[...data.errorStats.map((r:Row)=>({...r,type:'Thường quy'})),...data.suddenErrorStats.map((r:Row)=>({...r,type:'Vi phạm'}))]);break
   case 'staff':case 'content':{
    const rows=data.formMatrices.flatMap((m:Row)=>aggregate(m.marks,key==='staff'?'staff':'criterion').sort((a,b)=>(b.errorRate??-1)-(a.errorRate??-1)).map(r=>{const level=severity(r,'rate',scale);return [m.formCode,r.label,r.total,r.pass,r.fail,r.poor,r.passRate,r.errorRate,level<0?(r.total?'Chưa đủ lượt':'Chưa có dữ liệu'):(scale.labels||levels)[level]]}))
    result.push({title:sectionTitles[key],columns:['Mẫu phiếu',key==='staff'?'Nhân viên':'Tiêu chí','Lượt hợp lệ','Đạt','Không đạt','Kém','Đạt (%)','Không đạt (%)','Cảnh báo'],rows});break
   }
  }
 }
 return result
}
function addBriefingChartSlides(deck:any,section:Section,scope:string,period:string,accent:string){
 const graphs=briefingGraphs(section.rows,10)
 for(const graph of graphs){
  const slide=deck.addSlide()
  slide.addText(section.title+' · '+graph.formCode,{x:.62,y:.32,w:12.05,h:.57,fontSize:23,color:accent,bold:true,fit:'shrink'})
  slide.addText('Thanh chồng 100%  ·  Top 10  ·  Tỷ lệ đạt / không đạt',{x:.65,y:1.02,w:11.7,h:.28,fontSize:12,color:'5A6980'})
  slide.addChart(deck.ChartType.bar,[
   {name:'Đạt',labels:graph.labels,values:graph.pass},
   {name:'Không đạt và Kém',labels:graph.labels,values:graph.fail}
  ],{x:.68,y:1.55,w:11.95,h:5.26,
    barDir:'bar',barGrouping:'stacked',showLegend:true,showTitle:false,
    chartColors:['197446','C64235'],catAxisLabelFontSize:11,valAxisLabelFontSize:10,
    valAxisMinVal:0,valAxisMaxVal:100,showValue:false})
  slide.addText(scope+' · '+period,{x:.7,y:7.06,w:11.9,h:.18,fontSize:9,color:'64748B',fit:'shrink'})
 }
}
export async function POST(req:Request){
 const user=await actor()
 if(!user||req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Thiếu quyền xuất báo cáo tổng hợp'},{status:403})
 const exportScope=await featureScope(user,'reports','export')
 if(exportScope==='none')return Response.json({error:'Chưa được cấp quyền xuất Excel/PowerPoint.'},{status:403})
 const {format,keys,departments,filters}=await req.json()
 if(!Array.isArray(departments)||!filters||typeof filters!=='object'||Array.isArray(filters))return Response.json({error:'Bộ lọc báo cáo không hợp lệ'},{status:400})
 if(!['pptx','xlsx'].includes(format)||!Array.isArray(keys)||!keys.length||keys.length>8||new Set(keys).size!==keys.length||!keys.every(k=>Object.hasOwn(sectionTitles,k))||!Array.isArray(departments)||departments.length>24||!departments.every(d=>typeof d==='string'&&d.trim().length>0&&d.length<=160))return Response.json({error:'Lựa chọn xuất không hợp lệ'},{status:400})
 if(exportScope!=='hospital'){
  const department=user.team_department||user.department
  if(!department||!inFeatureScope(user,exportScope,department,user.staff_code,user.name))
   return Response.json({error:'Không có phạm vi xuất báo cáo hợp lệ.'},{status:403})
  if(departments.some((d:string)=>d.toLocaleLowerCase('vi')!==department.toLocaleLowerCase('vi')))
   return Response.json({error:'Bộ phận ngoài phạm vi.'},{status:403})
  departments.splice(0,departments.length,department)
  if(exportScope==='self'){
   if(filters?.person&&filters.person!==user.name)return Response.json({error:'Nhân viên ngoài phạm vi xuất.'},{status:403})
   filters.person=user.name
  }
 }
 const url=new URL(req.url);url.searchParams.set('module','reports')
 for(const k of ['from','to','person'])if(typeof filters?.[k]==='string')url.searchParams.set(k,filters[k])
 const settings=await db().from('nk_legacy_rows').select('data').eq('sheet_name','CAI_DAT_MA_TRAN').eq('row_no',1).maybeSingle()
 if(settings.error)return Response.json({error:'Không đọc được ngưỡng cảnh báo'},{status:503})
 const groups=[]
 for(const department of (departments.length?[...new Set<string>(departments)]:[''])){
  url.searchParams.set('department',department)
  const response=await reports(new Request(url));if(!response.ok)return response
  const data=await response.json()
  groups.push({name:data.reportHero?.department||department||'Toàn khoa KSNK',title:data.reportHero?.title||'Báo cáo giao ban KSNK',slogan:data.reportHero?.slogan||'',accent:(data.reportHero?.accent||'#17416F').slice(1),sections:sections(data,keys,settings.data?.data?.scale||defaults)})
 }
 const period=[filters?.from,filters?.to].join(' – ')
 let bytes:ArrayBuffer
 if(format==='xlsx'){
  const {Workbook}=await import('exceljs'),book=new Workbook()
  for(const g of groups)for(const sec of g.sections){
   const ws=book.addWorksheet((book.worksheets.length+1)+' '+sec.title.slice(0,25))
   ws.addRows([[g.title],[g.name,period],[sec.title],sec.columns,...sec.rows])
   ws.views=[{state:'frozen',ySplit:4}];ws.columns.forEach(c=>{c.width=24;c.alignment={wrapText:true}})
   ws.getRow(4).font={bold:true};sec.columns.forEach((name,j)=>{if(name.endsWith('(%)'))for(let i=5;i<=ws.rowCount;i++){const cell=ws.getCell(i,j+1);if(typeof cell.value==='number'){cell.value/=100;cell.numFmt='0.0%'}}})
  }
  bytes=await book.xlsx.writeBuffer() as ArrayBuffer
 }else{
  const {default:Pptx}=await import('pptxgenjs'),deck=new Pptx();deck.layout='LAYOUT_WIDE'
  for(const g of groups){
   const cover=deck.addSlide()
   cover.addText(g.title,{x:.6,y:1.2,w:12,h:1.4,fontSize:34,color:g.accent,fit:'shrink'})
   cover.addText([g.name,period,g.slogan].join('\n'),{x:.65,y:3,w:12,h:2.2,fontSize:21,fit:'shrink'})
   for(const sec of g.sections){
    if(sec.title===sectionTitles.content||sec.title===sectionTitles.staff)
     addBriefingChartSlides(deck,sec,g.name,period,g.accent)
    const slide=deck.addSlide()
    slide.addText(sec.title,{x:.5,y:.25,w:12,h:.55,fontSize:22,color:g.accent,fit:'shrink'})
    if(!sec.rows.length){slide.addText('Chưa có dữ liệu trong kỳ',{x:.55,y:1.1,w:12,h:.6,fontSize:16});continue}
    slide.addTable([sec.columns,...sec.rows].map((r,i)=>r.map((v,j)=>({text:typeof v==='number'&&sec.columns[j].endsWith('(%)')?v.toLocaleString('vi-VN',{maximumFractionDigits:1})+'%':String(v??'—'),options:{bold:!i,color:!i?'FFFFFF':(settings.data?.data?.scale?.colors||colors)[(settings.data?.data?.scale?.labels||levels).indexOf(String(v))]?.slice(1)||'18324E',...(!i?{fill:{color:g.accent}}:{})}}))),{x:.4,y:1,w:12.5,h:5.85,autoPage:true,autoPageRepeatHeader:true,newSlideStartY:.45,fontSize:12,margin:.05,border:{pt:.5,color:'CCD5E1'}})
   }
  }
  bytes=await deck.write({outputType:'arraybuffer'}) as ArrayBuffer
 }
 return new Response(bytes,{headers:{'Content-Type':format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/vnd.openxmlformats-officedocument.presentationml.presentation','Cache-Control':'private,no-store','Content-Disposition':'attachment; filename="giao-ban.'+format+'"'}})
}

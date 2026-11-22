/**
 * Client-side PowerPoint exporter for the currently filtered KSNK report.
 * Produces an editable 16:9 Office Open XML .pptx without remote conversion,
 * third-party scripts or a server-side copy of personal/clinical data.
 */
type RecordLike = Record<string, any>;
type ViewRow = {title:string; detail:string; tag?:string; percent?:number};
type ReportSection = {id:string;title:string;rows:ViewRow[]};

export type PptxExportOptions = {
 payload:RecordLike;
 sections?:string[];
 matrixCode?:string;
 unitName?:string;
 mode?:'summary'|'detailed';
};
export type PptxExportResult = {slides:number;omitted:number;name:string};

const INCH=914400;
const SW=13.333333,SH=7.5;
const BLUE='333892',DARK='273679',RED='F20E20',PEACH='E8A17C',SOFT='EEF2FA',GREY='56647D',WHITE='FFFFFF';
const PAGE_ROWS=6;
const xml=(v:unknown)=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const t=(v:unknown)=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const cut=(v:unknown,max:number)=>{const s=t(v);return s.length>max?s.slice(0,max-1).trimEnd()+'…':s;};
const take=(v:unknown)=>Array.isArray(v)?v.filter(x=>x&&typeof x==='object') as RecordLike[]:[];
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0;};
const fmt=(v:unknown)=>{const s=t(v).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s.split('-').reverse().join('/'):s||'—';};
const row=(data:RecordLike,titleKeys:string[],detailKeys:[string,string][],tagKeys:string[]=[]):ViewRow=>{
 const title=titleKeys.map(k=>t(data[k])).find(Boolean)||'Chưa có tiêu đề';
 const detail=detailKeys.map(([key,label])=>t(data[key])?label+': '+cut(data[key],75):'').filter(Boolean).join('  •  ');
 const tag=tagKeys.map(k=>t(data[k])).find(Boolean);
 return {title,detail,tag};
};
function chosen(values:string[],id:string){return !values.length||values.includes(id);}
function chosenGroup(values:string[],id:string,key:string){return !values.length||values.includes(id)||values.includes(id+':'+key);}
function workType(v:unknown){const s=t(v).toLocaleLowerCase('vi');return s.includes('trọng điểm')||s.includes('đột xuất')?'priority':'long-term';}
function reportSections(options:PptxExportOptions):ReportSection[]{
 const p=options.payload,sel=options.sections||[],r:ReportSection[]=[];
 const add=(id:string,title:string,rows:ViewRow[])=>{if(chosen(sel,id))r.push({id,title,rows});};
 add('weekly','01 · KẾ HOẠCH TUẦN',take(p.weekly).map(x=>row(x,['title','name','task','description'],[['assignee','Phụ trách'],['status','Trạng thái'],['description','Nội dung'],['note','Ghi chú']],['status'])));
 add('monthly','02 · KẾ HOẠCH THÁNG',take(p.monthly).map(x=>row(x,['title','name','task','description'],[['assignee','Phụ trách'],['status','Trạng thái'],['description','Nội dung'],['note','Ghi chú']],['status'])));
 const taskRows=take(p.tasks).filter(x=>chosenGroup(sel,'tasks',workType(x.workType||x['Loại công việc'])));
 if(!sel.length||chosen(sel,'tasks')||sel.some(x=>x.startsWith('tasks:')))
  r.push({id:'tasks',title:'03 · CÔNG VIỆC TRỌNG ĐIỂM / DÀI HẠN',rows:taskRows.map(x=>row(x,['title','description'],[['assignee','Thực hiện'],['endDate','Hạn'],['department','Bộ phận'],['description','Nội dung']],['status']))});
 add('overview','04 · CHỈ SỐ TỔNG QUAN',take(p.rows).map(x=>({
  title:t(x.department)||'Toàn bộ phận',
  detail:'Công việc: '+num(x.taskCount)+'  •  Hoàn thành: '+num(x.completedTasks)+'  •  Quá hạn: '+num(x.overdueTasks)+'  •  Phiếu kiểm: '+num(x.checklistCount)+'  •  Vi phạm: '+num(x.violationCount),
  tag:t(x.checklistRate)?t(x.checklistRate)+'% đạt':''
 })));
 add('checklists','05 · PHÂN TÍCH BẢNG KIỂM',take(p.checks).map(x=>row(x,['formName','formCode'],[['department','Bộ phận'],['person','Nhân viên'],['applied','Áp dụng'],['pass','Đạt'],['fail','Không đạt'],['rate','Tỷ lệ %']],['percentRank'])));
 add('routine','06 · THỐNG KÊ LỖI THƯỜNG QUY',take(p.errorStats).map(x=>row(x,['errorName','name','title'],[['department','Bộ phận'],['count','Số lần'],['staffCount','Số người'],['rate','Tỷ lệ %']],['level'])));
 add('sudden','07 · LỖI ĐỘT XUẤT / VI PHẠM',take(p.violations).map(x=>row(x,['errorName','title'],[['person','Nhân viên'],['department','Bộ phận'],['date','Ngày'],['points','Điểm trừ'],['note','Ghi chú']],['level','status'])));
 const matrices=take(p.formMatrices).filter(x=>!options.matrixCode||t(x.formCode)===options.matrixCode);
 add('matrix','08 · MA TRẬN PHIẾU GIÁM SÁT',matrices.map(x=>({
  title:[x.formCode,x.formName].map(t).filter(Boolean).join(' · ')||'Phiếu giám sát',
  detail:'Số nhân viên: '+take(x.summary).length+'  •  '+cut(x.conclusion||'Phân tích kết quả theo mẫu phiếu đang chọn.',130),
  tag:'Theo phiếu'
 })));
 add('kpi','09 · KPI 100 ĐIỂM',take(p.kpiReport?.rows).map(x=>row(x,['name','staffId'],[['department','Bộ phận'],['total','Tổng điểm'],['taskScore','Giao việc'],['checklistScore','Bảng kiểm'],['violationScore','Vi phạm']],['ranking'])));
 add('incidents','10 · NHẬT KÝ SỰ CỐ',take(p.incidentIssues).map(x=>row(x,['issue','title','description'],[['department','Bộ phận'],['cause','Nguyên nhân'],['action','Xử lý'],['owner','Phụ trách']],['status'])));
 add('issues','11 · TỒN TẠI & KIẾN NGHỊ',take(p.otherIssues||p.issues).map(x=>row(x,['issue','title','description'],[['department','Bộ phận'],['action','Giải pháp'],['recommendation','Kiến nghị'],['owner','Phụ trách']],['status'])));
 const nextRows=take(p.nextWeekPlan).filter(x=>chosenGroup(sel,'next-week',workType(x.workType||x['Loại công việc'])));
 if(!sel.length||chosen(sel,'next-week')||sel.some(x=>x.startsWith('next-week:')))
  r.push({id:'next-week',title:'12 · KẾ HOẠCH TUẦN SAU',rows:nextRows.map(x=>row(x,['title','issue','description'],[['owner','Phụ trách'],['assignee','Thực hiện'],['deadline','Hạn'],['note','Ghi chú']],['status']))});
 return r;
}
const emu=(n:number)=>Math.round(n*INCH);
class Slide {
 parts:string[]=[];nextId=2;
 rect(x:number,y:number,w:number,h:number,color:string,rounded=false,line?:string){
  const id=this.nextId++;
  this.parts.push('<p:sp><p:nvSpPr><p:cNvPr id="'+id+'" name="Shape '+id+'"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="'+emu(x)+'" y="'+emu(y)+'"/><a:ext cx="'+emu(w)+'" cy="'+emu(h)+'"/></a:xfrm><a:prstGeom prst="'+(rounded?'roundRect':'rect')+'"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="'+color+'"/></a:solidFill><a:ln w="'+emu(.008)+'">'+(line?'<a:solidFill><a:srgbClr val="'+line+'"/></a:solidFill>':'<a:noFill/>')+'</a:ln></p:spPr></p:sp>');
 }
 circle(x:number,y:number,d:number,color:string,line?:string){
  const id=this.nextId++;
  this.parts.push('<p:sp><p:nvSpPr><p:cNvPr id="'+id+'" name="Seal '+id+'"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="'+emu(x)+'" y="'+emu(y)+'"/><a:ext cx="'+emu(d)+'" cy="'+emu(d)+'"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="'+color+'"/></a:solidFill><a:ln w="'+emu(.025)+'"><a:solidFill><a:srgbClr val="'+(line||color)+'"/></a:solidFill></a:ln></p:spPr></p:sp>');
 }
 text(value:unknown,x:number,y:number,w:number,h:number,size=18,color=DARK,bold=false,align='l',font='Arial'){
  const id=this.nextId++,s=xml(value);
  const p='<a:p><a:pPr algn="'+align+'"/><a:r><a:rPr lang="vi-VN" sz="'+Math.round(size*100)+'" b="'+(bold?'1':'0')+'" dirty="0"><a:solidFill><a:srgbClr val="'+color+'"/></a:solidFill><a:latin typeface="'+xml(font)+'"/></a:rPr><a:t>'+s+'</a:t></a:r><a:endParaRPr lang="vi-VN"/></a:p>';
  this.parts.push('<p:sp><p:nvSpPr><p:cNvPr id="'+id+'" name="Text '+id+'"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="'+emu(x)+'" y="'+emu(y)+'"/><a:ext cx="'+emu(w)+'" cy="'+emu(h)+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="ctr" lIns="0" tIns="0" rIns="0" bIns="0"/><a:lstStyle/>'+p+'</p:txBody></p:sp>');
 }
 toXml(){
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'+this.parts.join('')+'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
 }
}
function stripes(s:Slide,y:number){s.rect(0,y,6.66,.09,BLUE);s.rect(6.66,y,3.34,.09,RED);s.rect(10,y,3.34,.09,PEACH);}
function header(s:Slide,index:number,total:number,unit:string,small=false){
 s.rect(0,0,SW,SH,WHITE);s.rect(0,0,SW,.2,BLUE);
 if(!small){s.circle(.26,.38,.68,WHITE,BLUE);s.circle(.33,.45,.54,BLUE);s.text('115',.38,.62,.43,.20,17,WHITE,true,'ctr');s.text(cut(unit,50),1.08,.33,9,.35,22,BLUE,true,'l','Georgia');s.text('“Tất cả vì sức khỏe của bạn”',1.20,.74,5,.25,12,BLUE);s.text('KHOA KIỂM SOÁT NHIỄM KHUẨN',1.20,1.02,7,.33,19,BLUE,true,'l','Georgia');stripes(s,1.42);}
 else {s.circle(.31,.29,.49,BLUE);s.text('115',.35,.42,.42,.18,12,WHITE,true,'ctr');s.text(cut(unit,56),.93,.30,9.4,.25,15,BLUE,true,'l','Georgia');s.text('KHOA KSNK',.95,.59,4,.20,10,BLUE,true);stripes(s,.95);s.text(''+index+' / '+total,11.7,.56,1.15,.20,9,GREY,false,'r');}
 stripes(s,7.39);
}
function cover(unit:string,from:string,to:string,department:string):Slide{
 const s=new Slide();header(s,1,1,unit);
 s.text('BÁO CÁO CÔNG TÁC',1.25,2.52,10.8,.60,39,RED,true,'ctr','Georgia');
 s.text('GIÁM SÁT KSNK',1.25,3.22,10.8,.70,40,RED,true,'ctr','Georgia');
 s.text('TỪ '+fmt(from)+' – '+fmt(to),1.25,4.05,10.8,.50,29,RED,true,'ctr','Georgia');
 s.text(cut(department||'TOÀN KHOA KIỂM SOÁT NHIỄM KHUẨN',90).toLocaleUpperCase('vi'),1.75,5.08,9.8,.38,18,BLUE,true,'ctr');
 s.text('Dữ liệu tổng hợp theo phạm vi và các mục đã chọn trong phần mềm',2.05,5.60,9.2,.28,12,GREY,false,'ctr');
 return s;
}
function sectionHeading(s:Slide,title:string,from:string,to:string){
 s.text(cut(title,82),.64,1.18,12.0,.54,23,DARK,true);
 s.rect(.66,1.80,1.15,.055,RED);
 s.text('Kỳ báo cáo: '+fmt(from)+' – '+fmt(to),.67,1.91,10,.26,10,GREY);
}
function totals(unit:string,from:string,to:string,department:string,summary:RecordLike,sectionCount:number):Slide{
 const s=new Slide();header(s,2,2,unit,true);
 sectionHeading(s,'TỔNG QUAN HOẠT ĐỘNG KSNK',from,to);
 const cards=[
 ['CÔNG VIỆC ĐƯỢC GIAO',summary.taskTotal||0],
 ['CÔNG VIỆC HOÀN THÀNH',summary.taskDone||0],
 ['CÔNG VIỆC QUÁ HẠN',summary.overdue||0],
 ['PHIẾU BẢNG KIỂM',summary.checklistForms||0],
 ['VI PHẠM GHI NHẬN',summary.violationCount||0],
 ['NỘI DUNG BÁO CÁO',sectionCount],
 ];
 cards.forEach(([name,value],i)=>{const c=i%3,rr=Math.floor(i/3),x=.65+c*4.18,y=2.48+rr*1.65;s.rect(x,y,3.94,1.42,SOFT,true,'D4DDED');s.rect(x,y,.08,1.42,c===0?BLUE:c===1?RED:PEACH);s.text(name,x+.22,y+.20,3.40,.34,12,GREY,true);s.text(value,x+.21,y+.61,3.4,.64,29,c===1?RED:BLUE,true);});
 s.text('Phạm vi: '+cut(department,74),.65,6.25,12,.30,12,GREY);
 return s;
}
function dataSlide(section:ReportSection,part:ViewRow[],page:number,pages:number,unit:string,from:string,to:string,department:string,shown:number,total:number):Slide{
 const s=new Slide();header(s,0,0,unit,true);
 sectionHeading(s,section.title,from,to);
 s.text(cut(department,85),.67,2.15,11.0,.22,10,GREY);
 s.text('Trang '+page+'/'+pages+' · Hiển thị '+shown+'/'+total+' mục',9.22,2.15,3.40,.22,10,GREY,false,'r');
 if(!part.length){s.rect(.70,2.79,11.9,1.26,SOFT,true);s.text('Không phát sinh dữ liệu trong kỳ hoặc phạm vi đã chọn.',.94,3.08,11.1,.38,16,GREY,false,'ctr');}
 part.forEach((r,i)=>{
  const y=2.51+i*.70;
  s.rect(.67,y,12.0,.64,i%2===0?'F3F6FD':'FFFFFF',true,'E3E9F2');
  s.rect(.67,y,.05,.64,i%2===0?BLUE:PEACH);
  s.text(cut(r.title,88),.90,y+.065,9.60,.24,14,DARK,true);
  s.text(cut(r.detail||'Không có thông tin bổ sung',151),.91,y+.335,10.6,.20,9,GREY);
  if(r.tag){s.rect(11.05,y+.09,1.34,.28,'FCE8EA',true);s.text(cut(r.tag,17),11.15,y+.12,1.14,.19,9,RED,true,'ctr');}
 });
 s.text('Dữ liệu nguồn: Hệ thống quản lý KSNK · Chỉ bao gồm phạm vi được phân quyền',.70,7.00,11.6,.19,9,GREY);
 return s;
}
function zipFile(files:{path:string;content:string}[]):Uint8Array{
 const encoder=new TextEncoder(),locals:Uint8Array[]=[],centers:Uint8Array[]=[];let offset=0;
 const crcTable=Array.from({length:256},(_,k)=>{let c=k;for(let n=0;n<8;n++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;});
 const crc=(bytes:Uint8Array)=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
 const u16=(v:DataView,p:number,n:number)=>v.setUint16(p,n,true),u32=(v:DataView,p:number,n:number)=>v.setUint32(p,n,true);
 for(const f of files){
  const name=encoder.encode(f.path),data=encoder.encode(f.content),checksum=crc(data);
  const local=new Uint8Array(30+name.length+data.length),lv=new DataView(local.buffer);
  u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0x0800);u16(lv,8,0);u16(lv,10,0);u16(lv,12,0);u32(lv,14,checksum);u32(lv,18,data.length);u32(lv,22,data.length);u16(lv,26,name.length);u16(lv,28,0);local.set(name,30);local.set(data,30+name.length);locals.push(local);
  const cen=new Uint8Array(46+name.length),cv=new DataView(cen.buffer);
  u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x0800);u16(cv,10,0);u16(cv,12,0);u16(cv,14,0);u32(cv,16,checksum);u32(cv,20,data.length);u32(cv,24,data.length);u16(cv,28,name.length);u16(cv,30,0);u16(cv,32,0);u16(cv,34,0);u16(cv,36,0);u32(cv,38,0);u32(cv,42,offset);cen.set(name,46);centers.push(cen);offset+=local.length;
 }
 const centralLength=centers.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
 u32(ev,0,0x06054b50);u16(ev,4,0);u16(ev,6,0);u16(ev,8,files.length);u16(ev,10,files.length);u32(ev,12,centralLength);u32(ev,16,offset);u16(ev,20,0);
 const out=new Uint8Array(offset+centralLength+22);let pos=0;
 for(const b of [...locals,...centers,end]){out.set(b,pos);pos+=b.length;}return out;
}
function pptxFiles(slides:Slide[]):{path:string;content:string}[]{
 const P='http://schemas.openxmlformats.org/presentationml/2006/main',A='http://schemas.openxmlformats.org/drawingml/2006/main',R='http://schemas.openxmlformats.org/officeDocument/2006/relationships',PR='http://schemas.openxmlformats.org/package/2006/relationships';
 const f:{path:string;content:string}[]=[];
 const slideOverride=slides.map((_,i)=>'<Override PartName="/ppt/slides/slide'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>').join('');
 f.push({path:'[Content_Types].xml',content:'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'+slideOverride+'</Types>'});
 f.push({path:'_rels/.rels',content:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="'+PR+'"><Relationship Id="rId1" Type="'+R+'/officeDocument" Target="ppt/presentation.xml"/></Relationships>'});
 f.push({path:'ppt/presentation.xml',content:'<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:a="'+A+'" xmlns:r="'+R+'" xmlns:p="'+P+'"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>'+slides.map((_,i)=>'<p:sldId id="'+(256+i)+'" r:id="rId'+(i+2)+'"/>').join('')+'</p:sldIdLst><p:sldSz cx="'+emu(SW)+'" cy="'+emu(SH)+'" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>'});
 f.push({path:'ppt/_rels/presentation.xml.rels',content:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="'+PR+'"><Relationship Id="rId1" Type="'+R+'/slideMaster" Target="slideMasters/slideMaster1.xml"/>'+slides.map((_,i)=>'<Relationship Id="rId'+(i+2)+'" Type="'+R+'/slide" Target="slides/slide'+(i+1)+'.xml"/>').join('')+'</Relationships>'});
 const gr='<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
 f.push({path:'ppt/slideMasters/slideMaster1.xml',content:'<?xml version="1.0" encoding="UTF-8"?><p:sldMaster xmlns:p="'+P+'" xmlns:a="'+A+'" xmlns:r="'+R+'"><p:cSld name="KSNK 115"><p:spTree>'+gr+'</p:spTree></p:cSld><p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>'});
 f.push({path:'ppt/slideMasters/_rels/slideMaster1.xml.rels',content:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="'+PR+'"><Relationship Id="rId1" Type="'+R+'/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="'+R+'/theme" Target="../theme/theme1.xml"/></Relationships>'});
 f.push({path:'ppt/slideLayouts/slideLayout1.xml',content:'<?xml version="1.0" encoding="UTF-8"?><p:sldLayout xmlns:p="'+P+'" xmlns:a="'+A+'" xmlns:r="'+R+'" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>'+gr+'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>'});
 f.push({path:'ppt/slideLayouts/_rels/slideLayout1.xml.rels',content:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="'+PR+'"><Relationship Id="rId1" Type="'+R+'/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>'});
 f.push({path:'ppt/theme/theme1.xml',content:'<?xml version="1.0" encoding="UTF-8"?><a:theme xmlns:a="'+A+'" name="KSNK 115 Theme"><a:themeElements><a:clrScheme name="KSNK"><a:dk1><a:srgbClr val="1B2433"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="273679"/></a:dk2><a:lt2><a:srgbClr val="EFF2F9"/></a:lt2><a:accent1><a:srgbClr val="'+BLUE+'"/></a:accent1><a:accent2><a:srgbClr val="'+RED+'"/></a:accent2><a:accent3><a:srgbClr val="'+PEACH+'"/></a:accent3><a:accent4><a:srgbClr val="12A478"/></a:accent4><a:accent5><a:srgbClr val="5374A9"/></a:accent5><a:accent6><a:srgbClr val="8C638A"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="KSNK"><a:majorFont><a:latin typeface="Georgia"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="KSNK"><a:fillStyleLst><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:solidFill><a:schemeClr val="accent2"/></a:solidFill><a:solidFill><a:schemeClr val="accent3"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:ln><a:ln w="25400"><a:solidFill><a:schemeClr val="accent2"/></a:solidFill></a:ln><a:ln w="38100"><a:solidFill><a:schemeClr val="accent3"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="lt1"/></a:solidFill><a:solidFill><a:schemeClr val="lt2"/></a:solidFill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>'});
 slides.forEach((s,i)=>{f.push({path:'ppt/slides/slide'+(i+1)+'.xml',content:s.toXml()});f.push({path:'ppt/slides/_rels/slide'+(i+1)+'.xml.rels',content:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="'+PR+'"><Relationship Id="rId1" Type="'+R+'/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>'});});
 return f;
}
export function exportReportPowerPoint(options:PptxExportOptions):PptxExportResult{
 const p=options.payload||{},from=t(p.filters?.from),to=t(p.filters?.to),department=t(p.filters?.department)||'TOÀN KHOA KSNK';
 const unit=t(options.unitName)||'BỆNH VIỆN NGOẠI KHOA 115 NGHỆ AN';
 const sections=reportSections(options);
 if(!sections.length)throw new Error('Hãy chọn ít nhất một mục báo cáo trước khi xuất PowerPoint.');
 const slides:Slide[]=[cover(unit,from,to,department),totals(unit,from,to,department,p.summary||{},sections.length)];
 const maxPerSection=options.mode==='detailed'?60:12;
 let omitted=0;
 for(const section of sections){
  const all=section.rows,visible=all.slice(0,maxPerSection);
  omitted+=Math.max(0,all.length-visible.length);
  const pages=Math.max(1,Math.ceil(visible.length/PAGE_ROWS));
  for(let page=0;page<pages;page++){
   slides.push(dataSlide(section,visible.slice(page*PAGE_ROWS,(page+1)*PAGE_ROWS),page+1,pages,unit,from,to,department,visible.length,all.length));
  }
 }
 if(omitted>0){
  const note=new Slide();header(note,0,0,unit,true);
  sectionHeading(note,'LƯU Ý VỀ PHẠM VI TRÌNH CHIẾU',from,to);
  note.rect(.72,2.65,11.92,1.85,SOFT,true);
  note.text('ĐÃ GIỚI HẠN '+omitted+' DÒNG CHI TIẾT',.96,2.91,11.36,.46,23,RED,true,'ctr');
  note.text('Để trình chiếu dễ đọc, các dòng vượt giới hạn không được đưa vào PowerPoint.',1.05,3.60,11.0,.26,13,DARK,false,'ctr');
  note.text('Xem báo cáo trên phần mềm để tra cứu toàn bộ dữ liệu trong phạm vi được phân quyền.',1.05,4.03,11.0,.27,12,GREY,false,'ctr');
  slides.push(note);
 }
 const file=pptxFiles(slides),bytes=zipFile(file);
 const blob=new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
 const name='BAO_CAO_KSNK_'+(from||'TU_NGAY')+'_'+(to||'DEN_NGAY')+'.pptx';
 const link=URL.createObjectURL(blob),a=document.createElement('a');a.href=link;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(link),5000);
 return {slides:slides.length,omitted,name};
}

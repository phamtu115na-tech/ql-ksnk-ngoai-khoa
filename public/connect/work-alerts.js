'use strict';
class HospitalWorkAlerts extends HTMLElement {
 connectedCallback(){
  if(!this.shadowRoot){
   const root=this.attachShadow({mode:'open'});
   root.innerHTML='<link rel="stylesheet" href="/connect/work-alerts.css"><section hidden aria-label="Cảnh báo hôm nay"><header><h2>Cảnh báo hôm nay</h2><button class="close" aria-label="Đóng cảnh báo">×</button></header><nav aria-label="Lọc loại việc"></nav><div class="list"></div><footer></footer></section><button class="launch" aria-expanded="false">☷ Nhắc việc và giao việc</button>';
   this.filter='all';this.offset=0;this.version=0;this.lastList='';
   this.find=q=>root.querySelector(q);
   this.find('.launch').onclick=()=>this.toggle(this.find('section').hidden);
   this.find('.close').onclick=()=>this.toggle(false);
   root.addEventListener('keydown',e=>{if(e.key==='Escape')this.toggle(false)});
  }
  this.refresh();this.timer=setInterval(()=>{if(!document.hidden)this.refresh()},12000);
 }
 disconnectedCallback(){clearInterval(this.timer);this.version++;}
 toggle(open){
  this.find('section').hidden=!open;
  this.find('.launch').setAttribute('aria-expanded',String(open));
  if(open){this.find('.close').focus();this.refresh();}else this.find('.launch').focus();
 }
 async refresh(){
  const token=++this.version;
  try{
   const response=await fetch('/api/connect',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'workAlerts',kind:this.filter,offset:this.offset})});
   if(!response.ok)throw Error('Không tải được cảnh báo. Vui lòng kiểm tra kết nối hoặc đăng nhập lại.');
   const data=await response.json();if(token!==this.version)return;
   const total=data.task+data.reminder,count=this.filter==='all'?total:data[this.filter];
   if(this.offset&&this.offset>=count){this.offset=0;return this.refresh();}
   this.find('.launch').textContent='☷ Nhắc việc và giao việc ('+total+')';
   const key=JSON.stringify([this.filter,this.offset,data]);if(key===this.lastList)return;this.lastList=key;
   const button=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=fn;return b;};
   const labels={all:'Tất cả',task:'Giao việc',reminder:'Nhắc việc'};
   this.find('nav').replaceChildren(...Object.entries(labels).map(([k,v])=>{
    const b=button(v+' ('+(k==='all'?total:data[k])+')',()=>{this.filter=k;this.offset=0;this.refresh()});
    b.setAttribute('aria-pressed',String(this.filter===k));return b;
   }));
   const list=this.find('.list');list.replaceChildren(...data.items.map(work=>this.card(work)));
   if(!data.items.length)list.textContent='Chưa có việc đến hạn hoặc tin chưa đọc.';
   const footer=this.find('footer');footer.replaceChildren();
   if(this.offset)footer.append(button('Trang trước',()=>{this.offset-=40;this.refresh()}));
   if(this.offset+40<count)footer.append(button('Trang sau',()=>{this.offset+=40;this.refresh()}));
  }catch(err){if(token===this.version){this.lastList='';this.find('.list').textContent=err.message;this.find('footer').replaceChildren();}}
 }
 card(w){
  const link=document.createElement('a');link.href='/ngoai-khoa?work='+w.kind+'&thread='+encodeURIComponent(w.id);
  link.onclick=e=>{
   if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
   this.toggle(false);
   if(!this.dispatchEvent(new CustomEvent('work-selected',{detail:w.id,cancelable:true})))e.preventDefault();
  };
  function line(tag,content){const el=document.createElement(tag);el.textContent=content;link.append(el);return el;}
  line('small',w.kind==='task'?'Giao việc':'Nhắc việc');
  line('strong',w.title);
  const date=w.due?w.due.split('-').reverse().join('/'):'Chưa đặt ngày';
  line('small',date+' · '+w.status+(w.due<w.today&&w.due&&w.status!=='Hoàn thành'?' · Quá hạn':'')+(w.daily?' · Hằng ngày':''));
  line('span',(w.kind==='task'?'Người giao: ':'Người nhắc: ')+(w.sender||'Chưa ghi trong phiếu'));
  line('span','Người thực hiện: '+(w.performers||'Chưa xác định'));
  if(w.unread)line('p',w.unread+' tin chưa đọc · '+(w.preview||''));
  line('small','Mở chi tiết phiếu và trao đổi →');return link;
 }
}
customElements.define('nk-work-alerts',HospitalWorkAlerts);

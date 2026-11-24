'use strict';
const $=s=>document.querySelector(s);
const units={surgery:'Bệnh viện Ngoại khoa 115 Nghệ An'};
const embeddedWork=(new URLSearchParams(location.search).has('row')||new URLSearchParams(location.search).has('inline'))&&window.parent!==window;
if(embeddedWork)document.documentElement.classList.add('work-embed');
if(new URLSearchParams(location.search).has('chatOnly'))document.documentElement.classList.add('nk-chat-only');
const names={all:'Tổng quan',task:'Việc được giao',reminder:'Nhắc việc',chat:'Trao đổi',admin:'Quản trị nhân viên'};
const statuses=['Mới','Đã nhận','Đang thực hiện','Hoàn thành'];
const hrRole=position=>{const p=String(position||'').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim();return ['truong khoa','dieu duong truong'].includes(p)?'chief':p==='to truong'?'team':p?'staff':''};
const state={me:null,people:[],tab:'all',scope:'all',offset:0,rows:[],badges:{},screen:0,dialog:0,thread:null,seq:0,loading:false};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const accountLabel=p=>p?.admin&&!p.staff_code?p.username:p?.name;
const person=id=>accountLabel(state.people.find(x=>x.id===id)||state.members?.find(x=>x.id===id))||'Thành viên';
const options=(map,v)=>Object.entries(map).map(([k,n])=>'<option value="'+esc(k)+'" '+(k===v?'selected':'')+'>'+esc(n)+'</option>').join('');
const badge=n=>n?'<b class="badge">'+Number(n)+'</b>':'';
const api=(action,data={})=>request('/api/connect',{action,...data});
async function request(url,body,method='POST'){
 const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 const j=await r.json();if(!r.ok){if(r.status===401&&state.me){state.me=null;login()}throw Error(j.error||'Yêu cầu thất bại');}return j;
}
let noticeTimer,audio,lastUnread=0;
function notice(v){const target=$('#modal').open?$('#modalError'):$('#notice');if(!target)return;target.textContent=v;target.hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{target.hidden=true},6500);}
async function run(fn,button){if(button?.disabled)return;if(button)button.disabled=true;try{await fn()}catch(e){notice(e.message)}finally{if(button)button.disabled=false}}
function close(){$('#modal').classList.remove('expanded');if($('#modal').open)$('#modal').close();state.thread=null;state.dialog++;}
function modal(title,body){close();$('#dialogBody').innerHTML='<div class="modalbar"><h2>'+esc(title)+'</h2><button id="close">Đóng ×</button></div><p id="modalError" class="error" role="alert" hidden></p>'+body;$('#close').onclick=()=>{if(new URLSearchParams(location.search).has('detail'))window.parent.postMessage('ksnk-close-thread',location.origin);else close()};if(embeddedWork&&new URLSearchParams(location.search).has('inline'))$('#modal').show();else $('#modal').showModal();}
$('#modal').addEventListener('cancel',()=>{state.thread=null;state.dialog++});
function login(){
 if(window.parent!==window){window.top.location.replace('/');return;}
 document.querySelector('nk-work-alerts')?.remove();
 close();$('#dock').hidden=true;$('#identity').textContent='Điều hành KSNK';
 $('#app').innerHTML='<form id="login" class="card login"><p>Không gian làm việc nội bộ</p><h1>Đăng nhập nhân viên</h1><p>Sử dụng tài khoản do quản trị viên cấp.</p><label>Đơn vị đăng nhập<select name="unit">'+options(units,'surgery')+'</select></label><label>Tên đăng nhập<input required name="username" autocomplete="username"></label><label>Mã đăng nhập<input required type="password" name="password" autocomplete="current-password"></label><p class="error" id="loginError"></p><button class="primary">Đăng nhập</button><small>Mất mã? Liên hệ quản trị viên để được cấp lại.</small></form>';
 $('#login').onsubmit=e=>{e.preventDefault();const form=e.currentTarget;run(async()=>{try{const data=Object.fromEntries(new FormData(form));await request('/api/auth',data);localStorage.cxUnit=data.unit;await start()}catch(err){$('#loginError').textContent=err.message}},form.querySelector('button'))};
}
async function start(){
 const r=await api('me');state.me=r.me;state.people=r.people;state.reviewSettingsReady=!!r.reviewSettingsReady;state.scope='surgery';state.offset=0;const target=location.hash.slice(1);
 if(!embeddedWork&&window.parent===window){
 const q=new URLSearchParams(location.search),args=new URLSearchParams();
 if(target)args.set('work',target);
 if(q.has('thread'))args.set('thread',q.get('thread'));
 location.replace('/ngoai-khoa'+(args.size?'?'+args:''));return;
 }
 if(new URLSearchParams(location.search).has('inline'))document.documentElement.classList.add('nk-inline-task');
 if(new URLSearchParams(location.search).has('detail')){document.documentElement.classList.add('nk-detail-only');document.documentElement.classList.add('nk-inline-task');}
 if(!embeddedWork)document.documentElement.classList.add('nk-board-frame');
 state.tab=(target==='admin'&&r.me.admin)||['task','reminder','chat','account'].includes(target)?(target==='account'?'all':target):'reminder';lastUnread=0;
 if(window.parent===window&&!embeddedWork&&!document.querySelector('nk-work-alerts')){
 const alerts=document.createElement('nk-work-alerts');document.body.append(alerts);
 alerts.addEventListener('work-selected',e=>{e.preventDefault();run(()=>openThread(e.detail));});
 }
 $('#identity').textContent=r.me.name+' · '+units[r.me.unit];$('#dock').hidden=false;
 if(embeddedWork&&new URLSearchParams(location.search).has('inline')){try{const q=new URLSearchParams(location.search);if(['task','reminder'].includes(q.get('compose')))compose(q.get('compose'));else await openThread(q.get('thread'));}catch(e){document.body.append(document.createTextNode(e.message));}return;}
 dashboard();await refresh();
 const q=new URLSearchParams(location.search);
 if(q.has('thread')){try{await openThread(q.get('thread'));}catch(e){modal('Không mở được phiếu','<p>'+esc(e.message)+'</p>');}}
 if(target==='account')changeCode();
 if(q.has('row')){
 try{const result=await api('sourceThread',{kind:state.tab,row:Number(q.get('row')),ref:q.get('ref')});
 await openThread(result.id);}catch(e){if(embeddedWork){const panel=document.createElement('p');panel.setAttribute('role','status');panel.textContent=e.message;document.body.append(panel);}else notice(e.message);}
 }
}
function dashboard(){
 const a=state.me;state.screen++;
 $('#app').innerHTML='<div class="bar"><div>'+esc(units.surgery)+'</div><div class="actions"><button id="sound">'+(audio?'Tắt chuông':'Bật chuông')+'</button><select id="soundMode" aria-label="Kiểu chuông">'+options({normal:'Chuông thường',urgent:'Khẩn · lặp đến khi đọc'},localStorage.cxSoundMode||'normal')+'</select><button id="change">Đổi mã</button><button id="logout">Đăng xuất</button></div></div><section class="hero"><h1>'+'Công việc của tôi'+'</h1><p>Xin chào '+esc(a.name)+'. Theo dõi công việc và trao đổi của đơn vị.</p>'+((a.admin||a.legacy_operator)?'<a class="btn" href="/ngoai-khoa">Về trang nghiệp vụ</a>':'')+'</section><nav class="tabs" id="tabs"></nav><section class="bar"><h2 id="heading"></h2><div id="actions" class="actions"></div></section><div id="latest" class="actions" aria-live="polite"></div><section id="rows" class="list"></section><div id="pager" class="actions"></div>';
 if($('#scope'))$('#scope').onchange=e=>{state.scope=e.target.value;state.offset=0;dashboard();run(refresh)};
 $('#logout').onclick=()=>run(async()=>{await request('/api/auth',undefined,'DELETE');state.me=null;login()});
 $('#soundMode').onchange=e=>{localStorage.cxSoundMode=e.target.value};
 $('#change').onclick=changeCode;$('#sound').onclick=()=>run(async()=>{if(audio){await audio.close();audio=null}else{audio=new AudioContext();await audio.resume();tone()}$('#sound').textContent=audio?'Tắt chuông':'Bật chuông'});
 paint();
}
function tone(){if(!audio||audio.state!=='running')return;const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=650;g.gain.setValueAtTime(.07,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.35);o.start();o.stop(audio.currentTime+.36);}
function tab(k){state.tab=k;state.rows=[];state.offset=0;state.screen++;paint();run(refresh);}
document.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b&&state.me)tab(b.dataset.tab)});
async function refresh(){
 if(!state.me||new URLSearchParams(location.search).has('inline'))return;const current=++state.screen;
 const r=await api('board',{kind:state.tab==='admin'?'all':state.tab,scope:state.scope,offset:state.offset});
 if(current!==state.screen||!state.me)return;
 const counts=Object.fromEntries(r.badges.map(x=>[x.kind,Number(x.unread)]));
 const box=$('#latest'),item=r.latest;
 if(box&&box.dataset.key!==(item?item.id+'/'+item.seq:'none')){
 box.dataset.key=item?item.id+'/'+item.seq:'none';
 box.innerHTML=item?'<button data-open="'+esc(item.id)+'"><strong>'+esc(item.kind==='chat'?'Tin nhắn mới':item.title)+'</strong> · '+esc(item.body)+'</button>':'';
 }
 const sum=Object.values(counts).reduce((a,b)=>a+b,0);if(sum>0&&sum<=lastUnread&&localStorage.cxSoundMode==='urgent')tone();if(sum>lastUnread){tone();notice('Có '+sum+' cập nhật chưa đọc.')}lastUnread=sum;
 state.due=Object.fromEntries(r.due.map(x=>[x.kind,Number(x.quantity)]));state.badges=counts;state.rows=r.rows;paint();
}
function rowTitle(t){return t.kind==='chat'?'Trao đổi với '+person(t.owner_id===state.me.id?t.performers[0]:t.owner_id):t.title;}
const deadlineLabels=['Quá hạn','Hôm nay','Tuần này','Tuần sau','Trong 2 tuần','Xa hơn','Chưa có ngày','Đã xong'];
function deadlineGroup(t){
 if(t.status==='Hoàn thành')return 7;
 if(!t.due)return 6;
 const day=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
 const today=new Date(day+'T00:00:00Z'),delta=(Date.parse(t.due+'T00:00:00Z')-today.getTime())/86400000;
 const sunday=(7-today.getUTCDay())%7;
 if(delta<0)return 0;if(!delta)return 1;if(delta<=sunday)return 2;
 if(delta<=sunday+7)return 3;return delta<=14?4:5;
}
function paint(){
 if(!$('#rows')||!state.me)return;
 const k=state.tab,visible=Object.keys(names).filter(x=>(x!=='admin'||state.me.admin));
 $('#tabs').innerHTML=visible.map(t=>'<button data-tab="'+t+'" class="'+(t===k?'active':'')+'">'+names[t]+' '+badge(state.badges[t])+'</button>').join('');
 $('#chatCount').textContent=state.badges.chat||'';
 $('#heading').textContent=(k==='task'?((state.me.admin||state.me.legacy_operator)?'Giao việc toàn viện':'Việc được giao'):names[k])+((state.due?.[k]||0)>0?' · '+state.due[k]+' việc của tôi đến hạn hoặc quá hạn':'');$('#pager').innerHTML='';
 if(k==='admin'){
 $('#actions').innerHTML='<button class="primary" id="new">Cấp tài khoản</button><button id="matrixToggle" type="button">▦ MA TRẬN CẤP QUYỀN</button><button id="roster" type="button">Danh mục nhân viên hiện tại</button>';
 $('#new').onclick=()=>account();$('#roster').onclick=()=>run(directory);
 $('#matrixToggle').onclick=()=>{window.top.location.assign('/ngoai-khoa?work=permissions')};
 const query=state.adminSearch||'';
 const list=state.people.filter(x=>(state.scope==='all'||x.unit===state.scope)&&(!query||[x.name,x.username,x.department,x.staff_code].some(value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()))));
 $('#rows').innerHTML='<label class="admin-search">Tìm nhanh nhân viên<input id="adminSearch" type="search" autocomplete="off" placeholder="Họ tên, mã nhân viên, tên đăng nhập, bộ phận…" value="'+esc(query)+'"></label><small id="adminSearchCount">'+list.length+' / '+state.people.length+' tài khoản</small><div id="adminPeople">'+list.map(x=>'<div class="row"><div><strong>'+esc(x.name)+'</strong><small>'+esc(x.pending_login?'Chưa cấp tài khoản':x.username)+' · '+esc(x.department||'')+' · '+(x.admin?'Quản trị viên':x.active?'Đang hoạt động':'Đã khóa')+'</small></div>'+(x.admin?'':'<button data-account="'+x.id+'">Sửa / cấp lại mã</button>')+'</div>').join('')+'</div>';
 $('#adminSearch').oninput=e=>{state.adminSearch=e.target.value;const matches=state.people.filter(x=>(state.scope==='all'||x.unit===state.scope)&&[x.name,x.username,x.department,x.staff_code].some(value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(state.adminSearch.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())));$('#adminPeople').innerHTML=matches.map(x=>'<div class="row"><div><strong>'+esc(x.name)+'</strong><small>'+esc(x.username)+' · '+esc(x.department||'')+'</small></div>'+(x.admin?'':'<button data-account="'+x.id+'">Sửa / cấp lại mã</button>')+'</div>').join('')||'<div class="empty">Không tìm thấy nhân viên phù hợp.</div>';$('#adminSearchCount').textContent=matches.length+' / '+state.people.length+' tài khoản'};
 // Open the permission matrix in a sibling screen, never below the staff listing.
 return;
 }
 const actions=(k==='all'||k==='chat')?['chat']:[];$('#actions').innerHTML=actions.map(t=>'<button class="primary" data-new="'+t+'">'+({task:'+ Giao việc',reminder:'+ Nhắc việc',chat:'+ Trao đổi'}[t])+'</button>').join('');
 const work=k==='task'||k==='reminder',board=work&&localStorage.cxView!=='list';
 if(work){$('#actions').insertAdjacentHTML('afterbegin','<button id="viewMode">'+(board?'Dạng danh sách':'Bảng thời hạn')+'</button>');
 $('#viewMode').onclick=()=>{localStorage.cxView=board?'list':'board';paint()};}
 const card=({item:t,unread})=>{
 const member=[t.owner_id,...t.performers,...t.observers].includes(state.me.id);
 return '<div class="row"><div><small>'+names[t.kind]+' · '+esc(t.units.map(x=>units[x]).join(' / '))+'</small><strong>'+esc(rowTitle(t))+' '+badge(unread)+'</strong><small>'+esc(t.status)+' · '+esc(t.performers.map(person).join(', '))+(t.due&&t.due<=new Date(Date.now()+7*3600000).toISOString().slice(0,10)&&t.status!=='Hoàn thành'?' · <b class="late">Đến hạn / quá hạn</b>':'')+(t.due?' · Hạn '+esc(t.due.split('-').reverse().join('/')):'')+'</small>'+(member&&t.latest_message?'<p>'+esc(t.latest_message)+'</p>':'')+'</div>'+(member?'<button data-open="'+t.id+'">Mở</button>':'<button data-open="'+t.id+'">Xem tiến độ</button>')+'</div>';
 };
 if(board){
 const left=$('.deadlineGrid')?.scrollLeft||0;
 $('#rows').innerHTML='<div class="deadlineGrid" aria-label="Bảng thời hạn theo trang">'+deadlineLabels.map((label,i)=>{
 const items=state.rows.filter(r=>deadlineGroup(r.item)===i).sort((a,b)=>(a.item.due||'').localeCompare(b.item.due||''));
 return '<section class="lane"><h3>'+label+' · '+items.length+'</h3>'+items.map(card).join('')+'</section>'}).join('')+'</div>';
 $('.deadlineGrid').scrollLeft=left;
 }else $('#rows').innerHTML=state.rows.map(card).join('')||'<div class="empty">Chưa có nội dung trong phạm vi đang chọn.</div>';
 $('#pager').innerHTML=(state.offset?'<button data-step="-80">← Trang trước</button>':'')+(state.rows.length===80?'<button data-step="80">Trang sau →</button>':'');
}
$('#app').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.new)compose(b.dataset.new);
 if(b.dataset.account)account(state.people.find(x=>x.id===b.dataset.account));
 if(b.dataset.open)run(()=>openThread(b.dataset.open),b);
 if(b.dataset.step){state.offset+=Number(b.dataset.step);run(refresh);}
});
function changeCode(){
 modal('Đổi mã đăng nhập','<form id="edit">'+['Mã hiện tại','Mã mới (tối thiểu 12 ký tự)','Nhập lại mã mới'].map((s,i)=>'<label>'+s+'<input type="password" required name="'+['currentPassword','newPassword','confirmPassword'][i]+'"></label>').join('')+'<button class="primary">Lưu mã mới</button></form>');
 submit(async fd=>{await request('/api/settings/password',Object.fromEntries(fd));state.me=null;login();notice('Đã đổi mã. Vui lòng đăng nhập lại.')});
}
function submit(fn){$('#edit').onsubmit=e=>{e.preventDefault();const form=e.currentTarget;run(()=>fn(new FormData(form)),form.querySelector('button[type=submit],button.primary'))};}
async function account(x,staff){
 if(!staff&&x?.staff_code){try{const catalog=state.staffDirectory||await api('directory');state.staffDirectory=catalog;staff=catalog.staff?.find(entry=>entry.code===x.staff_code&&entry.unit===x.unit);}catch(e){notice('Không tải được hồ sơ nhân sự: '+e.message);}}
 const position=staff?.position||'',employment=staff?.employmentStatus||'';
 modal(x?'Cập nhật nhân viên':'Cấp tài khoản','<form id="edit"><label>Họ tên<input name="name" required value="'+esc(staff?.name||x?.name)+'"></label><label>Tên đăng nhập<input name="username" pattern="[a-z0-9._\\-]{3,50}" required value="'+esc(x?.pending_login?'':x?.username)+'"></label><label>Đơn vị<select name="unit">'+options(units,staff?.unit||x?.unit||'surgery')+'</select></label><label>Chức vụ trong Nhân sự<input readonly value="'+esc(position||'Chưa liên kết hồ sơ')+'"></label><label>Trạng thái nhân sự<input readonly value="'+esc(employment||'Chưa đối chiếu')+'"></label><label>Mã NV<input readonly value="'+esc(staff?.code||x?.staff_code||'Chưa liên kết')+'"></label><label>Mã mới '+(x&&!x.pending_login?'(để trống để giữ mã)':'')+'<input type="password" name="code" minlength="12" '+(x&&!x.pending_login?'':'required')+'></label><label>Trạng thái<select name="active">'+options({on:'Đang hoạt động',off:'Khóa tài khoản'},x?.active===false&&!x.pending_login?'off':'on')+'</select></label><label>Phân quyền nghiệp vụ<select name="role">'+options({staff:'Nhân viên · hồ sơ cá nhân',team:'Tổ trưởng · tất cả nhân viên trong bộ phận',chief:'Trưởng khoa / Điều dưỡng trưởng · toàn khoa'},x?.legacy_operator?'chief':x?.team_lead?'team':'staff')+'</select></label><div class="actions"><button type="button" id="applyHrRole">Đồng bộ vai trò theo Chức vụ</button><small id="hrRoleNote"></small></div><label id="teamDept">Bộ phận phụ trách<select name="department"><option value="">Chọn bộ phận</option>'+options(Object.fromEntries([...new Set(state.people.map(p=>p.department).filter(Boolean))].map(d=>[d,d])),x?.team_department||x?.department||staff?.department)+'</select></label><fieldset><legend>Quyền xem và cập nhật công việc của nhân viên</legend><label><input type="checkbox" name="view" '+(x?.work_view===false?'':'checked')+'> Được xem</label><label><input type="checkbox" name="editWork" '+(x?.work_edit===false?'':'checked')+'> Được sửa</label></fieldset><button class="primary">Lưu tài khoản</button></form>');
 const roles=$('#edit').elements;
 if(state.reviewSettingsReady){const label=document.createElement('label'),cb=document.createElement('input');cb.type='checkbox';cb.name='canApproveWork';cb.checked=!!x?.can_approve_work;label.append(cb,' Được phê duyệt tác vụ khi được chỉ định');roles.role.closest('label').after(label);}
 const suggested=hrRole(position),tip=$('#hrRoleNote'),syncButton=$('#applyHrRole');
 if(tip)tip.textContent=employment==='Đã nghỉ việc'?'Đã nghỉ việc: tài khoản cần khóa; hồ sơ và lịch sử được giữ.':suggested?'Chức vụ gợi ý vai trò '+({chief:'Trưởng khoa / Điều dưỡng trưởng',team:'Tổ trưởng',staff:'Nhân viên'}[suggested])+'. Chỉ cấp khi quản trị viên xác nhận.':'Hãy chuẩn hóa Chức vụ trong Nhân sự.';
 if(syncButton){syncButton.disabled=!suggested||employment==='Đã nghỉ việc';syncButton.onclick=()=>{roles.role.value=suggested;roles.view.checked=true;roles.editWork.checked=true;if(suggested==='team')roles.department.value=staff?.department||'';syncRole();};}
 if(employment==='Đã nghỉ việc'){roles.active.value='off';roles.active.disabled=true;}
 function syncRole(){roles.editWork.disabled=!roles.view.checked;if(!roles.view.checked)roles.editWork.checked=false;$('#teamDept').hidden=roles.role.value!=='team';}
 roles.role.onchange=roles.view.onchange=syncRole;syncRole();
 if(staff||x?.staff_code){$('#edit [name=name]').readOnly=true;$('#edit [name=unit]').disabled=true;}
 submit(async fd=>{await api('account',{...Object.fromEntries(fd),unit:staff?.unit||$('#edit [name=unit]').value,staffCode:staff?.code||x?.staff_code,id:x?.id,version:x?.version,active:employment==='Đã nghỉ việc'?false:fd.get('active')==='on',role:fd.get('role'),department:fd.get('department'),view:fd.has('view'),edit:fd.has('editWork'),canApproveWork:state.reviewSettingsReady?fd.has('canApproveWork'):undefined});state.people=(await api('me')).people;close();paint();notice('Đã lưu tài khoản.')});
}
const fileField='<label>Ảnh / tài liệu<input type="file" name="files" multiple accept="image/jpeg,image/png,image/webp,.pdf,.docx,.xlsx"></label><small>Tối đa 3 ảnh và 1 tài liệu, mỗi tệp tối đa 8 MB.</small>';
async function upload(fd){
 const selected=fd.getAll('files').filter(f=>f.size);
 const images=selected.filter(f=>f.type.startsWith('image/')).length;
 if(images>3||selected.length-images>1||selected.some(f=>f.size>8388608))throw Error('Kiểm tra số lượng hoặc dung lượng tệp.');
 const result=[];
 for(const file of selected){
 const f=await api('upload',{size:file.size,mime:file.type});
 const r=await fetch(f.url,{method:'PUT',headers:{'Content-Type':file.type},body:file});if(!r.ok)throw Error('Tải tệp thất bại. Hãy thử lại.');
 result.push({name:file.name,path:f.path});}return result;
}
function compose(kind){
 const direct=kind==='chat',everyone=state.people.filter(x=>(x.active||(!direct&&x.pending_login))&&(!direct||x.id!==state.me.id)&&(direct||!state.me.team_lead||state.me.admin||state.me.legacy_operator||x.department?.trim().toLocaleLowerCase('vi')===(state.me.team_department||state.me.department||'').trim().toLocaleLowerCase('vi')));
 const allowed=['surgery'];
 const picker=(name,radio)=>'<div class="picker">'+everyone.map(x=>'<label data-unit="'+x.unit+'"><input type="'+(radio?'radio':'checkbox')+'" name="'+name+'" value="'+x.id+'">'+esc(x.name)+' · '+esc([x.staff_code,x.department,x.pending_login?'Chưa cấp tài khoản':x.username].filter(Boolean).join(' · '))+'</label>').join('')+'</div>';
 modal(names[kind],'<form id="edit"><p>Người tạo · '+esc(accountLabel(state.me))+'</p><label>Đơn vị nhận</label><div class="picker">'+allowed.map(x=>'<label><input type="checkbox" name="unitChoice" value="'+x+'" '+(state.scope==='all'||state.scope===x?'checked':'')+'>'+esc(units[x])+'</label>').join('')+'</div>'+(direct?'':'<label>Tiêu đề<input required name="title" maxlength="180"></label><label>Ngày '+(kind==='task'?'đến hạn':'nhắc')+'<input type="date" name="due" required></label><label>Nội dung<textarea name="note" maxlength="6000"></textarea></label>')+'<label>'+(direct?'Người nhận':'Người thực hiện')+'</label>'+picker('performers',direct)+(direct?'':'<label>Người liên quan</label>'+picker('observers',false)+fileField)+'<button class="primary"> ' +(direct?'Mở trao đổi':'Lưu và mở trao đổi')+'</button></form>');
 const f=$('#edit');function filter(){const u=new FormData(f).getAll('unitChoice');f.querySelectorAll('[data-unit]').forEach(l=>{l.hidden=!u.includes(l.dataset.unit);if(l.hidden)l.querySelector('input').checked=false})}
 filter();f.onchange=e=>{if(e.target.name==='unitChoice')filter()};const id=crypto.randomUUID();
 submit(async fd=>{if(!fd.getAll('performers').length)throw Error('Chọn ít nhất một người nhận.');const files=await upload(fd);
 const r=await api('create',{kind,id,title:fd.get('title'),due:fd.get('due'),note:fd.get('note'),performers:fd.getAll('performers'),observers:fd.getAll('observers'),files});
 close();await refresh();await openThread(r.id);});
}
function messages(rows){return rows.map(m=>'<article class="msg '+(m.sender===state.me.id?'mine':'')+'"><strong>'+esc(m.sender?person(m.sender):'Thông báo hệ thống')+'</strong> <small>'+esc(new Date(m.sent).toLocaleString('vi-VN'))+'</small><div>'+esc(m.body)+'</div>'+m.files.map(f=>'<button data-file="'+esc(f.path)+'" data-msg="'+m.seq+'" data-image="'+(f.mime.startsWith('image/')?'1':'0')+'">'+esc(f.name)+'</button>').join('')+'</article>').join('');}
async function markSeen(){
 const s=$('#stream'),split=$('.split');if(!state.thread||!s||(window.frameElement&&!window.frameElement.getClientRects().length)||document.hidden||!$('#modal').open||s.scrollHeight-s.scrollTop-s.clientHeight>45)return;
 if(matchMedia('(max-width:800px)').matches&&split.dataset.view==='detail')return;
 if(state.seen>=state.seq)return;const n=state.seq,id=state.thread;await api('read',{id,seq:n});if(state.thread===id)state.seen=Math.max(state.seen,n);
 if(embeddedWork&&window.parent!==window)window.parent.postMessage({type:'ksnk-work-read',thread:id},location.origin);
}
async function openThread(id){
 const epoch=state.dialog;
 const r=await api('thread',{id});if(state.dialog!==epoch)return;

 state.members=r.members;const t=r.item,isChat=t.kind==='chat',canUpdate=r.writable&&(r.manage||[t.owner_id,...t.performers,...t.observers].includes(state.me.id));
 const shared=canUpdate;
 const summaryFacts='<div class="details pane"><h3>'+names[t.kind]+'</h3><p>Đơn vị · '+esc(t.units.map(x=>units[x]).join(' / '))+'</p><p>Người tạo · '+esc(t.owner_id?person(t.owner_id):'Chưa ghi trong sổ')+'</p><p>Người thực hiện · '+esc(t.performers.map(person).join(', '))+'</p><p>Người liên quan · '+esc(t.observers.map(person).join(', ')||'—')+'</p><p style="white-space:pre-wrap">'+esc(t.note)+'</p><p>Ngày '+(t.kind==='reminder'?'nhắc':'đến hạn')+' · '+esc(t.due||'—')+'</p>'+(!isChat?'<p>Bộ phận · '+esc(r.department||'—')+'</p><p>Ghi chú cá nhân · '+esc(r.personal||'—')+'</p><p>Ý kiến quản lý · '+esc(r.opinion||'—')+'</p>':'')+(r.writable&&!isChat?'<button id="editTask">Cập nhật tác vụ</button>':'')+(canUpdate&&!isChat?'<label>Trạng thái<select id="progress">'+options(Object.fromEntries(statuses.map(x=>[x,x])),t.status)+'</select></label><button id="saveStatus">Lưu trạng thái</button>':'')+'</div>';
 const inline=new URLSearchParams(location.search).has('inline');
 const chatOnly=new URLSearchParams(location.search).has('chatOnly');
 const legacyView=!isChat&&!chatOnly; // Chỉ hiện cuộc trao đổi bên phải, giữ mẫu nghiệp vụ trong cột chính.
 const reminder=t.kind==='reminder';
 const locked=r.approvalStatus==='ĐÃ PHÊ DUYỆT';
 const editable=r.writable&&!locked;
 function field(label,value){return '<div class="work-static-field"><small>'+label+'</small><div>'+esc(value||'—')+'</div></div>';}
 const detailForm='<div class="details pane work-original">'+
  '<section class="original-unit"><strong>'+(reminder?'Đơn vị được nhắc việc':'Đơn vị được giao việc')+'</strong><p>'+esc(t.units.map(x=>units[x]).join(' / '))+'</p></section>'+
  field(reminder?'Người nhắc việc':'Người giao việc',t.owner_id?person(t.owner_id):'Chưa ghi nhận')+
  '<form id="edit"><label>'+(reminder?'Ngày nhắc':'Đến ngày')+'<input name="due" type="date" value="'+esc(t.due)+'"></label>'+
  '<label>'+(reminder?'Tiêu đề nhắc việc':'Tiêu đề công việc')+'<input name="title" required maxlength="180" value="'+esc(t.title)+'"></label>'+
  field('Người thực hiện',t.performers.map(person).join(', '))+field('Người liên quan',t.observers.map(person).join(', '))+field('Bộ phận',r.department)+
  '<label>Nội dung / Mô tả<textarea name="note" maxlength="6000" rows="4">'+esc(t.note)+'</textarea></label>'+
  (!reminder?field('Mức độ ưu tiên',r.priority):'')+
  (r.originalFields||[]).map(([label,value])=>field(esc(label),value===true?'Có':value===false?'Không':value)).join('')+
  '<label>Ghi chú cá nhân<textarea name="personal" maxlength="6000">'+esc(r.personal)+'</textarea></label>'+
  (r.manage?'<label>Ý kiến quản lý<textarea name="opinion" maxlength="6000">'+esc(r.opinion)+'</textarea></label>':field('Ý kiến quản lý',r.opinion))+
  (editable?'<button type="submit" class="primary">LƯU DỮ LIỆU</button>':'')+'</form>'+ 
  (editable?'<section class="work-evidence"><strong>ẢNH / TÀI LIỆU MINH CHỨNG</strong><form id="workEvidence"><label>Chọn ảnh hoặc tài liệu<input name="files" type="file" multiple accept="image/jpeg,image/png,image/webp,.pdf,.docx,.xlsx"></label><label>Chụp ảnh trực tiếp<input name="files" type="file" accept="image/*" capture="environment"></label><small>Tối đa 3 ảnh và 1 tài liệu mỗi lần; tệp được lưu trong lịch sử trao đổi tác vụ.</small><button type="submit" class="primary">LƯU MINH CHỨNG</button></form></section>':'')+
  (canUpdate&&editable?'<label>Trạng thái<select id="progress">'+options(Object.fromEntries(statuses.map(x=>[x,x])),t.status)+'</select></label><button id="saveStatus">Lưu trạng thái</button>':field('Trạng thái',t.status))+'</div>';
 const facts=chatOnly?'':legacyView?detailForm:summaryFacts;
 modal(rowTitle(t),'<div class="phoneTabs"><button data-view="detail">Chi tiết</button><button data-view="chat">Trò chuyện</button></div><div class="split" data-view="chat">'+(chatOnly?'':legacyView?'<section class="inline-info original-pane">'+facts+'</section>':facts)+'<div class="discussion pane"><h3>'+esc(isChat?'Trao đổi riêng':t.kind==='task'?'Trò chuyện giao việc':'Trò chuyện nhắc việc')+'</h3><small>'+esc(r.members.map(x=>x.name).join(', '))+'</small><div id="stream" class="stream"><button id="older" '+(r.rows.length<50?'hidden':'')+'>Xem tin cũ hơn</button><div id="messages">'+messages(r.rows)+'</div></div><form id="send"><label>Tin nhắn<textarea name="body" maxlength="6000" placeholder="Nhập nội dung, gõ @ để nhắc tên thành viên…"></textarea></label><div id="mentions"></div>'+fileField+' <button class="primary">Gửi ➤</button></form></div></div>');
 if(legacyView){
  const form=$('#edit');
  for(const name of ['title','due','note'])form.elements[name].readOnly=!editable;
  form.elements.personal.readOnly=!editable;
  if(form.elements.opinion)form.elements.opinion.readOnly=!editable;
  if(editable){const rid=crypto.randomUUID();submit(async fd=>{await api('detailSave',{...Object.fromEntries(fd),id,expected:t.seq,requestId:rid});await openThread(id)});}
  else form.onsubmit=e=>e.preventDefault();
 }
 const evidenceForm=$('#workEvidence');
 if(evidenceForm)evidenceForm.onsubmit=e=>{e.preventDefault();run(async()=>{const files=await upload(new FormData(evidenceForm));if(!files.length)throw Error('Chọn ảnh hoặc tài liệu minh chứng trước khi lưu.');await api('send',{id,body:'Bổ sung ảnh / tài liệu minh chứng',files,requestId:crypto.randomUUID()});await openThread(id);},evidenceForm.querySelector('button.primary'))};
 if(!isChat && t.source_row && state.reviewSettingsReady){
  const status=r.approvalStatus,locked=status==='ĐÃ PHÊ DUYỆT';
  if(locked){$('#editTask')?.remove();$('#saveStatus')?.remove();$('#progress')?.closest('label')?.remove();}
  const panel=document.createElement('details');panel.className='inline-info';panel.open=true;
  const summary=document.createElement('summary');summary.textContent='Phê duyệt · '+status;panel.append(summary);
  const note=document.createElement('textarea');note.maxLength=2000;note.placeholder='Nội dung xin duyệt hoặc ý kiến xử lý';note.setAttribute('aria-label','Ý kiến phê duyệt');
  const reviewer=document.createElement('select');reviewer.setAttribute('aria-label','Người phê duyệt');
  reviewer.add(new Option('Chọn người phê duyệt',''));
  for(const p of state.people.filter(p=>p.active&&p.id!==state.me.id&&(p.admin||p.can_approve_work&&p.work_edit&&(p.legacy_operator||p.team_lead&&p.work_role_reviewed)))){reviewer.add(new Option(p.name+' · '+(p.department||p.username),p.id));}
  const request=r.writable&&(t.owner_id===state.me.id||t.performers.includes(state.me.id))&&!locked&&status!=='CHỜ PHÊ DUYỆT';
  if(request)panel.append(reviewer);
  if(request||r.writable&&r.canReview)panel.append(note);
  const decide=(op,label)=>{const button=document.createElement('button');button.textContent=label;const rid=crypto.randomUUID();button.onclick=()=>run(async()=>{await api('decision',{id,operation:op,reviewer:op==='request'?reviewer.value:null,expected:status,note:note.value,requestId:rid});await openThread(id)},button);panel.append(button)};
  if(request)decide('request','Xin phê duyệt');
  if(t.owner_id!==state.me.id&&r.writable&&r.canReview&&(state.me.admin||state.people.find(p=>p.id===state.me.id)?.can_approve_work)&&status==='CHỜ PHÊ DUYỆT'){decide('approve','Phê duyệt');decide('supplement','Yêu cầu bổ sung');decide('reject','Từ chối')}
  if(t.owner_id!==state.me.id&&r.writable&&r.canReview&&(state.me.admin||state.people.find(p=>p.id===state.me.id)?.can_approve_work)&&locked)decide('reopen','Mở lại tác vụ');
  let history=[];try{history=JSON.parse(r.approvalHistory)}catch{}
  if(Array.isArray(history)&&history.length){const list=document.createElement('ol');for(const event of history){const li=document.createElement('li');li.textContent=[event.at,event.managerName,event.status,event.opinion||event.request].filter(Boolean).join(' · ');list.append(li)}panel.append(list);}
  $('.details.pane')?.append(panel);
 }
 if(!isChat){const received=r.received||[],bar=document.createElement('div');bar.className='receipt';bar.textContent='Đã nhận · '+(received.map(person).join(', ')||'Chưa có người xác nhận');
 if(r.writable&&t.performers.includes(state.me.id)&&!received.includes(state.me.id)){const button=document.createElement('button');button.type='button';button.textContent='Xác nhận đã nhận';button.onclick=()=>run(async()=>{await api('receive',{id});await openThread(id)},button);bar.append(' ',button);}
 $('.discussion h3').after(bar);}
 $('.modalbar').insertAdjacentHTML('beforeend','<button id="expand">Mở rộng</button>');$('#expand').onclick=()=>{$('#expand').textContent=$('#modal').classList.toggle('expanded')?'Thu gọn':'Mở rộng'};
 state.thread=id;state.seq=r.rows.at(-1)?.seq||0;state.seen=0;state.first=r.rows[0]?.seq||0;
 const stream=$('#stream');stream.scrollTop=stream.scrollHeight;stream.onscroll=()=>run(markSeen);
 $('.phoneTabs').onclick=e=>{if(e.target.dataset.view){$('.split').dataset.view=e.target.dataset.view;run(markSeen)}};
 if($('#editTask'))$('#editTask').onclick=()=>{
 const editor='<form id="edit"><label>Tiêu đề<input name="title" required maxlength="180" value="'+esc(t.title)+'"></label><label>Ngày đến hạn<input name="due" required type="date" value="'+esc(t.due)+'"></label><label>Nội dung<textarea name="note" maxlength="6000">'+esc(t.note)+'</textarea></label><button class="primary">Lưu thay đổi</button></form>';
 if(inline){$('#editTask').hidden=true;$('#editTask').insertAdjacentHTML('afterend',editor);}else modal('Sửa '+names[t.kind].toLowerCase(),editor);
 const edit=$('#edit');edit.elements.title.readOnly=!shared;edit.elements.note.readOnly=!shared;edit.elements.due.readOnly=!shared;edit.elements.due.required=false;
 edit.querySelector('button').insertAdjacentHTML('beforebegin','<label>Ghi chú cá nhân<textarea name="personal" maxlength="6000">'+esc(r.personal)+'</textarea></label>'+(r.manage?'<label>Ý kiến quản lý<textarea name="opinion" maxlength="6000">'+esc(r.opinion)+'</textarea></label>':''));
 const rid=crypto.randomUUID();submit(async fd=>{await api('detailSave',{...Object.fromEntries(fd),id,expected:t.seq,requestId:rid});await openThread(id);});};
 if($('#saveStatus'))$('#saveStatus').onclick=e=>run(async()=>{await api('status',{id,status:$('#progress').value,requestId:crypto.randomUUID()});await updateThread();await refresh()},e.target);
 $('#older').onclick=e=>run(async()=>{const older=await api('thread',{id,before:state.first});if(state.thread!==id)return;const height=stream.scrollHeight;$('#messages').insertAdjacentHTML('afterbegin',messages(older.rows));state.first=older.rows[0]?.seq||state.first;$('#older').hidden=older.rows.length<50;stream.scrollTop+=stream.scrollHeight-height},e.target);
 const form=$('#send'),text=form.elements.body;
 text.oninput=()=>{const m=text.value.slice(0,text.selectionStart).match(/@([^@\n]{0,40})$/);$('#mentions').innerHTML=m?r.members.filter(x=>x.name.toLowerCase().includes(m[1].toLowerCase())).map(x=>'<button type="button" data-mention="'+x.id+'">'+esc(x.name)+'</button>').join(''):'';};
 $('#mentions').onclick=e=>{const u=r.members.find(x=>x.id===e.target.dataset.mention);if(u){const at=text.value.lastIndexOf('@',text.selectionStart);text.setRangeText('@'+u.name+' ',at,text.selectionStart,'end');$('#mentions').innerHTML='';text.focus()}};
 text.onkeydown=e=>{if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();form.requestSubmit()}};
 if(!r.writable)form.style.display='none';
 let pending=null;form.oninput=()=>{pending=null};
 form.onsubmit=e=>{e.preventDefault();run(async()=>{const fd=new FormData(form);if(!pending)pending={body:fd.get('body'),files:await upload(fd),id,requestId:crypto.randomUUID()};await api('send',pending);pending=null;form.reset();await updateThread();await refresh()},form.querySelector('.primary'))};
 $('#messages').onclick=e=>{const b=e.target.closest('[data-file]');if(!b)return;run(async()=>{const f=await api('file',{id,seq:Number(b.dataset.msg),path:b.dataset.file});if(b.dataset.image==='1'){const img=new Image();img.alt=b.textContent;img.src=f.signedUrl;b.replaceWith(img)}else{const link=document.createElement('a');link.href=f.signedUrl;link.target='_blank';link.rel='noopener';link.textContent='Mở tài liệu ↗';b.replaceWith(link);link.click()}},b)};
 await markSeen();await refresh();
}
async function updateThread(){
 const id=state.thread;if(!id||document.hidden||state.loading)return;state.loading=true;
 try{
 const r=await api('thread',{id});if(state.thread!==id||!$('#stream'))return;
 const fresh=r.rows.filter(x=>x.seq>state.seq),s=$('#stream'),near=s.scrollHeight-s.scrollTop-s.clientHeight<55;
 if(fresh.length){if(fresh[0].seq>state.seq+1){$('#messages').innerHTML=messages(r.rows);state.first=r.rows[0].seq;$('#older').hidden=false;}else $('#messages').insertAdjacentHTML('beforeend',messages(fresh));
 state.seq=fresh.at(-1).seq;if(near)s.scrollTop=s.scrollHeight;}
 await markSeen();
 }finally{state.loading=false}
}
let polling=false;
async function poll(){if(!state.me||document.hidden||polling)return;polling=true;try{await updateThread();await refresh()}catch(e){notice(e.message)}finally{polling=false}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});setInterval(poll,12000);
start().catch(e=>{login();if(!/đăng nhập lại/i.test(e.message))notice(e.message)});
async function directory(){
 const [catalog,accounts]=await Promise.all([api('directory'),api('me')]);state.people=accounts.people;
 modal('Danh mục nhân viên hiện tại','<div class="actions"><button id="syncStaff">Đối chiếu tự động</button><input id="findStaff" placeholder="Tìm họ tên, mã hoặc bộ phận"></div><div id="staffRows"></div><h3>Hồ sơ cũ cần xác nhận</h3><div id="reviewRows"></div>');
 const inScope=x=>state.scope==='all'||x.unit===state.scope;
 const staff=catalog.staff.filter(inScope),pending=catalog.pending.filter(inScope);state.staffDirectory=catalog;
 const available=s=>s.unit&&s.code&&s.name&&Number(s.copies)===1;
 const linked=s=>state.people.find(p=>p.unit===s.unit&&p.staff_code===s.code);
 const draw=()=>{const q=$('#findStaff').value.toLocaleLowerCase('vi').trim();
 $('#staffRows').innerHTML=staff.filter(s=>[s.name,s.code,s.department].join(' ').toLocaleLowerCase('vi').includes(q)).map(s=>{
 const p=linked(s);return '<div class="row"><div><strong>'+esc(s.name)+'</strong><small>'+esc([s.code,s.department,s.position||'Chưa có chức vụ',s.employmentStatus||'Chưa có trạng thái',units[s.unit]||'Đơn vị cần xác nhận'].join(' · '))+'</small></div>'+(!available(s)?'<small>Kiểm tra mã, đơn vị hoặc tên trong Nhân sự</small>':p?'<button data-profile="'+s.source_id+'">'+esc(p.pending_login?'Cấp tài khoản':p.username+' · Sửa')+'</button>':'<button data-profile="'+s.source_id+'">Cấp / nối tài khoản</button>')+'</div>'}).join('')||'<p>Không có hồ sơ phù hợp.</p>'};
 draw();$('#findStaff').oninput=draw;
 $('#syncStaff').onclick=e=>run(async()=>{await api('sync');await directory();notice('Đã đối chiếu tài khoản và các vai trò trong hồ sơ cũ.')},e.target);
 $('#staffRows').onclick=e=>{const b=e.target.closest('[data-profile]');if(!b)return;const s=staff.find(v=>v.source_id===Number(b.dataset.profile));const p=linked(s);if(p){account(p,s);return;}
 const candidates=state.people.filter(x=>!x.admin&&!x.staff_code&&x.unit===s.unit);
 modal(s.name+' · '+s.code,'<button id="createLinked">Tạo tài khoản từ hồ sơ này</button><label>Hoặc nối tài khoản hiện có<select id="existing"><option value="">Chọn tài khoản</option>'+options(Object.fromEntries(candidates.map(x=>[x.id,x.name+' · '+x.username])))+'</select></label><button id="linkExisting">Mở phiếu liên kết</button>');
 $('#createLinked').onclick=()=>account(null,s);$('#linkExisting').onclick=()=>{const p=candidates.find(x=>x.id===$('#existing').value);if(p)account(p,s);else notice('Chọn tài khoản cần liên kết.');};};
 $('#reviewRows').innerHTML=pending.map((w,i)=>'<div class="row"><div><strong>'+esc(w.token)+'</strong><small>Hồ sơ #'+esc(w.source_id)+' · '+esc(w.role)+' · '+esc(units[w.unit]||'Đơn vị chưa rõ')+'</small></div><button data-review="'+i+'">Đối chiếu</button></div>').join('')||'<p>Đã đối chiếu hết các tên đã ghi trên phiếu.</p>';
 $('#reviewRows').onclick=e=>{const b=e.target.closest('[data-review]');if(!b)return;const w=pending[Number(b.dataset.review)],items=staff.filter(s=>available(s)&&s.unit===w.unit);
 modal('Xác nhận '+w.role+' · '+w.token,'<label>Chọn đúng nhân viên<select id="confirmed"><option value="">Chọn họ tên và mã</option>'+options(Object.fromEntries(items.map(s=>[s.source_id,s.name+' · '+s.code+' · '+s.department])))+'</select></label><button id="confirmRole">Xác nhận liên kết</button>');
 $('#confirmRole').onclick=e=>run(async()=>{const id=Number($('#confirmed').value);if(!id)throw Error('Chọn nhân viên cần nối.');await api('confirm',{...w,src:w.source_id,employee:id});await directory()},e.target);};
}
async function historyWork(kind,offset){
 const r=await api('history',{kind,scope:state.scope,offset});
 modal(names[kind]+' · Hồ sơ nghiệp vụ cũ',r.rows.map(x=>'<article class="msg"><strong>'+esc(x.title||x.ref)+'</strong><div>'+esc([x.ref,x.day,x.status].filter(Boolean).join(' · '))+'</div><div>'+esc(x.roles)+'</div><p>'+esc(x.details)+'</p></article>').join('')+'<div class="actions">'+(offset?'<button id="historyPrev">Trang trước</button>':'')+(r.rows.length===80?'<button id="historyNext">Trang sau</button>':'')+'</div>'+(!r.rows.length?'<p>Chưa có hồ sơ liên kết trong phạm vi này.</p>':''));
 if($('#historyPrev'))$('#historyPrev').onclick=()=>run(()=>historyWork(kind,offset-80));
 if($('#historyNext'))$('#historyNext').onclick=()=>run(()=>historyWork(kind,offset+80));
}

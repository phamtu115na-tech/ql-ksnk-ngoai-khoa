/**
 * 90_CanhBao.gs
 * CẢNH BÁO TỔNG THỂ - chỉ đọc dữ liệu Giao việc + Kế hoạch tuần/tháng.
 */
function getSystemAlerts(filters) {
  filters = filters || {};
  var taskPacket = getTaskInitialData();
  var planPacket = getPlanInitialData();
  var tasks = (taskPacket && taskPacket.data) || [];
  var plans = []
    .concat((planPacket && planPacket.weekly) || [])
    .concat((planPacket && planPacket.monthly) || []);

  var today = new Date(); today.setHours(0,0,0,0);
  var horizon = new Date(today); horizon.setDate(horizon.getDate()+7);
  var person = String(filters.person || '').trim();
  var department = String(filters.department || '').trim();

  function norm(v){ return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').trim(); }
  function done(v){ var n=norm(v); return n.indexOf('hoan thanh')!==-1 || n.indexOf('da hoan thanh')!==-1 || n.indexOf('dong')!==-1; }
  function dateOf(v){
    if(!v) return null;
    if(Object.prototype.toString.call(v)==='[object Date]') { var d=new Date(v); d.setHours(0,0,0,0); return d; }
    var t=String(v).trim(), m;
    if((m=t.match(/^(\d{2})\/(\d{2})\/(\d{4})/))) return new Date(+m[3],+m[2]-1,+m[1]);
    if((m=t.match(/^(\d{4})-(\d{2})-(\d{2})/))) return new Date(+m[1],+m[2]-1,+m[3]);
    var d2=new Date(t); if(isNaN(d2.getTime())) return null; d2.setHours(0,0,0,0); return d2;
  }
  function days(d){ return d ? Math.round((d-today)/86400000) : null; }
  function level(d,status){
    if(done(status)) return '';
    var n=days(d);
    if(n===null) return 'PENDING';
    if(n<0) return 'OVERDUE';
    if(n===0) return 'TODAY';
    if(n<=3) return 'URGENT';
    if(n<=7) return 'UPCOMING';
    return '';
  }

  var out=[];
  tasks.forEach(function(x){
    var d=dateOf(x.endDate), lv=level(d,x.status);
    if(!lv) return;
    out.push({
      source:'TASK', sourceLabel:'Giao việc', id:x.taskId||'', rowId:x.rowId,
      person:x.assignee||'', department:'', title:x.title||'', description:x.description||'',
      due:x.endDate||'', status:x.status||'', level:lv, days:days(d)
    });
  });
  plans.forEach(function(x){
    var d=dateOf(x.toYmd||x.to), lv=level(d,x.status);
    if(!lv) return;
    out.push({
      source:'PLAN', sourceLabel:(String(x.type).toUpperCase()==='MONTH'?'Kế hoạch tháng':'Kế hoạch tuần'),
      id:x.id||'', planType:x.type||'', person:x.owner||'', department:x.department||'',
      title:x.content||'', description:x.description||'', due:x.to||x.toYmd||'',
      status:x.status||'', level:lv, days:days(d)
    });
  });

  // Bổ sung bộ phận Giao việc theo DM_NHANVIEN.
  var staff=(planPacket && planPacket.staff)||[];
  var depByName={};
  staff.forEach(function(x){ depByName[norm(x.name)]=x.department||''; });
  out.forEach(function(x){ if(x.source==='TASK'&&!x.department) x.department=depByName[norm(x.person)]||''; });

  if(person) out=out.filter(function(x){return norm(x.person)===norm(person);});
  if(department) out=out.filter(function(x){return norm(x.department)===norm(department);});

  var weight={OVERDUE:0,TODAY:1,URGENT:2,UPCOMING:3,PENDING:4};
  out.sort(function(a,b){return (weight[a.level]-weight[b.level]) || ((a.days||0)-(b.days||0)) || String(a.person).localeCompare(String(b.person),'vi');});

  var departments=(APP_CONFIG.DEPARTMENTS||[]).slice();
  var people={};
  staff.forEach(function(x){
    if(x.name) people[x.name]=true;
    if(x.department && departments.indexOf(x.department)===-1) departments.push(x.department);
  });

  return {
    success:true, alerts:out, departments:departments, people:Object.keys(people).sort(function(a,b){return a.localeCompare(b,'vi');}),
    summary:{
      total:out.length,
      overdue:out.filter(function(x){return x.level==='OVERDUE';}).length,
      today:out.filter(function(x){return x.level==='TODAY';}).length,
      urgent:out.filter(function(x){return x.level==='URGENT';}).length,
      upcoming:out.filter(function(x){return x.level==='UPCOMING';}).length
    }
  };
}

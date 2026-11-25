import {reportAccess} from '../../lib/report-access';
import Dock from '../LegacyConnectDock';
import {redirect} from 'next/navigation';
import {actor} from '../../lib/auth';
import LegacyDashboard from '../LegacyDashboard';
import Quick from '../HeaderQuickActions';
import Detail from '../ReminderDetailActions';
import Images from '../ReminderImageManager';
import {WorkProvider} from '../WorkBoard';
export default async function Dashboard({searchParams}:{searchParams:Promise<{work?:string;thread?:string}>}){
 const params=await searchParams,user=await actor();
 if(!user)redirect('/');
 const manager=user.admin||(user.legacy_operator&&user.work_view&&user.work_edit);
 const grant=await reportAccess(user);
 const utility=['account','chat',...(user.admin?['admin','permissions']:[])].includes(params.work||'')&&!params.thread;
 return <WorkProvider legacy={manager} team={user.team_lead||(user.legacy_operator&&!manager)}><nav aria-label="Tài khoản bệnh viện" className="nk-account-nav">{utility&&<a href="/ngoai-khoa">Trang chủ</a>}<a href="/ngoai-khoa?work=account">{user.name} · Tài khoản</a>{user.admin&&<><a href="/ngoai-khoa?work=admin">Quản trị nhân viên</a><a href="/ngoai-khoa?work=permissions">Ma trận cấp quyền</a></>}</nav>
 {utility?(params.work==='permissions'?<iframe className="nk-workboard nk-permissions-frame" title="Ma trận cấp quyền" src="/ngoai-khoa/permissions"/>:<iframe className="nk-workboard" title="Tài khoản và trao đổi riêng" src={'/connect/index.html?utility=1#'+params.work}/>):<><Quick/>{manager&&<><Detail/><Images/></>}<LegacyDashboard matrixAccess={grant.scope!=='none'} initialReminder={params.work==='reminder'} manager={manager} who={user.id} openWork={Boolean(params.work)} creatorName={user.admin&&!user.staff_code?user.username:user.name}/></>}
 <Dock/></WorkProvider>;
}

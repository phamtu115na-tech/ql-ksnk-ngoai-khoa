import Dock from '../LegacyConnectDock';
import {redirect} from 'next/navigation';
import {actor} from '../../lib/auth';
import LegacyDashboard from '../LegacyDashboard';
import Quick from '../HeaderQuickActions';
import Detail from '../ReminderDetailActions';
import Images from '../ReminderImageManager';
import WorkBoard from '../WorkBoard';
export default async function Dashboard({searchParams}:{searchParams:Promise<{work?:string}>}){
 const params=await searchParams;
 const user=await actor();
 if(!user)redirect('/');
 if(!user.admin&&!user.legacy_operator)return <main><h1>Giao việc &amp; Nhắc việc</h1><p>{user.name} · Bệnh viện Ngoại khoa 115 Nghệ An</p><WorkBoard/><Dock/></main>;
 return <><nav aria-label="Tài khoản bệnh viện" style={{display:'flex',gap:16,padding:'8px 16px'}}><a href="/ngoai-khoa?work=account">Tài khoản của tôi</a>{user.admin&&<a href="/ngoai-khoa?work=admin">Quản trị nhân viên</a>}</nav><Quick/><Detail/><Images/><LegacyDashboard openWork={Boolean(params.work)} creatorName={user.admin&&!user.staff_code?user.username:user.name}/><Dock/></>;
}

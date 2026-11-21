import Dock from '../LegacyConnectDock';
import {redirect} from 'next/navigation';
import {actor} from '../../lib/auth';
import LegacyDashboard from '../LegacyDashboard';
import Quick from '../HeaderQuickActions';
import Detail from '../ReminderDetailActions';
import Images from '../ReminderImageManager';
export default async function Dashboard(){
 const user=await actor();
 if(!user)redirect('/');
 if(!user.admin&&!user.legacy_operator)redirect('/connect/index.html#reminder');
 return <><nav aria-label="Tài khoản bệnh viện" style={{display:'flex',gap:16,padding:'8px 16px'}}><a href="/connect/index.html#account">Tài khoản của tôi</a>{user.admin&&<a href="/connect/index.html#admin">Quản trị nhân viên</a>}</nav><Quick/><Detail/><Images/><LegacyDashboard/><Dock/></>;
}

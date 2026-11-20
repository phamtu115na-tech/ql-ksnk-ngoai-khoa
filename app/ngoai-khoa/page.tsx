import Dock from '../LegacyConnectDock';
import {redirect} from 'next/navigation';
import {canOperateLegacy} from '../../lib/auth';
import LegacyDashboard from '../LegacyDashboard';
import Quick from '../HeaderQuickActions';
import Detail from '../ReminderDetailActions';
import Images from '../ReminderImageManager';
export default async function Dashboard(){
 if(!await canOperateLegacy())redirect('/');
 return <><a href="/">← Cổng điều hành</a><Quick/><Detail/><Images/><LegacyDashboard/><Dock/></>;
}

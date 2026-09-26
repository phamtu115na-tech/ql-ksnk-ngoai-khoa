import './globals.css';
import './report-responsive.css';
import './task.css';
import './login.css';
import type { Metadata } from 'next';
import HeaderQuickActions from './HeaderQuickActions';
import ReminderDetailActions from './ReminderDetailActions';
import ReminderImageManager from './ReminderImageManager';
export const metadata: Metadata={title:'QL KSNK Ngoại Khoa',description:'Quản lý KSNK Ngoại Khoa'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body><HeaderQuickActions/><ReminderDetailActions/><ReminderImageManager/>{children}</body></html>}

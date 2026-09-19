import './globals.css';
import type { Metadata } from 'next';
export const metadata: Metadata={title:'QL KSNK Ngoại Khoa',description:'Quản lý KSNK Ngoại Khoa'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}

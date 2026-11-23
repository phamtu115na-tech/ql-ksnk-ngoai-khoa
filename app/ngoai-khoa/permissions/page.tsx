import {redirect} from 'next/navigation'
import {actor} from '../../../lib/auth'
import PermissionMatrix from './PermissionMatrix'
export const dynamic='force-dynamic'
export default async function AdminPermissions(){
 const user=await actor()
 if(!user)redirect('/')
 if(!user.admin)return <main><p>Chỉ quản trị viên được truy cập mục này.</p></main>
 return <PermissionMatrix/>
}

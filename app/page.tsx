import {redirect} from 'next/navigation';
import {actor} from '../lib/auth';

export default async function Home(){
 const user=await actor();
 redirect(user?'/ngoai-khoa':'/connect/index.html');
}

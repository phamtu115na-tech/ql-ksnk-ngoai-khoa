import {createSign} from 'node:crypto'
const tokenUrl='https://oauth2.googleapis.com/token'
let cached:{token:string;expiry:number;email:string}|undefined
async function accessToken(email:string,privateKey:string){
 if(cached&&cached.email===email&&cached.expiry>Date.now()+60000)return cached.token
 const now=Math.floor(Date.now()/1000)
 const encode=(value:object)=>Buffer.from(JSON.stringify(value)).toString('base64url')
 const claims={iss:email,scope:'https://www.googleapis.com/auth/spreadsheets.readonly',aud:tokenUrl,iat:now,exp:now+3600}
 const data=encode({alg:'RS256',typ:'JWT'})+'.'+encode(claims)
 const signature=createSign('RSA-SHA256').update(data).sign(privateKey.replace(/\\n/g,'\n'),'base64url')
 const response=await fetch(tokenUrl,{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:data+'.'+signature}),signal:AbortSignal.timeout(8000),cache:'no-store'})
 if(!response.ok)throw Error('Không xác thực được tài khoản dịch vụ Google Sheets.')
 const value=await response.json()
 cached={token:value.access_token,expiry:Date.now()+Number(value.expires_in)*1000,email}
 return cached.token
}
export async function privateSheet(source:string,name:string){
 const email=process.env.GOOGLE_SHEETS_CLIENT_EMAIL,key=process.env.GOOGLE_SHEETS_PRIVATE_KEY
 if(!email&&!key)return null
 if(!email||!key)throw Error('Thiếu cấu hình tài khoản dịch vụ Google Sheets.')
 const bare=/^[\w-]{20,}$/.test(source),u=bare?null:new URL(source)
 const id=bare?source:u?.hostname==='docs.google.com'?u.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/)?.[1]:null
 if(!id)throw Error('Nguồn phải là ID hoặc URL bảng tính Google.')
 const gid=u?.searchParams.get('gid')??u?.hash.match(/gid=(\d+)/)?.[1]
 const token=await accessToken(email,key)
 const base='https://sheets.googleapis.com/v4/spreadsheets/'+id
 async function read(path:string){
  const r=await fetch(base+path,{headers:{Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(10000)})
  if(!r.ok)throw Error('Không đọc được bảng tính Google (HTTP '+r.status+'). Kiểm tra quyền Viewer và tab đã chọn.')
  return r.json()
 }
 const metadata=await read('?fields=sheets.properties(sheetId,title)')
 const tabs=metadata.sheets.map((s:{properties:{sheetId:number;title:string}})=>s.properties)
 const tab=tabs.find((p:{sheetId:number;title:string})=>gid!=null?String(p.sheetId)===gid:p.title===name)
 if(!tab)throw Error('Không tìm thấy tab theo tên hoặc GID đã cấu hình.')
 const values=await read('/values/'+encodeURIComponent("'"+tab.title.replace(/'/g,"''")+"'")+'?valueRenderOption=FORMATTED_VALUE')
 return {name:tab.title as string,rows:(values.values||[]) as string[][]}
}

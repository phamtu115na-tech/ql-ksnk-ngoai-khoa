// Historical signed links must be resolved by the authenticated server, not reused.
export function evidenceUrl(value:string){try{const url=new URL(value);if(url.protocol==='https:'&&url.pathname.startsWith('/storage/v1/object/'))return '/api/evidence?open=1&reference='+encodeURIComponent(value);}catch{}return value;}
export function evidenceStoragePath(reference:string,origin:string,bucket:string){
 try{const url=new URL(reference);if(url.origin!==new URL(origin).origin)return null;
 const match=url.pathname.match(/^\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/);
 if(!match||decodeURIComponent(match[1])!==bucket)return null;
 const path=decodeURIComponent(match[2]);if(path.split('/').some(part=>part==='..'||part==='.')||path.includes('\\'))return null;return path;
 }catch{return null;}
}

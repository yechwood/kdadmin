import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PORT=Number(process.env.PORT||8080), DATA_DIR=process.env.DATA_DIR||"./data", DATA_FILE=path.join(DATA_DIR,"db.json");
fs.mkdirSync(DATA_DIR,{recursive:true});
const emptyDb={users:[],devices:[],commands:[],sessions:[],pairings:[]};
function load(){try{return JSON.parse(fs.readFileSync(DATA_FILE,"utf8"))}catch{return structuredClone(emptyDb)}}
let db=load();
function save(){const t=DATA_FILE+".tmp";fs.writeFileSync(t,JSON.stringify(db,null,2),{mode:0o600});fs.renameSync(t,DATA_FILE)}
const id=(n=18)=>crypto.randomBytes(n).toString("base64url"), now=()=>new Date().toISOString();
function json(res,s,b){const o=JSON.stringify(b);res.writeHead(s,{"content-type":"application/json; charset=utf-8","content-length":Buffer.byteLength(o),"cache-control":"no-store","x-content-type-options":"nosniff"});res.end(o)}
const fail=(r,s,m)=>json(r,s,{error:m});
async function body(req){let n=0,c=[];for await(const x of req){n+=x.length;if(n>262144)throw Error("body too large");c.push(x)}return c.length?JSON.parse(Buffer.concat(c).toString("utf8")):{}}
function hashPassword(p,s=crypto.randomBytes(16).toString("hex")){return new Promise((ok,no)=>crypto.scrypt(p,s,64,{N:16384,r:8,p:1},(e,k)=>e?no(e):ok({salt:s,hash:k.toString("hex")})))}
function verifyPassword(p,s,h){return new Promise((ok,no)=>crypto.scrypt(p,s,64,{N:16384,r:8,p:1},(e,k)=>{if(e)return no(e);ok(crypto.timingSafeEqual(Buffer.from(k.toString("hex")),Buffer.from(h)))}))}
function bearer(req){const h=req.headers.authorization||"";return h.startsWith("Bearer ")?h.slice(7):null}
function user(req){const t=bearer(req),s=db.sessions.find(x=>x.token===t&&x.expiresAt>Date.now());return s?db.users.find(u=>u.id===s.userId):null}
function device(req){const t=bearer(req);return db.devices.find(d=>d.token===t&&d.active)}
const safe=d=>{const x={...d};delete x.token;delete x.deviceKey;return x};
const actions=new Set(["HIDE","UNHIDE","SUSPEND","UNSUSPEND","DISABLE_METERED_DATA","ENABLE_METERED_DATA","DISABLE_USER_CONTROL","ENABLE_USER_CONTROL","BLOCK_UNINSTALL","UNBLOCK_UNINSTALL","CLEAR_APP_STORAGE","ADD_USER_RESTRICTION","CLEAR_USER_RESTRICTION","SET_PERMISSION_DEFAULT","SET_PERMISSION_GRANTED","SET_PERMISSION_DENIED","LOCK","REBOOT","SET_CAMERA_DISABLED","SET_CAMERA_ENABLED","SET_USB_DISABLED","SET_USB_ENABLED","SET_SCREEN_CAPTURE_DISABLED","SET_SCREEN_CAPTURE_ENABLED"]);
const server=http.createServer(async(req,res)=>{
 try{
  const p=new URL(req.url,"http://localhost").pathname;
  if(req.method==="GET"&&p==="/v1/health")return json(res,200,{ok:true,time:now()});
  if(req.method==="POST"&&p==="/v1/auth/register"){const b=await body(req),email=String(b.email||"").trim().toLowerCase(),pw=String(b.password||"");if(!email||pw.length<10)return fail(res,400,"email and password (10+ characters) are required");if(db.users.some(u=>u.email===email))return fail(res,409,"account already exists");const h=await hashPassword(pw),u={id:id(),email,passwordSalt:h.salt,passwordHash:h.hash,createdAt:now()};db.users.push(u);save();return json(res,201,{userId:u.id})}
  if(req.method==="POST"&&p==="/v1/auth/login"){const b=await body(req),u=db.users.find(x=>x.email===String(b.email||"").trim().toLowerCase());if(!u||!(await verifyPassword(String(b.password||""),u.passwordSalt,u.passwordHash)))return fail(res,401,"invalid credentials");const token=id(32);db.sessions.push({token,userId:u.id,expiresAt:Date.now()+2592000000});save();return json(res,200,{token,userId:u.id})}
  if(req.method==="POST"&&p==="/v1/devices/register"){const b=await body(req),key=String(b.deviceKey||"");if(key.length<32)return fail(res,400,"deviceKey required");let d=db.devices.find(x=>x.deviceKey===key);if(!d){d={id:id(),deviceKey:key,token:id(32),name:String(b.name||"Android device").slice(0,80),model:String(b.model||"").slice(0,120),android:String(b.android||"").slice(0,40),userId:null,active:true,lastSeen:now(),createdAt:now(),updatedAt:now()};db.devices.push(d)}else{d.lastSeen=now();d.updatedAt=now()}save();return json(res,200,{deviceId:d.id,deviceToken:d.token,name:d.name})}
  if(req.method==="POST"&&p==="/v1/devices/pair/start"){const d=device(req);if(!d)return fail(res,401,"device authentication required");const code=String(crypto.randomInt(0,1000000)).padStart(6,"0"),q={id:id(),deviceId:d.id,code,expiresAt:Date.now()+600000,claimed:false};db.pairings=db.pairings.filter(x=>x.deviceId!==d.id||x.expiresAt<=Date.now());db.pairings.push(q);save();return json(res,200,{code,expiresAt:q.expiresAt})}
  if(req.method==="POST"&&p==="/v1/devices/pair/claim"){const u=user(req);if(!u)return fail(res,401,"login required");const b=await body(req),q=db.pairings.find(x=>x.code===String(b.code||"").trim()&&!x.claimed&&x.expiresAt>Date.now());if(!q)return fail(res,404,"pairing code expired or invalid");const d=db.devices.find(x=>x.id===q.deviceId);if(!d)return fail(res,404,"device not found");d.userId=u.id;d.updatedAt=now();q.claimed=true;save();return json(res,200,{device:safe(d)})}
  if(req.method==="GET"&&p==="/v1/devices"){const u=user(req);if(!u)return fail(res,401,"login required");return json(res,200,{devices:db.devices.filter(d=>d.userId===u.id).map(safe)})}
  const m=p.match(/^\/v1\/devices\/([^/]+)\/(commands|poll|ack|heartbeat)$/);
  if(m){const d=db.devices.find(x=>x.id===m[1]);if(!d)return fail(res,404,"device not found");
   if(m[2]==="heartbeat"&&req.method==="POST"){if(device(req)?.id!==d.id)return fail(res,401,"device authentication required");d.lastSeen=now();save();return json(res,200,{ok:true})}
   if(m[2]==="poll"&&req.method==="GET"){if(device(req)?.id!==d.id)return fail(res,401,"device authentication required");d.lastSeen=now();const cs=db.commands.filter(c=>c.deviceId===d.id&&c.status==="queued"&&c.expiresAt>Date.now()).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(0,20);cs.forEach(c=>{c.status="delivered";c.deliveredAt=now()});save();return json(res,200,{commands:cs})}
   if(m[2]==="ack"&&req.method==="POST"){if(device(req)?.id!==d.id)return fail(res,401,"device authentication required");const b=await body(req),c=db.commands.find(x=>x.id===b.commandId&&x.deviceId===d.id);if(!c)return fail(res,404,"command not found");c.status=b.success?"succeeded":"failed";c.result=String(b.result||"").slice(0,2000);c.completedAt=now();d.lastSeen=now();save();return json(res,200,{ok:true})}
   if(m[2]==="commands"&&req.method==="POST"){const u=user(req);if(!u||d.userId!==u.id)return fail(res,403,"not your device");const b=await body(req),a=String(b.action||"");if(!actions.has(a))return fail(res,400,"unsupported action");const c={id:id(),deviceId:d.id,action:a,packageName:String(b.packageName||"").slice(0,255),extras:typeof b.extras==="object"&&b.extras?b.extras:{},status:"queued",createdAt:now(),expiresAt:Date.now()+86400000};db.commands.push(c);save();return json(res,201,{command:c})}
  }
  if(req.method==="GET"&&p.startsWith("/v1/devices/")&&p.endsWith("/history")){const u=user(req);if(!u)return fail(res,401,"login required");const did=p.split("/")[3],d=db.devices.find(x=>x.id===did&&x.userId===u.id);if(!d)return fail(res,404,"device not found");return json(res,200,{commands:db.commands.filter(c=>c.deviceId===d.id).slice(-100).reverse()})}
  fail(res,404,"not found");
 }catch(e){console.error(e);fail(res,e.message==="body too large"?413:400,e.message||"bad request")}
});
server.listen(PORT,"0.0.0.0",()=>console.log("Kodroid server listening on :"+PORT));

const assert=require('assert');
const {socialUsername,socialUrl}=require('./api/_socials');
assert.equal(socialUrl('instagram','@oyu_thik'),'https://instagram.com/oyu_thik');
assert.equal(socialUrl('tiktok','oyu.thik'),'https://tiktok.com/@oyu.thik');
assert.equal(socialUsername('tiktok','https://www.tiktok.com/@oyu_thik'),'oyu_thik');
assert.equal(socialUrl('instagram',''),null);
for(const value of ['javascript:alert(1)','https://evil.com/user','https://instagram.com.evil.com/u','https://instagram.com/u/other','a b'])assert.throws(()=>socialUrl('instagram',value));
// Exercise API guards with fake DB and authentication, including forged roles.
const dbPath=require.resolve('./api/_db'), authPath=require.resolve('./api/_auth');
let actor, targetRole, writes;
const sql=async(strings,...values)=>{
 const q=strings.join('?');
 if(q.includes('SELECT role FROM'))return [{role:targetRole}];
 if(q.includes('SELECT club_id'))return [{club_id:1}];
 writes.push(q);return [];
};sql.transaction=async qs=>Promise.all(qs);
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{db:()=>sql}};
require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{requirePermission:async()=>actor,logActivity:async()=>{},getClientIp:()=>''}};
const handler=require('./api/admin/members');
async function patch(role,target,requested,expected){
 actor={role,club_id:1,id:99};targetRole=target;writes=[];
 let status=200; const res={status(n){status=n;return this},json(d){this.data=d;return this}};
 await handler({method:'PATCH',body:{id:4,role:requested},headers:{}},res);
 assert.equal(status,expected,`${role} -> ${target} -> ${requested}`);
 if(expected!==200)assert.equal(writes.length,0);
}
(async()=>{
 await patch('BOARD','MEMBER','CHAIR',200);
 await patch('BOARD','MEMBER','ADMIN',403);
 await patch('BOARD','ADMIN','MEMBER',403);
 await patch('ADMIN','SUPER_ADMIN','MEMBER',403);
 await patch('CHAIR','MEMBER','BOARD',403);
 await patch('SUPER_ADMIN','MEMBER','BOARD',200);
 console.log('Role API guards and social URL tests passed.');
})().catch(e=>{console.error(e);process.exit(1)});

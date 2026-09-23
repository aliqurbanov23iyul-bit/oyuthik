const { db } = require('./_db');
const { requireAdminAuth, logActivity, getClientIp } = require('./_auth');
const ROLE_KEYS=['SUPER_ADMIN','ADMIN','CHAIR','VICE_CHAIR','MEMBER'];
module.exports=async(req,res)=>{
 const user=await requireAdminAuth(req,res); if(!user)return;
 if(user.role!=='SUPER_ADMIN') return res.status(403).json({error:'Rolları yalnız Baş Admin idarə edə bilər.'});
 const sql=db();
 try{
  if(req.method==='GET'){
   const roles=await sql`
    SELECT r.role_key,r.display_name,r.color,r.sort_order,r.protected,
           count(u.id)::int member_count
    FROM role_settings r LEFT JOIN users u ON u.role=r.role_key
    GROUP BY r.role_key,r.display_name,r.color,r.sort_order,r.protected
    ORDER BY r.sort_order DESC,r.role_key
   `;
   return res.json({roles});
  }
  if(req.method==='PATCH'){
   const {roleKey,displayName,color,sortOrder}=req.body||{};
   if(!ROLE_KEYS.includes(roleKey)) return res.status(400).json({error:'Yanlış rol.'});
   const name=String(displayName||'').trim();
   if(name.length<2||name.length>80) return res.status(400).json({error:'Rol adı 2-80 simvol olmalıdır.'});
   const safeColor=/^#[0-9a-fA-F]{6}$/.test(color||'')?color:'#174fae';
   await sql`UPDATE role_settings SET display_name=${name},color=${safeColor},sort_order=${Number.isFinite(Number(sortOrder))?Number(sortOrder):0},updated_at=now() WHERE role_key=${roleKey}`;
   await logActivity(user,`Rol görünüşünü dəyişdi: ${roleKey} → ${name}`,{targetType:'role',targetName:roleKey,ip:getClientIp(req)});
   return res.json({ok:true});
  }
  return res.status(405).json({error:'Method not allowed'});
 }catch(e){console.error('roles api',e);return res.status(500).json({error:'Rollar cədvəli hazır deyil. migration.sql işlədilməlidir.'})}
};
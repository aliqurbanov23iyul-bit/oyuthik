const { db } = require('../_db');
const { requirePermission } = require('../_auth');
module.exports=async(req,res)=>{
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const user=await requirePermission(req,res,'create_event');if(!user)return;
 const id=parseInt(req.query?.id);if(!id)return res.status(400).json({error:'Tədbir seçilməyib.'});
 try{const sql=db();const ev=await sql`SELECT id,club_id FROM events WHERE id=${id} LIMIT 1`;if(!ev[0])return res.status(404).json({error:'Tədbir tapılmadı.'});
 if(!['SUPER_ADMIN','ADMIN'].includes(user.role)&&ev[0].club_id!==user.club_id)return res.status(403).json({error:'Bu tədbirin iştirakçılarını görməyə icazəniz yoxdur.'});
 const attendees=await sql`SELECT u.id,u.full_name,u.member_code,u.group_no,u.faculty,u.photo_url,c.name club_name,a.status FROM event_attendance a JOIN users u ON u.id=a.user_id LEFT JOIN clubs c ON c.id=u.club_id WHERE a.event_id=${id} AND a.status='GOING' ORDER BY u.full_name`;
 return res.json({attendees,count:attendees.length});}catch(e){return res.status(500).json({error:'Server xətası.'})}
};
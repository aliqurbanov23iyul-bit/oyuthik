const { db } = require('./_db');
const { getMemberSession } = require('./_auth');

module.exports = async (req,res) => {
  const user = await getMemberSession(req);
  if (!user) return res.status(401).json({ error:'Tədbirə qatılmaq üçün üzv hesabına giriş edin.', redirect:'/login.html' });
  const sql=db();
  const eventId=parseInt(req.body?.eventId || req.query?.eventId);
  if(!eventId) return res.status(400).json({error:'Tədbir seçilməyib.'});
  const ev=await sql`SELECT id,title,event_date FROM events WHERE id=${eventId} LIMIT 1`;
  if(!ev[0]) return res.status(404).json({error:'Tədbir tapılmadı.'});
  if(req.method==='GET'){
    const rows=await sql`SELECT 1 FROM event_attendance WHERE event_id=${eventId} AND user_id=${user.id} AND status='GOING' LIMIT 1`;
    return res.json({ok:true,joined:!!rows[0]});
  }
  if(req.method==='POST'){
    const existing=await sql`SELECT 1 FROM event_attendance WHERE event_id=${eventId} AND user_id=${user.id} AND status='GOING' LIMIT 1`;
    if(existing[0]) return res.status(409).json({error:'Siz artıq bu tədbirə qatılmısınız.',joined:true});
    await sql`INSERT INTO event_attendance(event_id,user_id,status) VALUES(${eventId},${user.id},'GOING') ON CONFLICT(event_id,user_id) DO UPDATE SET status='GOING'`;
    return res.json({ok:true,joined:true});
  }
  if(req.method==='DELETE'){
    await sql`DELETE FROM event_attendance WHERE event_id=${eventId} AND user_id=${user.id}`;
    return res.json({ok:true,joined:false});
  }
  return res.status(405).json({error:'Method not allowed'});
};
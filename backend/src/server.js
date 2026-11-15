import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 24) console.warn('WARNING: Set a strong JWT_SECRET in .env (24+ chars).');
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use('/api/auth', rateLimit({ windowMs: 15*60*1000, limit: 100, standardHeaders: true, legacyHeaders: false }));

const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const cleanUser = ({passwordHash,...u}) => u;
const tokenFor = user => jwt.sign({sub:user.id,role:user.role},JWT_SECRET,{expiresIn:process.env.JWT_EXPIRES_IN||'7d'});
const auth = asyncRoute(async(req,res,next)=>{
 const header=req.headers.authorization||''; const token=header.startsWith('Bearer ')?header.slice(7):null;
 if(!token) return res.status(401).json({message:'Authentication required'});
 try { const payload=jwt.verify(token,JWT_SECRET); req.user=await prisma.user.findUnique({where:{id:payload.sub}}); if(!req.user) return res.status(401).json({message:'User no longer exists'}); next(); }
 catch { return res.status(401).json({message:'Invalid or expired token'}); }
});
const organizer=(req,res,next)=>req.user?.role==='organizer'||req.user?.role==='admin'?next():res.status(403).json({message:'Organizer access required'});
const ownerOrOrg=(getOwner)=>asyncRoute(async(req,res,next)=>{const owner=await getOwner(req);if(owner===req.user.id||['organizer','admin'].includes(req.user.role))return next();res.status(403).json({message:'Not allowed'});});
const audit=(actorId,action,entity,entityId,metadata)=>prisma.auditLog.create({data:{actorId,action,entity,entityId,metadata:metadata||undefined}}).catch(()=>{});
const notify=async(userId,title,message,type='info',link=null)=>prisma.notification.create({data:{userId,title,message,type,link}});
const parse=(schema,data)=>{const r=schema.safeParse(data);if(!r.success)throw Object.assign(new Error(r.error.issues.map(x=>x.message).join('; ')),{status:400});return r.data;};
const idParam=z.object({id:z.string().min(1)});
const userSchema=z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(8),department:z.string().optional(),year:z.string().optional(),section:z.string().optional()});
app.get('/api/health',(req,res)=>res.json({ok:true,service:'CampusPlay API',time:new Date().toISOString()}));

// Auth
app.post('/api/auth/register',asyncRoute(async(req,res)=>{
 const d=parse(userSchema,req.body);const exists=await prisma.user.findUnique({where:{email:d.email.toLowerCase()}});
 if(exists)return res.status(409).json({message:'Email already registered'});
 const user=await prisma.user.create({data:{...d,email:d.email.toLowerCase(),passwordHash:await bcrypt.hash(d.password,10),role:'student'}});
 await audit(user.id,'register','User',user.id);res.status(201).json({user:cleanUser(user),token:tokenFor(user)});
}));
app.post('/api/auth/login',asyncRoute(async(req,res)=>{
 const email=String(req.body.email||'').toLowerCase(),password=String(req.body.password||'');
 const user=await prisma.user.findUnique({where:{email}});
 if(!user||!await bcrypt.compare(password,user.passwordHash))return res.status(401).json({message:'Invalid email or password'});
 res.json({user:cleanUser(user),token:tokenFor(user)});
}));
app.post('/api/auth/logout',auth,(req,res)=>res.json({message:'Logged out. Remove the token on the client.'}));
app.get('/api/auth/me',auth,(req,res)=>res.json({user:cleanUser(req.user)}));
app.post('/api/auth/forgot-password',(req,res)=>res.status(501).json({message:'Password reset requires an email provider. Contact your organizer/admin.'}));
app.post('/api/auth/reset-password',(req,res)=>res.status(501).json({message:'Password reset requires an email provider.'}));

// Profile/users
app.get('/api/users/profile',auth,(req,res)=>res.json({user:cleanUser(req.user)}));
app.put('/api/users/profile',auth,asyncRoute(async(req,res)=>{const data={};for(const k of ['name','department','year','section','phone','avatar'])if(req.body[k]!==undefined)data[k]=req.body[k];const user=await prisma.user.update({where:{id:req.user.id},data});res.json({user:cleanUser(user)});}));
app.put('/api/users/change-password',auth,asyncRoute(async(req,res)=>{if(!await bcrypt.compare(String(req.body.currentPassword||''),req.user.passwordHash))return res.status(400).json({message:'Current password is incorrect'});const password=String(req.body.newPassword||'');if(password.length<8)return res.status(400).json({message:'New password must be at least 8 characters'});await prisma.user.update({where:{id:req.user.id},data:{passwordHash:await bcrypt.hash(password,10)}});res.json({message:'Password changed'});}));
app.get('/api/users',auth,organizer,asyncRoute(async(req,res)=>res.json(await prisma.user.findMany({select:{id:true,name:true,email:true,role:true,department:true,year:true,section:true,createdAt:true}}))));
app.post('/api/users/organizer',auth,organizer,asyncRoute(async(req,res)=>{const d=parse(userSchema,req.body);const user=await prisma.user.create({data:{...d,email:d.email.toLowerCase(),passwordHash:await bcrypt.hash(d.password,10),role:'organizer'}});res.status(201).json({user:cleanUser(user)});}));

// Tournaments
app.get('/api/tournaments',asyncRoute(async(req,res)=>{const where={};if(req.query.sport)where.sport={contains:String(req.query.sport),mode:'insensitive'};if(req.query.status)where.status=String(req.query.status);if(req.query.search)where.name={contains:String(req.query.search),mode:'insensitive'};res.json(await prisma.tournament.findMany({where,include:{_count:{select:{teams:true,matches:true,registrations:true}}},orderBy:{createdAt:'desc'}}));}));
app.get('/api/tournaments/:id',asyncRoute(async(req,res)=>{const t=await prisma.tournament.findUnique({where:{id:req.params.id},include:{teams:true,matches:true}});if(!t)return res.status(404).json({message:'Tournament not found'});res.json(t);}));
app.post('/api/tournaments',auth,organizer,asyncRoute(async(req,res)=>{const t=await prisma.tournament.create({data:req.body});await audit(req.user.id,'create','Tournament',t.id);res.status(201).json(t);}));
app.put('/api/tournaments/:id',auth,organizer,asyncRoute(async(req,res)=>{const t=await prisma.tournament.update({where:{id:req.params.id},data:req.body});await audit(req.user.id,'update','Tournament',t.id);res.json(t);}));
app.patch('/api/tournaments/:id',auth,organizer,asyncRoute(async(req,res)=>res.json(await prisma.tournament.update({where:{id:req.params.id},data:req.body}))));
app.delete('/api/tournaments/:id',auth,organizer,asyncRoute(async(req,res)=>{await prisma.tournament.delete({where:{id:req.params.id}});res.json({message:'Tournament deleted'});}));
app.get('/api/tournaments/:id/teams',asyncRoute(async(req,res)=>res.json(await prisma.team.findMany({where:{tournamentId:req.params.id},include:{captain:{select:{id:true,name:true,department:true}},registrations:true}}))));
app.get('/api/tournaments/:id/fixtures',asyncRoute(async(req,res)=>res.json(await prisma.match.findMany({where:{tournamentId:req.params.id},include:{homeTeam:true,awayTeam:true},orderBy:{scheduledAt:'asc'}}))));
app.get('/api/tournaments/:id/participants',asyncRoute(async(req,res)=>{const regs=await prisma.registration.findMany({where:{tournamentId:req.params.id,status:{in:['approved','confirmed']}},include:{user:{select:{id:true,name:true,department:true}},team:true}});res.json({count:regs.length,participants:regs});}));

// Teams
app.get('/api/teams',asyncRoute(async(req,res)=>res.json(await prisma.team.findMany({where:{...(req.query.tournamentId?{tournamentId:String(req.query.tournamentId)}:{}),...(req.query.department?{department:String(req.query.department)}:{})},include:{captain:{select:{id:true,name:true,department:true}},tournament:true}}))));
app.get('/api/teams/:id',asyncRoute(async(req,res)=>{const t=await prisma.team.findUnique({where:{id:req.params.id},include:{captain:true,tournament:true,registrations:true,homeMatches:true,awayMatches:true}});if(!t)return res.status(404).json({message:'Team not found'});res.json(t);}));
app.post('/api/teams',auth,asyncRoute(async(req,res)=>{const {name,department,tournamentId,players=[]}=req.body;const t=await prisma.team.create({data:{name,department,tournamentId:tournamentId||null,captainId:req.user.id,players}});await audit(req.user.id,'create','Team',t.id);res.status(201).json(t);}));
app.put('/api/teams/:id',auth,ownerOrOrg(async req=>(await prisma.team.findUnique({where:{id:req.params.id}}))?.captainId),asyncRoute(async(req,res)=>res.json(await prisma.team.update({where:{id:req.params.id},data:{name:req.body.name,department:req.body.department,players:req.body.players}}))));
app.delete('/api/teams/:id',auth,asyncRoute(async(req,res)=>{const t=await prisma.team.findUnique({where:{id:req.params.id}});if(!t)return res.status(404).json({message:'Team not found'});if(t.captainId!==req.user.id&&!['organizer','admin'].includes(req.user.role))return res.status(403).json({message:'Not allowed'});await prisma.team.delete({where:{id:t.id}});res.json({message:'Team deleted'});}));
app.post('/api/teams/:id/players',auth,asyncRoute(async(req,res)=>{const t=await prisma.team.findUnique({where:{id:req.params.id}});if(!t)return res.status(404).json({message:'Team not found'});if(t.captainId!==req.user.id&&!['organizer','admin'].includes(req.user.role))return res.status(403).json({message:'Not allowed'});const players=Array.isArray(t.players)?t.players:[];players.push(req.body.player??req.body);res.json(await prisma.team.update({where:{id:t.id},data:{players}}));}));
app.delete('/api/teams/:id/players/:playerId',auth,asyncRoute(async(req,res)=>{const t=await prisma.team.findUnique({where:{id:req.params.id}});if(!t)return res.status(404).json({message:'Team not found'});if(t.captainId!==req.user.id&&!['organizer','admin'].includes(req.user.role))return res.status(403).json({message:'Not allowed'});const players=(Array.isArray(t.players)?t.players:[]).filter(p=>String(p.id??p.userId??p.email)!==req.params.playerId);res.json(await prisma.team.update({where:{id:t.id},data:{players}}));}));
app.patch('/api/teams/:id/captain',auth,organizer,asyncRoute(async(req,res)=>res.json(await prisma.team.update({where:{id:req.params.id},data:{captainId:req.body.captainId}}))));

// Registrations
app.post('/api/registrations',auth,asyncRoute(async(req,res)=>{const {tournamentId,teamId,type='individual',note}=req.body;if(!tournamentId)return res.status(400).json({message:'tournamentId is required'});const r=await prisma.registration.create({data:{userId:req.user.id,tournamentId,teamId:teamId||null,type,note}});await notify(req.user.id,'Registration submitted','Your tournament registration is pending review.');res.status(201).json(r);}));
app.get('/api/registrations/my',auth,asyncRoute(async(req,res)=>res.json(await prisma.registration.findMany({where:{userId:req.user.id},include:{tournament:true,team:true},orderBy:{createdAt:'desc'}}))));
app.get('/api/registrations',auth,organizer,asyncRoute(async(req,res)=>res.json(await prisma.registration.findMany({include:{user:{select:{id:true,name:true,email:true,department:true}},tournament:true,team:true},orderBy:{createdAt:'desc'}}))));
app.patch('/api/registrations/:id/status',auth,organizer,asyncRoute(async(req,res)=>{const status=String(req.body.status);if(!['approved','rejected','confirmed','pending'].includes(status))return res.status(400).json({message:'Invalid status'});const r=await prisma.registration.update({where:{id:req.params.id},data:{status},include:{user:true,tournament:true}});await notify(r.userId,'Registration '+status,`${r.tournament.name}: your registration was ${status}.`);res.json(r);}));
app.delete('/api/registrations/:id',auth,asyncRoute(async(req,res)=>{const r=await prisma.registration.findUnique({where:{id:req.params.id}});if(!r)return res.status(404).json({message:'Registration not found'});if(r.userId!==req.user.id&&!['organizer','admin'].includes(req.user.role))return res.status(403).json({message:'Not allowed'});if(r.status!=='pending'&&!['organizer','admin'].includes(req.user.role))return res.status(400).json({message:'Only pending registrations can be cancelled'});await prisma.registration.delete({where:{id:r.id}});res.json({message:'Registration cancelled'});}));

// Matches / scores
app.get('/api/matches',asyncRoute(async(req,res)=>res.json(await prisma.match.findMany({where:{...(req.query.tournamentId?{tournamentId:String(req.query.tournamentId)}:{}),...(req.query.status?{status:String(req.query.status)}:{})},include:{tournament:true,homeTeam:true,awayTeam:true},orderBy:{scheduledAt:'asc'}}))));
app.get('/api/matches/:id',asyncRoute(async(req,res)=>{const m=await prisma.match.findUnique({where:{id:req.params.id},include:{tournament:true,homeTeam:true,awayTeam:true}});if(!m)return res.status(404).json({message:'Match not found'});res.json(m);}));
app.post('/api/matches',auth,organizer,asyncRoute(async(req,res)=>{const d=req.body;if(d.venue&&d.scheduledAt){const start=new Date(d.scheduledAt),end=new Date(start.getTime()+90*60000);const conflict=await prisma.match.findFirst({where:{venue:d.venue,scheduledAt:{gte:new Date(start.getTime()-90*60000),lte:end},status:{not:'cancelled'}}});if(conflict)return res.status(409).json({message:'Venue booking conflicts within 90 minutes'});}const m=await prisma.match.create({data:{...d,scheduledAt:d.scheduledAt?new Date(d.scheduledAt):null}});res.status(201).json(m);}));
app.put('/api/matches/:id',auth,organizer,asyncRoute(async(req,res)=>res.json(await prisma.match.update({where:{id:req.params.id},data:{...req.body,scheduledAt:req.body.scheduledAt?new Date(req.body.scheduledAt):undefined}}))));
app.patch('/api/matches/:id/score',auth,organizer,asyncRoute(async(req,res)=>res.json(await prisma.match.update({where:{id:req.params.id},data:{homeScore:Number(req.body.homeScore??0),awayScore:Number(req.body.awayScore??0),homeOvers:req.body.homeOvers,awayOvers:req.body.awayOvers,status:req.body.status||'live'}}))));
app.delete('/api/matches/:id',auth,organizer,asyncRoute(async(req,res)=>{await prisma.match.delete({where:{id:req.params.id}});res.json({message:'Match deleted'});}));

// Results and standings
app.post('/api/results/:matchId',auth,organizer,asyncRoute(async(req,res)=>{const m=await prisma.match.findUnique({where:{id:req.params.matchId}});if(!m)return res.status(404).json({message:'Match not found'});const hs=Number(req.body.homeScore??m.homeScore),as=Number(req.body.awayScore??m.awayScore),winner=hs===as?null:(hs>as?m.homeTeamId:m.awayTeamId);const updated=await prisma.match.update({where:{id:m.id},data:{homeScore:hs,awayScore:as,status:'completed',winnerTeamId:winner,resultNote:req.body.note||null}});for(const tid of [m.homeTeamId,m.awayTeamId].filter(Boolean)){const won=tid===winner,draw=!winner;await prisma.standing.upsert({where:{tournamentId_teamId:{tournamentId:m.tournamentId,teamId:tid}},create:{tournamentId:m.tournamentId,teamId:tid,played:1,won:won?1:0,lost:(!won&&!draw)?1:0,drawn:draw?1:0,points:won?3:draw?1:0},update:{played:{increment:1},won:{increment:won?1:0},lost:{increment:(!won&&!draw)?1:0},drawn:{increment:draw?1:0},points:{increment:won?3:draw?1:0}}});}res.json(updated);}));
app.get('/api/results',asyncRoute(async(req,res)=>res.json(await prisma.match.findMany({where:{status:'completed'},include:{tournament:true,homeTeam:true,awayTeam:true},orderBy:{updatedAt:'desc'}}))));
app.get('/api/results/leaderboard/:tournamentId',asyncRoute(async(req,res)=>res.json(await prisma.standing.findMany({where:{tournamentId:req.params.tournamentId},include:{team:true},orderBy:[{points:'desc'},{won:'desc'}]}))));

// Notifications
app.get('/api/notifications',auth,asyncRoute(async(req,res)=>res.json(await prisma.notification.findMany({where:{userId:req.user.id},orderBy:{createdAt:'desc'}}))));
app.get('/api/notifications/unread-count',auth,asyncRoute(async (req,res)=>{ const count=await prisma.notification.count({where:{userId:req.user.id,read:false}}); res.json({count}); }));
app.patch('/api/notifications/:id/read',auth,asyncRoute(async(req,res)=>{const n=await prisma.notification.findUnique({where:{id:req.params.id}});if(!n||n.userId!==req.user.id)return res.status(404).json({message:'Notification not found'});res.json(await prisma.notification.update({where:{id:n.id},data:{read:true}}));}));
app.patch('/api/notifications/read-all',auth,asyncRoute(async(req,res)=>{await prisma.notification.updateMany({where:{userId:req.user.id,read:false},data:{read:true}});res.json({message:'All notifications marked read'});}));

// Analytics
app.get('/api/analytics/dashboard',auth,organizer,asyncRoute(async(req,res)=>{const [users,tournaments,teams,matches,completed,pending]=await Promise.all([prisma.user.count(),prisma.tournament.count(),prisma.team.count(),prisma.match.count(),prisma.match.count({where:{status:'completed'}}),prisma.registration.count({where:{status:'pending'}})]);res.json({users,tournaments,teams,matches,completedMatches:completed,pendingRegistrations:pending,completionRate:matches?Math.round(completed/matches*100):0});}));
app.get('/api/analytics/participation',auth,organizer,asyncRoute(async(req,res)=>{const tournaments=await prisma.tournament.findMany({include:{_count:{select:{registrations:true,teams:true}}}});const departments=await prisma.user.groupBy({by:['department'],_count:{_all:true}});res.json({sports:tournaments.map(t=>({sport:t.sport,tournament:t.name,registrations:t._count.registrations,teams:t._count.teams})),departments});}));
app.get('/api/analytics/performance',auth,organizer,asyncRoute(async(req,res)=>{const standings=await prisma.standing.findMany({include:{team:true,tournament:true},orderBy:{points:'desc'},take:20});const [total,completed]=await Promise.all([prisma.match.count(),prisma.match.count({where:{status:'completed'}})]);res.json({topTeams:standings,matchBreakdown:{total,completed,upcoming:total-completed}});}));

// Compatibility snapshot endpoints (legacy frontend)
app.get('/api/data',asyncRoute(async(req,res)=>{const [tournaments,teams,matches,registrations]=await Promise.all([prisma.tournament.findMany(),prisma.team.findMany(),prisma.match.findMany(),prisma.registration.findMany()]);res.json({tournaments,teams,matches,registrations});}));
app.put('/api/data',auth,organizer,asyncRoute(async(req,res)=>res.status(501).json({message:'Use the dedicated resource endpoints; snapshot writes are disabled to protect relational data.'})));

app.use((req,res)=>res.status(404).json({message:`Route not found: ${req.method} ${req.path}`}));
app.use((err,req,res,next)=>{console.error(err);const status=err.status|| (err.code==='P2002'?409:err.code==='P2025'?404:500);res.status(status).json({message:status===500?'Internal server error':err.message, ...(process.env.NODE_ENV==='development'&&status===500?{detail:err.message}:{})});});
app.listen(PORT,()=>console.log(`CampusPlay API running at http://localhost:${PORT}/api`));

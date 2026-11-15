import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from './prisma.js';
import { authenticate, allowRoles } from './middleware.js';

const app = express();
const port = Number(process.env.PORT || 4000);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters.');
}
app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(x => x.trim()), credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
  collegeId: z.string().trim().max(40).optional(),
  department: z.string().trim().max(80).optional(),
  year: z.string().trim().max(30).optional(),
  section: z.string().trim().max(20).optional(),
  sport: z.string().trim().max(60).optional()
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

function publicAccount(a) {
  return { id:a.id, name:a.name, email:a.email, role:a.role, collegeId:a.collegeId, department:a.department, year:a.year, section:a.section, sport:a.sport, createdAt:a.createdAt };
}
function issueToken(a) {
  return jwt.sign({ sub:a.id, role:a.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}
async function audit(actorId, action, entity, entityId, metadata) {
  await prisma.auditLog.create({ data:{ actorId, action, entity, entityId, metadata: metadata ? JSON.stringify(metadata) : null } });
}

app.get('/api/health', (_req,res) => res.json({ status:'ok', service:'CampusPlay API', timestamp:new Date().toISOString() }));

app.post('/api/auth/register', asyncRoute(async (req,res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error:'Invalid registration details', details:parsed.error.flatten() });
  const email = parsed.data.email.toLowerCase();
  if (await prisma.account.findUnique({ where:{email} })) return res.status(409).json({ error:'An account with this email already exists' });
  const account = await prisma.account.create({ data:{ ...parsed.data, email, passwordHash:await bcrypt.hash(parsed.data.password, 12), role:'student' } });
  await audit(account.id, 'account.registered', 'account', account.id);
  res.status(201).json({ user:publicAccount(account), token:issueToken(account) });
}));

app.post('/api/auth/login', asyncRoute(async (req,res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error:'Email and password are required' });
  const account = await prisma.account.findUnique({ where:{email:parsed.data.email.toLowerCase()} });
  if (!account || !(await bcrypt.compare(parsed.data.password, account.passwordHash))) return res.status(401).json({ error:'Incorrect email or password' });
  res.json({ user:publicAccount(account), token:issueToken(account) });
}));

app.get('/api/auth/me', authenticate, asyncRoute(async (req,res) => {
  const account = await prisma.account.findUnique({ where:{id:req.user.id} });
  res.json({ user:publicAccount(account) });
}));

// One versioned snapshot lets the existing frontend migrate from localStorage incrementally.
app.get('/api/data', authenticate, asyncRoute(async (_req,res) => {
  const row = await prisma.appSnapshot.findUnique({ where:{id:'campusplay'} });
  res.json(row ? { data:JSON.parse(row.payload), revision:row.revision } : { data:null, revision:0 });
}));

app.put('/api/data', authenticate, allowRoles('organizer'), asyncRoute(async (req,res) => {
  const { data, expectedRevision } = req.body || {};
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error:'A valid data object is required' });
  if (!Array.isArray(data.tournaments) || !Array.isArray(data.teams) || !Array.isArray(data.matches) || !Array.isArray(data.registrations)) {
    return res.status(400).json({ error:'Snapshot is missing required CampusPlay collections' });
  }
  const current = await prisma.appSnapshot.findUnique({ where:{id:'campusplay'} });
  const revision = current?.revision || 0;
  if (expectedRevision !== undefined && expectedRevision !== revision) return res.status(409).json({ error:'Snapshot has changed. Reload before saving.', revision });
  const nextRevision = revision + 1;
  await prisma.appSnapshot.upsert({
    where:{id:'campusplay'},
    create:{ id:'campusplay', payload:JSON.stringify(data), revision:nextRevision },
    update:{ payload:JSON.stringify(data), revision:nextRevision }
  });
  await audit(req.user.id, 'snapshot.updated', 'app', 'campusplay', { revision:nextRevision });
  res.json({ ok:true, revision:nextRevision });
}));

app.patch('/api/auth/profile', authenticate, asyncRoute(async (req,res) => {
  const schema = z.object({ name:z.string().trim().min(2).max(80).optional(), collegeId:z.string().max(40).optional(), department:z.string().max(80).optional(), year:z.string().max(30).optional(), section:z.string().max(20).optional(), sport:z.string().max(60).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error:'Invalid profile fields', details:parsed.error.flatten() });
  const account = await prisma.account.update({ where:{id:req.user.id}, data:parsed.data });
  await audit(req.user.id, 'profile.updated', 'account', account.id);
  res.json({ user:publicAccount(account) });
}));

// Organizer-only account administration. Public signup can never assign an organizer role.
app.get('/api/admin/users', authenticate, allowRoles('organizer'), asyncRoute(async (_req,res) => {
  const users = await prisma.account.findMany({ orderBy:{createdAt:'desc'}, take:500 });
  res.json({ users:users.map(publicAccount) });
}));
app.patch('/api/admin/users/:id/role', authenticate, allowRoles('organizer'), asyncRoute(async (req,res) => {
  const role = z.enum(['student','organizer']).safeParse(req.body?.role);
  if (!role.success) return res.status(400).json({ error:'Role must be student or organizer' });
  if (req.params.id === req.user.id && role.data === 'student') return res.status(400).json({ error:'You cannot remove your own organizer access' });
  const user = await prisma.account.update({ where:{id:req.params.id}, data:{role:role.data} });
  await audit(req.user.id, 'user.role_changed', 'account', user.id, { role:role.data });
  res.json({ user:publicAccount(user) });
}));
app.get('/api/admin/audit-logs', authenticate, allowRoles('organizer'), asyncRoute(async (req,res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const logs = await prisma.auditLog.findMany({ orderBy:{createdAt:'desc'}, take:limit });
  res.json({ logs:logs.map(x => ({...x, metadata:x.metadata ? JSON.parse(x.metadata) : null})) });
}));

app.use((err,_req,res,_next) => {
  console.error(err);
  if (err?.code === 'P2002') return res.status(409).json({ error:'A record with that unique value already exists' });
  if (err?.code === 'P2025') return res.status(404).json({ error:'Record not found' });
  res.status(500).json({ error: process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message || 'Internal server error') });
});

async function bootstrapOrganizer() {
  const email = process.env.BOOTSTRAP_ORGANIZER_EMAIL?.toLowerCase();
  const password = process.env.BOOTSTRAP_ORGANIZER_PASSWORD;
  if (!email || !password) return;
  if (password.length < 12) throw new Error('BOOTSTRAP_ORGANIZER_PASSWORD must be at least 12 characters');
  const existing = await prisma.account.findUnique({ where:{email} });
  if (!existing) {
    const name = process.env.BOOTSTRAP_ORGANIZER_NAME || 'CampusPlay Organizer';
    await prisma.account.create({ data:{ name, email, passwordHash:await bcrypt.hash(password,12), role:'organizer' } });
    console.log(`Bootstrap organizer created: ${email}`);
  }
}
await bootstrapOrganizer();
const server = app.listen(port, () => console.log(`CampusPlay API listening on http://localhost:${port}`));
async function shutdown() { server.close(); await prisma.$disconnect(); process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

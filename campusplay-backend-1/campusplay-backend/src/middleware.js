import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const account = await prisma.account.findUnique({ where: { id: payload.sub } });
    if (!account) return res.status(401).json({ error: 'Account no longer exists' });
    req.user = { id: account.id, name: account.name, email: account.email, role: account.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: 'You do not have permission to perform this action' });
}

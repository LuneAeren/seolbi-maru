import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { fail } from './core.js';

export function readConfig(env = process.env) {
  const mode = env.APP_MODE || 'demo';
  if (!['demo', 'production'].includes(mode)) throw new Error('APP_MODE must be demo or production');
  if (env.NODE_ENV === 'production' && mode !== 'production') throw new Error('Production requires APP_MODE=production');
  const origin = env.PUBLIC_ORIGIN || `http://127.0.0.1:${env.PORT || 4317}`;
  const u = new URL(origin);
  if (u.origin !== origin || u.username || u.password) throw new Error('PUBLIC_ORIGIN must be an origin without a trailing slash');
  const config = { mode, origin, staleAfterMinutes: Number(env.STALE_AFTER_MINUTES || 30), secret: env.AUTH_PROXY_SECRET || '', users: (env.DEPARTMENT_USERS || '').split(',').map(x => x.trim()).filter(Boolean), proxies: (env.AUTH_PROXY_IPS || '127.0.0.1,::ffff:127.0.0.1,::1').split(','), allowedSiteHosts: (env.ALLOWED_SITE_HOSTS || '').split(',').filter(Boolean), host: env.HOST || '127.0.0.1', port: Number(env.PORT || 4317), dataFile: env.DATA_FILE || `data/${mode}.sqlite` };
  config.integrationWritable = env.REFERENCE_SERVICE_WRITE === '1';
  if (env.REFERENCE_SERVICE_WRITE && !['0','1'].includes(env.REFERENCE_SERVICE_WRITE)) throw new Error('REFERENCE_SERVICE_WRITE must be 0 or 1');
  if (mode === 'production' && config.integrationWritable) throw new Error('Production integration reference writes must stay disabled');
  try { config.integrationRoles = JSON.parse(env.REFERENCE_SERVICE_ROLES || '{}'); }
  catch { throw new Error('REFERENCE_SERVICE_ROLES must be a JSON role mapping'); }
  if (!config.integrationRoles || typeof config.integrationRoles !== 'object' || Array.isArray(config.integrationRoles) || Object.keys(config.integrationRoles).length > 100 || Object.values(config.integrationRoles).some(role => !['assigner','operator','viewer'].includes(role))) throw new Error('Invalid REFERENCE_SERVICE_ROLES');
  if (mode === 'production' && (config.secret.length < 32 || !config.users.length || u.protocol !== 'https:')) throw new Error('Production requires HTTPS PUBLIC_ORIGIN, AUTH_PROXY_SECRET (32+ characters), and DEPARTMENT_USERS');
  if (!Number.isFinite(config.staleAfterMinutes) || config.staleAfterMinutes < 1 || config.staleAfterMinutes > 10080) throw new Error('STALE_AFTER_MINUTES must be between 1 and 10080');
  if (mode === 'demo' && config.host !== '127.0.0.1') throw new Error('Demo must bind to 127.0.0.1');
  return config;
}
export function security(config) {
  const sessions = new Map();
  return function (req, res, next) {
    try {
      if (req.headers.host !== new URL(config.origin).host) fail(403, '허용되지 않은 호스트입니다.');
      const now = Date.now();
      let user = 'demo-engineer';
      if (config.mode === 'production') {
        const stamp = req.get('x-portal-time') || '', signature = req.get('x-portal-signature') || '';
        user = req.get('x-portal-user') || '';
        if (!config.proxies.includes(req.socket.remoteAddress) || !/^\d{13}$/.test(stamp) || Math.abs(now - Number(stamp)) > 30000 || !config.users.includes(user)) fail(401, '사내 계정 인증을 확인할 수 없습니다.', 'AUTH_REQUIRED');
        const expected = createHmac('sha256', config.secret).update(`${user}\n${stamp}\n${req.method}\n${req.originalUrl}`).digest();
        const supplied = /^[a-f0-9]{64}$/.test(signature) ? Buffer.from(signature, 'hex') : Buffer.alloc(0);
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) fail(401, '사내 인증 서명이 올바르지 않습니다.', 'AUTH_REQUIRED');
      }
      const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('portal_sid='))?.slice(11);
      let session = sessions.get(cookie);
      if (!session || session.user !== user || session.expires < now) {
        for (const [key, value] of sessions) if (value.expires < now) sessions.delete(key);
        if (sessions.size >= 1000) fail(503, '접속이 많습니다. 잠시 후 다시 시도해주세요.');
        const id = randomBytes(32).toString('hex');
        session = { user, token: randomBytes(32).toString('hex'), expires: now + 12 * 3600000, writes: [] };
        sessions.set(id, session);
        res.cookie('portal_sid', id, { httpOnly: true, sameSite: 'strict', secure: config.mode === 'production', path: '/', maxAge: 12 * 3600000 });
      }
      req.actor = user; req.portalSession = session;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        if (req.get('origin') !== config.origin || req.get('x-csrf-token') !== session.token) fail(403, '화면을 새로고침한 뒤 다시 저장해주세요.', 'CSRF_REJECTED');
        session.writes = session.writes.filter(t => t > now - 60000);
        if (session.writes.length >= 120) fail(429, '요청이 많습니다. 잠시 후 다시 시도해주세요.');
        session.writes.push(now);
      }
      next();
    } catch (e) { next(e); }
  };
}

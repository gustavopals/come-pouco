import crypto from 'node:crypto';

import env from '../config/env';

const hashIp = (ip: string): string => {
  const normalizedIp = ip.trim() || 'unknown';
  return crypto.createHmac('sha256', env.publicIpHashSalt).update(normalizedIp).digest('hex');
};

export { hashIp };

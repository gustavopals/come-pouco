import env from '../config/env';
import { Cache } from '../utils/cache';

const publicCache = new Cache({
  maxEntries: env.publicCacheMaxEntries,
  defaultTtlSec: env.publicCacheDefaultTtlSec
});

export { publicCache };

export const LANDING_PROFILE_UPLOAD_FIELD = 'image';
export const LANDING_PROFILE_MAX_BYTES = 2 * 1024 * 1024;
export const LANDING_PROFILE_UPLOAD_SEGMENT = '/public/uploads/landing-logos/';
export const LANDING_PROFILE_FILENAME_PATTERN = /^company-\d+\.(png|jpe?g|webp|gif)$/i;

export const LANDING_PROFILE_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif'
]);

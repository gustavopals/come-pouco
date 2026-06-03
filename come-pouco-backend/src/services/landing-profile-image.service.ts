import { promises as fs } from 'fs';
import path from 'path';

import env from '../config/env';
import {
  LANDING_PROFILE_FILENAME_PATTERN,
  LANDING_PROFILE_UPLOAD_SEGMENT
} from '../constants/landing-profile-image.constants';
import type { AccessScope } from './landing-config.service';
import {
  getLandingConfig,
  updateLandingConfig,
  type LandingConfigOutput
} from './landing-config.service';
import HttpError from '../utils/httpError';

interface UploadedProfileImage {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

const extensionByMime: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

const getLandingLogosDir = (): string => path.join(env.uploads.dir, env.uploads.landingLogosSubdir);

const buildProfileFilename = (companyId: number, extension: string): string =>
  `company-${companyId}.${extension}`;

export const buildPublicProfileImageUrl = (filename: string): string =>
  `${env.publicApiUrl}${LANDING_PROFILE_UPLOAD_SEGMENT}${filename}`;

const extractManagedFilename = (logoUrl: string | null | undefined): string | null => {
  if (!logoUrl?.includes(LANDING_PROFILE_UPLOAD_SEGMENT)) {
    return null;
  }

  const filename = logoUrl.split(LANDING_PROFILE_UPLOAD_SEGMENT).pop()?.split('?')[0]?.trim();

  if (!filename || !LANDING_PROFILE_FILENAME_PATTERN.test(filename)) {
    return null;
  }

  return filename;
};

const resolveExtension = (file: UploadedProfileImage): string => {
  const fromMime = extensionByMime[file.mimetype];

  if (fromMime) {
    return fromMime;
  }

  const fromName = path.extname(file.originalname).replace('.', '').toLowerCase();

  if (fromName === 'jpeg') {
    return 'jpg';
  }

  if (['jpg', 'png', 'webp', 'gif'].includes(fromName)) {
    return fromName;
  }

  throw new HttpError(
    400,
    'Formato invalido. Use JPEG, PNG, WebP ou GIF.',
    'LANDING_PROFILE_IMAGE_INVALID_TYPE'
  );
};

const ensureLandingLogosDir = async (): Promise<void> => {
  await fs.mkdir(getLandingLogosDir(), { recursive: true });
};

const deleteManagedFile = async (logoUrl: string | null | undefined): Promise<void> => {
  const filename = extractManagedFilename(logoUrl);

  if (!filename) {
    return;
  }

  try {
    await fs.unlink(path.join(getLandingLogosDir(), filename));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code !== 'ENOENT') {
      throw error;
    }
  }
};

const uploadLandingProfileImage = async (
  companyId: number,
  file: UploadedProfileImage,
  scope: AccessScope
): Promise<LandingConfigOutput> => {
  if (!file.buffer?.length) {
    throw new HttpError(400, 'Envie uma imagem valida.', 'LANDING_PROFILE_IMAGE_MISSING');
  }

  const current = await getLandingConfig(companyId, scope);
  const extension = resolveExtension(file);
  const filename = buildProfileFilename(companyId, extension);
  const nextPath = path.join(getLandingLogosDir(), filename);
  const nextUrl = buildPublicProfileImageUrl(filename);

  await ensureLandingLogosDir();
  await fs.writeFile(nextPath, file.buffer);

  try {
    return await updateLandingConfig(companyId, { logoUrl: nextUrl }, scope);
  } catch (error) {
    await fs.unlink(nextPath).catch(() => undefined);
    throw error;
  } finally {
    const previousFilename = extractManagedFilename(current.landingConfig.logoUrl);

    if (previousFilename && previousFilename !== filename) {
      await deleteManagedFile(current.landingConfig.logoUrl);
    }
  }
};

const removeLandingProfileImage = async (
  companyId: number,
  scope: AccessScope
): Promise<LandingConfigOutput> => {
  const current = await getLandingConfig(companyId, scope);
  await deleteManagedFile(current.landingConfig.logoUrl);

  return updateLandingConfig(companyId, { logoUrl: null }, scope);
};

export { uploadLandingProfileImage, removeLandingProfileImage, extractManagedFilename };

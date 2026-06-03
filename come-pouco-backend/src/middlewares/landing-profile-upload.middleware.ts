import multer from 'multer';

import {
  LANDING_PROFILE_ALLOWED_MIME_TYPES,
  LANDING_PROFILE_MAX_BYTES,
  LANDING_PROFILE_UPLOAD_FIELD
} from '../constants/landing-profile-image.constants';
import HttpError from '../utils/httpError';

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: LANDING_PROFILE_MAX_BYTES,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    if (!LANDING_PROFILE_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(
        new HttpError(
          400,
          'Formato invalido. Use JPEG, PNG, WebP ou GIF.',
          'LANDING_PROFILE_IMAGE_INVALID_TYPE'
        )
      );
      return;
    }

    callback(null, true);
  }
});

export const landingProfileImageUploadMiddleware = upload.single(LANDING_PROFILE_UPLOAD_FIELD);

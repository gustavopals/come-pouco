import { Router } from 'express';

import * as landingConfigController from '../controllers/landing-config.controller';
import * as userController from '../controllers/user.controller';
import {
  landingConfigParamsSchema,
  updateUserPublicSlugBodySchema
} from '../schemas/landing-config.schema';
import {
  createUserBodySchema,
  updateUserBodySchema,
  userParamsSchema,
  userQuerySchema
} from '../schemas/users.schema';
import { validate } from '../utils/validate';

const userRouter = Router();

userRouter.get('/', validate({ query: userQuerySchema }), userController.listUsers);
userRouter.post('/', validate({ body: createUserBodySchema }), userController.createUser);
userRouter.put(
  '/:id/public-slug',
  validate({ params: landingConfigParamsSchema, body: updateUserPublicSlugBodySchema }),
  landingConfigController.updateUserPublicSlug
);
userRouter.put(
  '/:id',
  validate({ params: userParamsSchema, body: updateUserBodySchema }),
  userController.updateUser
);
userRouter.delete('/:id', validate({ params: userParamsSchema }), userController.deleteUser);

export default userRouter;

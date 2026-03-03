import { Router } from 'express';

import * as userController from '../controllers/user.controller';

const userRouter = Router();

userRouter.get('/', userController.listUsers);
userRouter.post('/', userController.createUser);
userRouter.post('/employees', userController.createEmployee);
userRouter.put('/:id', userController.updateUser);
userRouter.delete('/:id', userController.deleteUser);

export default userRouter;

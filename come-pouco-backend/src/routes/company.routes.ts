import { Router } from 'express';

import * as companyController from '../controllers/company.controller';

const companyRouter = Router();

companyRouter.get('/', companyController.listCompanies);
companyRouter.post('/', companyController.createCompany);
companyRouter.put('/:id', companyController.updateCompany);

export default companyRouter;

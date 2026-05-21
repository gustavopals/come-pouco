import { NextFunction, Request, Response } from 'express';

import type { AuditLogQuery } from '../schemas/admin.schema';
import * as auditService from '../services/audit.service';

const listAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { eventType, userId, startDate, endDate, page, limit } =
      req.query as unknown as AuditLogQuery;

    const result = await auditService.listAuditLogs({
      eventType,
      userId,
      startDate,
      endDate,
      pagination: {
        page,
        limit
      }
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export { listAuditLogs };

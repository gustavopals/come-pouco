import { NextFunction, Request, Response } from 'express';

import { AUDIT_EVENTS } from '../constants/audit-events';
import type {
  CreateIncidentBody,
  IncidentQuery,
  UpdateIncidentBody
} from '../schemas/admin.schema';
import * as auditService from '../services/audit.service';
import * as incidentService from '../services/incident.service';

const getStatus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json(await incidentService.getAdminStatus());
  } catch (error) {
    next(error);
  }
};

const listIncidents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, severity, component, startDate, endDate, page, limit } =
      req.query as unknown as IncidentQuery;
    const result = await incidentService.listIncidents({
      status,
      severity,
      component,
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

const getIncident = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.status(200).json({ incident: await incidentService.getIncident(req.params.id) });
  } catch (error) {
    next(error);
  }
};

const createIncident = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const incident = await incidentService.createIncident(req.body as CreateIncidentBody);
    auditService.logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_INCIDENT_CREATE,
      entityType: 'Incident',
      entityId: incident.id,
      metadata: {
        status: incident.status,
        severity: incident.severity,
        affectedComponents: incident.affectedComponents
      }
    });

    res.status(201).json({ incident });
  } catch (error) {
    next(error);
  }
};

const updateIncident = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const incident = await incidentService.updateIncident(
      req.params.id,
      req.body as UpdateIncidentBody
    );
    auditService.logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_INCIDENT_UPDATE,
      entityType: 'Incident',
      entityId: incident.id,
      metadata: {
        status: incident.status,
        severity: incident.severity,
        affectedComponents: incident.affectedComponents
      }
    });

    res.status(200).json({ incident });
  } catch (error) {
    next(error);
  }
};

const deleteIncident = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await incidentService.deleteIncident(req.params.id);
    auditService.logEventFromRequest(req, {
      eventType: AUDIT_EVENTS.ADMIN_INCIDENT_DELETE,
      entityType: 'Incident',
      entityId: req.params.id
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export { createIncident, deleteIncident, getIncident, getStatus, listIncidents, updateIncident };

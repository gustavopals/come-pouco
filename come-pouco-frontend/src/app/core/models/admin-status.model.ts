import { PaginatedResponse } from './pagination.model';

export type HealthStatus = 'ok' | 'degraded' | 'down';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'investigating' | 'identified' | 'resolved';
export type IncidentComponentKey = 'backend' | 'database' | 'shopee' | 'email' | 'cache';

export interface StatusComponent {
  key: IncidentComponentKey;
  label: string;
  status: HealthStatus;
  latencyMs?: number;
  message?: string;
  activeIncidentCount: number;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedComponents: IncidentComponentKey[];
  startedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentTimelineItem {
  date: string;
  incidentCount: number;
  activeIncidentCount: number;
  highestSeverity: IncidentSeverity | null;
}

export interface AdminStatusResponse {
  generatedAt: string;
  overallStatus: HealthStatus;
  components: StatusComponent[];
  timeline: IncidentTimelineItem[];
  incidents: Incident[];
  activeIncidents: Incident[];
}

export interface CreateIncidentPayload {
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affectedComponents: IncidentComponentKey[];
  startedAt?: string;
  resolvedAt?: string;
}

export type UpdateIncidentPayload = Partial<CreateIncidentPayload>;

export interface IncidentListResponse extends PaginatedResponse<Incident> {
  incidents: Incident[];
}

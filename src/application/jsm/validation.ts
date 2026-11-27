import { integer, object, text, utc, uuid } from '../../domain/inventory/model';
import type { TenantContext } from '../ports/tenant-context';
import {
  JsmError,
  type JsmConfiguration,
  type JsmIncident,
  type JsmRequest,
} from './contracts';
export function bound(
  ctx: TenantContext,
  value: { installationId: string; tenantId: string },
): void {
  if (
    value.installationId !== ctx.installationId ||
    value.tenantId !== ctx.tenantId
  )
    throw new JsmError('DENIED');
}
export function identifier(input: unknown): string {
  if (typeof input !== 'string' || !/^[1-9][0-9]{0,19}$/.test(input))
    throw new JsmError('INVALID');
  return input;
}
export function configuration(
  ctx: TenantContext,
  input: unknown,
): JsmConfiguration {
  try {
    const v = object(input);
    const fields = object(v.fields);
    const priority = object(v.priorityIds);
    const field = (value: unknown) => {
      const id = text(value, 40);
      if (!/^customfield_[1-9][0-9]{0,19}$/.test(id))
        throw new JsmError('INVALID');
      return id;
    };
    const result: JsmConfiguration = {
      installationId: text(v.installationId, 255),
      tenantId: uuid(v.tenantId),
      version: integer(v.version),
      projectId: identifier(v.projectId),
      serviceDeskId: identifier(v.serviceDeskId),
      requestTypeId: identifier(v.requestTypeId),
      fields: {
        marker: field(fields.marker),
        deadline: field(fields.deadline),
        warning: field(fields.warning),
        policy: field(fields.policy),
      },
      priorityIds: {
        P1: identifier(priority.P1),
        P2: identifier(priority.P2),
        P3: identifier(priority.P3),
      },
    };
    bound(ctx, result);
    if (new Set(Object.values(result.fields)).size !== 4)
      throw new JsmError('INVALID');
    return result;
  } catch (error) {
    if (error instanceof JsmError) throw error;
    throw new JsmError('INVALID');
  }
}
export function request(
  config: JsmConfiguration,
  incident: JsmIncident,
  marker: string,
): JsmRequest {
  try {
    if (!/^light-house-[0-9a-f-]{36}$/.test(marker))
      throw new JsmError('INVALID');
    uuid(incident.id);
    uuid(incident.policyVersionId);
    const warning = utc(incident.warningAt);
    const deadline = utc(incident.deadlineAt);
    if (warning >= deadline || !['P1', 'P2', 'P3'].includes(incident.priority))
      throw new JsmError('INVALID');
    return {
      serviceDeskId: config.serviceDeskId,
      requestTypeId: config.requestTypeId,
      requestFieldValues: {
        summary: text(incident.summary, 200),
        description: text(incident.description, 4000),
        priority: { id: config.priorityIds[incident.priority] },
        [config.fields.marker]: marker,
        [config.fields.deadline]: deadline,
        [config.fields.warning]: warning,
        [config.fields.policy]: incident.policyVersionId,
      },
    };
  } catch {
    throw new JsmError('INVALID');
  }
}

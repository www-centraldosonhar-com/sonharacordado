import {
  sql,
} from './_admin.js'

// =========================================================
// ADMIN AUDIT
// =========================================================
// Registra ações administrativas relevantes.
//
// IMPORTANTE:
// projectId deve representar o projeto do objeto alterado,
// e não necessariamente o projeto cadastrado do Admin.
// =========================================================

export async function logAdminAction({
  admin,
  action,
  entityType,
  entityId = null,
  projectId = null,
  eventId = null,
  details = {},
}) {
  if (
    !admin?.id ||
    !action ||
    !entityType
  ) {
    return
  }

  await sql`
    INSERT INTO admin_audit_logs (
      actor_user_id,
      action,
      entity_type,
      entity_id,
      project_id,
      event_id,
      details
    )
    VALUES (
      ${admin.id},
      ${action},
      ${entityType},
      ${entityId},
      ${projectId},
      ${eventId},
      ${JSON.stringify(details)}::jsonb
    )
  `
}

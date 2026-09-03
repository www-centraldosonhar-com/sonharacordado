import {
  logAdminAction,
} from './_admin-audit.js'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import {
  adminCanManageRegistration,
  isGlobalAdmin,
  isProjectAdmin,
  requireAdmin,
  sql,
} from './_admin.js'

const RECEIPT_BUCKET =
  process.env.REGISTRATION_RECEIPTS_BUCKET ||
  'sonhar-receipts'

async function getRegistrationAuditContext(
  registrationId
) {
  const rows = await sql`
    SELECT
      er.id,
      er.event_id,
      er.user_id,
      er.status,
      er.team,
      er.email,

      e.project_id,
      e.name AS event_name,
      e.event_date,
      e.paired_registration_event_id,

      u.name AS user_name

    FROM event_registrations er

    JOIN events e
      ON e.id = er.event_id

    JOIN users u
      ON u.id = er.user_id

    WHERE er.id =
      ${registrationId}

    LIMIT 1
  `

  return rows[0] || null
}


async function syncPairedRegistrationOnApproval({
  sourceRegistrationId,
  context,
  adminId,
}) {
  const pairedEventId =
    Number(context?.paired_registration_event_id)

  if (!Number.isInteger(pairedEventId)) {
    return null
  }

  const pairedRows = await sql`
    SELECT
      id,
      name,
      event_type,
      project_id,
      event_date,
      active
    FROM events
    WHERE id = ${pairedEventId}
    LIMIT 1
  `

  const pairedEvent = pairedRows[0]

  if (
    !pairedEvent ||
    Number(pairedEvent.active) !== 1 ||
    pairedEvent.event_type !== 'general' ||
    pairedEvent.project_id !== null ||
    String(pairedEvent.event_date).slice(0, 10) !==
      String(context.event_date).slice(0, 10)
  ) {
    throw new Error(
      'O evento complementar vinculado não está válido para inscrição dupla.'
    )
  }

  const existingRows = await sql`
    SELECT
      id,
      paired_from_registration_id
    FROM event_registrations
    WHERE event_id = ${pairedEvent.id}
      AND user_id = ${context.user_id}
    LIMIT 1
  `

  const existing = existingRows[0]

  if (
    existing &&
    existing.paired_from_registration_id === null
  ) {
    return {
      eventId: pairedEvent.id,
      eventName: pairedEvent.name,
      reusedExisting: true,
    }
  }

  if (existing) {
    await sql`
      UPDATE event_registrations
      SET
        email = ${context.email},
        team = ${context.team},
        status = 'confirmed',
        payment_receipt_path = NULL,
        coupon_id = NULL,
        rejection_reason = NULL,
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = ${adminId},
        paired_from_registration_id = ${sourceRegistrationId},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${existing.id}
    `
  } else {
    await sql`
      INSERT INTO event_registrations (
        event_id,
        user_id,
        email,
        team,
        status,
        payment_receipt_path,
        coupon_id,
        paired_from_registration_id,
        reviewed_at,
        reviewed_by
      )
      VALUES (
        ${pairedEvent.id},
        ${context.user_id},
        ${context.email},
        ${context.team},
        'confirmed',
        NULL,
        NULL,
        ${sourceRegistrationId},
        CURRENT_TIMESTAMP,
        ${adminId}
      )
    `
  }

  return {
    eventId: pairedEvent.id,
    eventName: pairedEvent.name,
    reusedExisting: false,
  }
}

async function syncPairedRegistrationStatus({
  sourceRegistrationId,
  status,
  reason = null,
  adminId,
}) {
  await sql`
    UPDATE event_registrations
    SET
      status = ${status},
      rejection_reason = ${reason},
      reviewed_at = CURRENT_TIMESTAMP,
      reviewed_by = ${adminId},
      updated_at = CURRENT_TIMESTAMP
    WHERE paired_from_registration_id =
      ${sourceRegistrationId}
  `
}


function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

export default async function handler(
  request,
  response
) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Método não permitido.',
    })
  }

  const admin =
    await requireAdmin(request)

  if (!admin) {
    return response.status(403).json({
      error:
        'Acesso administrativo não autorizado.',
    })
  }

  const {
    operation,
    registrationId,
    couponId,
    reason,
  } = request.body ?? {}

  try {
    const registrationOperations = [
      'receipt-url',
      'approve',
      'reject',
      'cancel',
    ]

    if (
      registrationOperations.includes(
        operation
      )
    ) {
      const allowed =
        await adminCanManageRegistration(
          admin,
          registrationId
        )

      if (!allowed) {
        return response.status(403).json({
          error:
            'Você não possui acesso a essa inscrição.',
        })
      }
    }

    const registrationContext =
      registrationOperations.includes(
        operation
      )
        ? await getRegistrationAuditContext(
            registrationId
          )
        : null


    if (
      operation === 'receipt-url'
    ) {
      const rows = await sql`
        SELECT payment_receipt_path
        FROM event_registrations
        WHERE id = ${registrationId}
        LIMIT 1
      `

      const path =
        rows[0]?.payment_receipt_path

      if (!path) {
        return response.status(404).json({
          error:
            'Comprovante não encontrado.',
        })
      }

      const supabase =
        getSupabaseAdmin()

      const {
        data,
        error,
      } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .createSignedUrl(
          path,
          300
        )

      if (error) {
        throw error
      }

      await logAdminAction({
        admin,
        action:
          'registration_receipt_viewed',
        entityType:
          'event_registration',
        entityId:
          Number(registrationId),
        projectId:
          registrationContext?.project_id ||
          null,
        eventId:
          registrationContext?.event_id ||
          null,
        details: {
          userName:
            registrationContext?.user_name,
          eventName:
            registrationContext?.event_name,
        },
      })

      return response.status(200).json({
        success: true,
        url: data.signedUrl,
      })
    }

    if (
      operation === 'approve'
    ) {
      const updated = await sql`
        UPDATE event_registrations
        SET
          status = 'confirmed',
          rejection_reason = NULL,
          reviewed_at =
            CURRENT_TIMESTAMP,
          reviewed_by = ${admin.id},
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ${registrationId}
          AND status IN (
            'pending_payment_review',
            'pending_coupon_review',
            'payment_rejected'
          )
        RETURNING id
      `

      if (!updated[0]) {
        return response.status(404).json({
          error:
            'Inscrição não encontrada ou já processada.',
        })
      }

      const pairedRegistration =
        await syncPairedRegistrationOnApproval({
          sourceRegistrationId:
            Number(registrationId),
          context: registrationContext,
          adminId: admin.id,
        })

      await logAdminAction({
        admin,
        action:
          'registration_approved',
        entityType:
          'event_registration',
        entityId:
          Number(registrationId),
        projectId:
          registrationContext?.project_id ||
          null,
        eventId:
          registrationContext?.event_id ||
          null,
        details: {
          userName:
            registrationContext?.user_name,
          eventName:
            registrationContext?.event_name,
          team:
            registrationContext?.team,
        },
      })

      return response.status(200).json({
        success: true,
        message:
          pairedRegistration
            ? `Inscrições confirmadas em ${registrationContext?.event_name} + ${pairedRegistration.eventName}! 🎟️✅`
            : 'Inscrição confirmada! 🎟️✅',
      })
    }

    if (
      operation === 'reject'
    ) {
      const cleanReason =
        typeof reason === 'string'
          ? reason.trim()
          : ''

      if (!cleanReason) {
        return response.status(400).json({
          error:
            'Informe o motivo da rejeição.',
        })
      }

      const updated = await sql`
        UPDATE event_registrations
        SET
          status =
            'payment_rejected',
          rejection_reason =
            ${cleanReason},
          reviewed_at =
            CURRENT_TIMESTAMP,
          reviewed_by =
            ${admin.id},
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id =
          ${registrationId}
        RETURNING id
      `

      if (!updated[0]) {
        return response.status(404).json({
          error:
            'Inscrição não encontrada.',
        })
      }

      await syncPairedRegistrationStatus({
        sourceRegistrationId:
          Number(registrationId),
        status: 'payment_rejected',
        reason: cleanReason,
        adminId: admin.id,
      })

      await logAdminAction({
        admin,
        action:
          'registration_rejected',
        entityType:
          'event_registration',
        entityId:
          Number(registrationId),
        projectId:
          registrationContext?.project_id ||
          null,
        eventId:
          registrationContext?.event_id ||
          null,
        details: {
          userName:
            registrationContext?.user_name,
          eventName:
            registrationContext?.event_name,
          reason:
            cleanReason,
        },
      })

      return response.status(200).json({
        success: true,
        message:
          'Inscrição devolvida para correção.',
      })
    }

    if (
      operation === 'cancel'
    ) {
      const updated = await sql`
        UPDATE event_registrations
        SET
          status = 'cancelled',
          reviewed_at =
            CURRENT_TIMESTAMP,
          reviewed_by =
            ${admin.id},
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id =
          ${registrationId}
        RETURNING id
      `

      if (!updated[0]) {
        return response.status(404).json({
          error:
            'Inscrição não encontrada.',
        })
      }

      await syncPairedRegistrationStatus({
        sourceRegistrationId:
          Number(registrationId),
        status: 'cancelled',
        adminId: admin.id,
      })

      await logAdminAction({
        admin,
        action:
          'registration_cancelled',
        entityType:
          'event_registration',
        entityId:
          Number(registrationId),
        projectId:
          registrationContext?.project_id ||
          null,
        eventId:
          registrationContext?.event_id ||
          null,
        details: {
          userName:
            registrationContext?.user_name,
          eventName:
            registrationContext?.event_name,
        },
      })

      return response.status(200).json({
        success: true,
        message:
          'Inscrição cancelada.',
      })
    }

    if (
      operation === 'toggle-coupon'
    ) {
      if (
        !isGlobalAdmin(admin) &&
        !isProjectAdmin(admin)
      ) {
        return response.status(403).json({
          error:
            'Você não possui permissão para administrar cupons.',
        })
      }

      const numericCouponId =
        Number(couponId)

      if (
        !Number.isInteger(
          numericCouponId
        )
      ) {
        return response.status(400).json({
          error:
            'Cupom inválido.',
        })
      }

      const updated = await sql`
        UPDATE registration_coupons

        SET active =
          CASE
            WHEN active = 1 THEN 0
            ELSE 1
          END

        WHERE
          id =
            ${numericCouponId}

          AND (
            ${isGlobalAdmin(admin)}

            OR project_id =
              ${admin.projectId}
          )

        RETURNING
          active,
          project_id
      `

      if (!updated[0]) {
        return response.status(404).json({
          error:
            'Cupom não encontrado ou fora do seu projeto.',
        })
      }

      return response.status(200).json({
        success: true,

        message:
          Number(updated[0].active) === 1
            ? 'Cupom ativado! 🎟️'
            : 'Cupom desativado.',
      })
    }

    return response.status(400).json({
      error:
        'Operação administrativa desconhecida.',
    })
  } catch (error) {
    console.error(
      'Admin registration error:',
      error
    )

    return response.status(500).json({
      error:
        error?.message ||
        'Não foi possível concluir.',
    })
  }
}

import crypto from 'node:crypto'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { neon } from '@neondatabase/serverless'
import { getSessionUser } from './_session.js'

const sql = neon(process.env.DATABASE_URL)

const TEAMS = new Set([
  'activities',
  'assisted',
  'media',
  'food',
  'volunteers',
  'administration',
])

const RECEIPT_BUCKET =
  process.env.REGISTRATION_RECEIPTS_BUCKET ||
  'sonhar-receipts'

const ALLOWED_RECEIPT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase Storage não configurado.'
    )
  }

  return createClient(
    url,
    key,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

async function ensurePrivateBucket(
  supabase
) {
  const {
    data,
    error,
  } = await supabase.storage
    .getBucket(RECEIPT_BUCKET)

  if (!error && data) {
    return
  }

  const {
    error: createError,
  } = await supabase.storage
    .createBucket(
      RECEIPT_BUCKET,
      {
        public: false,
        fileSizeLimit:
          8 * 1024 * 1024,
      }
    )

  if (
    createError &&
    !String(
      createError.message || ''
    )
      .toLowerCase()
      .includes('already')
  ) {
    throw createError
  }
}

async function getEvent(
  eventId
) {
  const rows = await sql`
    SELECT
      id,
      name,
      project_id,
      paired_registration_event_id,
      active,
      registration_fee,
      registration_deadline,
      registrations_open,
      event_date::text AS event_date
    FROM events
    WHERE id = ${eventId}
    LIMIT 1
  `

  return rows[0]
}

async function getPairedRegistrationEvent(event) {
  const pairedEventId =
    Number(event?.paired_registration_event_id)

  if (!Number.isInteger(pairedEventId)) {
    return null
  }

  const rows = await sql`
    SELECT
      id,
      name,
      event_type,
      project_id,
      event_date::text AS event_date,
      active
    FROM events
    WHERE id = ${pairedEventId}
    LIMIT 1
  `

  return rows[0] || null
}

async function syncConfirmedPairedRegistration({
  sourceRegistrationId,
  sourceEvent,
  userId,
  email,
  team,
}) {
  const pairedEvent =
    await getPairedRegistrationEvent(
      sourceEvent
    )

  if (!pairedEvent) {
    return null
  }

  if (
    Number(pairedEvent.active) !== 1 ||
    pairedEvent.event_type !== 'general' ||
    pairedEvent.project_id !== null ||
    String(pairedEvent.event_date).slice(0, 10) !==
      String(sourceEvent.event_date).slice(0, 10)
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
      AND user_id = ${userId}
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
        email = ${email},
        team = ${team},
        status = 'confirmed',
        payment_receipt_path = NULL,
        coupon_id = NULL,
        rejection_reason = NULL,
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = NULL,
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
        reviewed_at
      )
      VALUES (
        ${pairedEvent.id},
        ${userId},
        ${email},
        ${team},
        'confirmed',
        NULL,
        NULL,
        ${sourceRegistrationId},
        CURRENT_TIMESTAMP
      )
    `
  }

  return {
    eventId: pairedEvent.id,
    eventName: pairedEvent.name,
    reusedExisting: false,
  }
}


async function canRegisterWithoutTeam(userId) {
  const rows = await sql`
    SELECT up.admin_scope
    FROM user_permissions up
    WHERE
      up.user_id = ${userId}
      AND up.permission = 'admin'
      AND up.active = 1
      AND up.admin_scope IN (
        'global',
        'project'
      )
    LIMIT 1
  `

  return Boolean(rows[0])
}

function registrationIsOpen(event) {
  if (
    !event ||
    Number(event.active) !== 1 ||
    Number(event.registrations_open) !== 1
  ) {
    return false
  }

  if (!event.registration_deadline) {
    return false
  }

  return (
    new Date(
      event.registration_deadline
    ) >= new Date()
  )
}

function cleanEmail(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase()
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email)
}

function normalizeCoupon(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .trim()
    .toUpperCase()
}

function extensionForType(type) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }

  return map[type]
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

  const sessionUser =
    await getSessionUser(request)

  if (!sessionUser?.userId) {
    return response.status(401).json({
      error:
        'Sessão inválida ou expirada.',
    })
  }

  const {
    operation,
    eventId,
    email,
    team,
    couponCode,
    contentType,
    storagePath,
  } = request.body ?? {}

  const numericEventId =
    Number(eventId)

  if (
    !Number.isInteger(numericEventId) ||
    numericEventId < 1
  ) {
    return response.status(400).json({
      error: 'Evento inválido.',
    })
  }

  try {
    const event =
      await getEvent(numericEventId)

    if (!event) {
      return response.status(404).json({
        error: 'Evento não encontrado.',
      })
    }

    // ===============================================
    // PREPARE RECEIPT
    // ===============================================

    if (operation === 'prepare-receipt') {
      if (!registrationIsOpen(event)) {
        return response.status(400).json({
          error:
            'As inscrições deste evento estão encerradas.',
        })
      }

      if (
        !ALLOWED_RECEIPT_TYPES
          .has(contentType)
      ) {
        return response.status(400).json({
          error:
            'Use JPG, PNG, WebP ou PDF.',
        })
      }

      const supabase =
        getSupabaseAdmin()

      await ensurePrivateBucket(
        supabase
      )

      const extension =
        extensionForType(contentType)

      const path =
        `event-${numericEventId}/user-${sessionUser.userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`

      const {
        data,
        error,
      } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .createSignedUploadUrl(
          path,
          {
            upsert: false,
          }
        )

      if (error) {
        throw error
      }

      return response.status(200).json({
        success: true,
        storagePath: path,
        signedUrl:
          data.signedUrl,
      })
    }

    // ===============================================
    // DISCARD RECEIPT
    // ===============================================
    //
    // Remove um upload que foi concluído no Storage,
    // mas cuja inscrição falhou antes de ser gravada.
    //
    // Segurança:
    // - somente o próprio usuário;
    // - somente o evento informado;
    // - nunca remove um arquivo já ligado a uma inscrição.
    // ===============================================

    if (operation === 'discard-receipt') {
      if (
        typeof storagePath !== 'string' ||
        !storagePath.startsWith(
          `event-${numericEventId}/user-${sessionUser.userId}/`
        )
      ) {
        return response.status(400).json({
          error:
            'Comprovante inválido.',
        })
      }

      const linkedRows =
        await sql`
          SELECT id
          FROM event_registrations
          WHERE
            event_id =
              ${numericEventId}

            AND user_id =
              ${sessionUser.userId}

            AND payment_receipt_path =
              ${storagePath}

          LIMIT 1
        `

      // Se o arquivo já está ligado a uma inscrição,
      // não pode ser apagado pelo cleanup.
      if (linkedRows[0]) {
        return response.status(200).json({
          success: true,
          discarded: false,
        })
      }

      const supabase =
        getSupabaseAdmin()

      const {
        error: removeError,
      } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .remove([
          storagePath,
        ])

      if (removeError) {
        throw removeError
      }

      return response.status(200).json({
        success: true,
        discarded: true,
      })
    }


    // ===============================================
    // SUBMIT REGISTRATION
    // ===============================================

    if (operation === 'submit') {
      if (!registrationIsOpen(event)) {
        return response.status(400).json({
          error:
            'As inscrições deste evento estão encerradas.',
        })
      }

      const cleanRegistrationEmail =
        cleanEmail(email)

      const administrationRegistration =
        team === 'administration'

      const administrationAllowed =
        administrationRegistration
          ? await canRegisterWithoutTeam(
              sessionUser.userId
            )
          : false

      if (
        !validEmail(
          cleanRegistrationEmail
        ) ||
        !TEAMS.has(team) ||
        (
          administrationRegistration &&
          !administrationAllowed
        )
      ) {
        return response.status(400).json({
          error:
            'Preencha corretamente e-mail e participação no evento.',
        })
      }

      const existingRows = await sql`
        SELECT
          id,
          status
        FROM event_registrations
        WHERE event_id = ${numericEventId}
          AND user_id = ${sessionUser.userId}
        LIMIT 1
      `

      const existing =
        existingRows[0]

      if (
        existing?.status === 'confirmed'
      ) {
        return response.status(409).json({
          error:
            'Sua inscrição já está confirmada.',
        })
      }

      if (
        existing?.status === 'cancelled'
      ) {
        return response.status(409).json({
          error:
            'Essa inscrição foi cancelada. Fale com a direção.',
        })
      }

      const freeEvent =
        Number(
          event.registration_fee || 0
        ) <= 0

      const coupon =
        freeEvent
          ? ''
          : normalizeCoupon(couponCode)

      let couponId = null
      let status =
        freeEvent
          ? 'confirmed'
          : 'pending_payment_review'

      if (coupon) {
        const coupons = await sql`
          SELECT
            id,
            usage_limit,
            project_id,
            active
          FROM registration_coupons
          WHERE
            UPPER(code) =
              ${coupon}

            AND (
              project_id IS NULL

              OR project_id =
                ${event.project_id}
            )

          LIMIT 1
        `

        const foundCoupon =
          coupons[0]

        if (
          !foundCoupon ||
          Number(foundCoupon.active) !== 1
        ) {
          return response.status(400).json({
            error:
              'Cupom inválido ou inativo.',
          })
        }

        const uses = await sql`
          SELECT COUNT(*)::int AS total
          FROM event_registrations
          WHERE coupon_id =
            ${foundCoupon.id}
            AND status IN (
              'pending_coupon_review',
              'confirmed'
            )
            AND NOT (
              event_id = ${numericEventId}
              AND user_id =
                ${sessionUser.userId}
            )
        `

        if (
          Number(uses[0]?.total || 0) >=
          Number(
            foundCoupon.usage_limit
          )
        ) {
          return response.status(409).json({
            error:
              'Esse cupom atingiu o limite de usos.',
          })
        }

        couponId =
          foundCoupon.id

        status =
          'pending_coupon_review'
      } else if (!freeEvent) {
        if (
          typeof storagePath !== 'string' ||
          !storagePath.startsWith(
            `event-${numericEventId}/user-${sessionUser.userId}/`
          )
        ) {
          return response.status(400).json({
            error:
              'Envie o comprovante do PIX.',
          })
        }
      }

      let savedRegistrationId

      if (existing) {
        const updatedRows = await sql`
          UPDATE event_registrations
          SET
            email =
              ${cleanRegistrationEmail},
            team = ${team},
            status = ${status},
            payment_receipt_path =
              ${
                freeEvent || coupon
                  ? null
                  : storagePath
              },
            coupon_id =
              ${couponId},
            rejection_reason = NULL,
            reviewed_at = NULL,
            reviewed_by = NULL,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = ${existing.id}
          RETURNING id
        `

        savedRegistrationId =
          Number(updatedRows[0]?.id)
      } else {
        const insertedRows = await sql`
          INSERT INTO event_registrations (
            event_id,
            user_id,
            email,
            team,
            status,
            payment_receipt_path,
            coupon_id
          )
          VALUES (
            ${numericEventId},
            ${sessionUser.userId},
            ${cleanRegistrationEmail},
            ${team},
            ${status},
            ${
              freeEvent || coupon
                ? null
                : storagePath
            },
            ${couponId}
          )
          RETURNING id
        `

        savedRegistrationId =
          Number(insertedRows[0]?.id)
      }

      let pairedRegistration = null

      if (
        freeEvent &&
        Number.isInteger(savedRegistrationId)
      ) {
        pairedRegistration =
          await syncConfirmedPairedRegistration({
            sourceRegistrationId:
              savedRegistrationId,
            sourceEvent: event,
            userId: sessionUser.userId,
            email: cleanRegistrationEmail,
            team,
          })
      }

      return response.status(200).json({
        success: true,
        pairedRegistration,
        message:
          freeEvent
            ? pairedRegistration
              ? `Inscrições confirmadas em ${event.name} + ${pairedRegistration.eventName}! ❤️`
              : 'Inscrição confirmada! Este evento é gratuito. ❤️'
            : coupon
              ? 'Cupom enviado para aprovação! 🎟️'
              : 'Comprovante enviado para conferência! 💙',
      })
    }

    return response.status(400).json({
      error:
        'Operação de inscrição desconhecida.',
    })
  } catch (error) {
    console.error(
      'Registration error:',
      error
    )

    return response.status(500).json({
      error:
        error?.message ||
        'Não foi possível concluir sua inscrição.',
    })
  }
}

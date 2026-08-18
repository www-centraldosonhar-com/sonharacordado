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
  'kitchen',
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
      active,
      registration_fee,
      registration_deadline,
      registrations_open
    FROM events
    WHERE id = ${eventId}
    LIMIT 1
  `

  return rows[0]
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

      if (
        !validEmail(
          cleanRegistrationEmail
        ) ||
        !TEAMS.has(team)
      ) {
        return response.status(400).json({
          error:
            'Preencha corretamente e-mail e equipe.',
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

      const coupon =
        normalizeCoupon(couponCode)

      let couponId = null
      let status =
        'pending_payment_review'

      if (coupon) {
        const coupons = await sql`
          SELECT
            id,
            usage_limit,
            active
          FROM registration_coupons
          WHERE UPPER(code) = ${coupon}
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
      } else {
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

      if (existing) {
        await sql`
          UPDATE event_registrations
          SET
            email =
              ${cleanRegistrationEmail},
            team = ${team},
            status = ${status},
            payment_receipt_path =
              ${
                coupon
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
            coupon_id
          )
          VALUES (
            ${numericEventId},
            ${sessionUser.userId},
            ${cleanRegistrationEmail},
            ${team},
            ${status},
            ${
              coupon
                ? null
                : storagePath
            },
            ${couponId}
          )
        `
      }

      return response.status(200).json({
        success: true,
        message:
          coupon
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

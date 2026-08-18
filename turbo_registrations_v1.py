from pathlib import Path


# =========================================================
# HELPERS
# =========================================================

def replace_once(path, old, new, label):
    file = Path(path)
    text = file.read_text()

    if old not in text:
        raise SystemExit(
            f"❌ {label}: trecho não encontrado em {path}"
        )

    text = text.replace(old, new, 1)
    file.write_text(text)

    print(f"✅ {label}")


# =========================================================
# 1. TEAMS
# =========================================================

Path("src/constants").mkdir(
    parents=True,
    exist_ok=True
)

Path(
    "src/constants/registrationTeams.js"
).write_text("""export const REGISTRATION_TEAMS = [
  {
    value: 'activities',
    label: 'Equipe de Atividades',
  },
  {
    value: 'assisted',
    label: 'Equipe de Assistidos',
  },
  {
    value: 'media',
    label: 'Equipe de Mídias',
  },
  {
    value: 'kitchen',
    label: 'Equipe de Cozinha',
  },
]

export function getTeamLabel(value) {
  return (
    REGISTRATION_TEAMS.find(
      (team) => team.value === value
    )?.label || value
  )
}
""")

print("✅ Equipes criadas.")


# =========================================================
# 2. VOLUNTEER REGISTRATION BACKEND
# =========================================================

Path(
    "server/actions/registration.js"
).write_text("""import crypto from 'node:crypto'
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
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
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
""")

print("✅ Backend do voluntário criado.")


# =========================================================
# 3. ADMIN REGISTRATION BACKEND
# =========================================================

Path(
    "server/actions/admin-registration.js"
).write_text("""import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, sql } from './_admin.js'

const RECEIPT_BUCKET =
  process.env.REGISTRATION_RECEIPTS_BUCKET ||
  'sonhar-receipts'

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

      return response.status(200).json({
        success: true,
        message:
          'Inscrição confirmada! 🎟️✅',
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

      return response.status(200).json({
        success: true,
        message:
          'Inscrição cancelada.',
      })
    }

    if (
      operation === 'toggle-coupon'
    ) {
      const updated = await sql`
        UPDATE registration_coupons
        SET active =
          CASE
            WHEN active = 1 THEN 0
            ELSE 1
          END
        WHERE id = ${couponId}
        RETURNING active
      `

      if (!updated[0]) {
        return response.status(404).json({
          error:
            'Cupom não encontrado.',
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
""")

print("✅ Backend administrativo criado.")


# =========================================================
# 4. API ROUTERS
# =========================================================

replace_once(
    "api/volunteer.js",
    """import completePhotoDeliveryHandler from '../server/actions/complete-photo-delivery.js'
""",
    """import completePhotoDeliveryHandler from '../server/actions/complete-photo-delivery.js'
import registrationHandler from '../server/actions/registration.js'
""",
    "Import registration no volunteer router"
)

replace_once(
    "api/volunteer.js",
    """  if (action === 'complete-photo-delivery') {
    return completePhotoDeliveryHandler(
      request,
      response
    )
  }

  return response.status(404).json({
""",
    """  if (action === 'complete-photo-delivery') {
    return completePhotoDeliveryHandler(
      request,
      response
    )
  }

  if (action === 'registration') {
    return registrationHandler(
      request,
      response
    )
  }

  return response.status(404).json({
""",
    "Route registration"
)


replace_once(
    "api/admin.js",
    """import adminUpdateHandler from '../server/actions/admin-update.js'
""",
    """import adminUpdateHandler from '../server/actions/admin-update.js'
import adminRegistrationHandler from '../server/actions/admin-registration.js'
""",
    "Import admin registration"
)

replace_once(
    "api/admin.js",
    """  if (action === 'update') {
    return adminUpdateHandler(request, response)
  }

  return response.status(404).json({
""",
    """  if (action === 'update') {
    return adminUpdateHandler(request, response)
  }

  if (action === 'registrations') {
    return adminRegistrationHandler(
      request,
      response
    )
  }

  return response.status(404).json({
""",
    "Route admin registrations"
)


# =========================================================
# 5. ADMIN CREATE — EVENT REGISTRATION FIELDS
# =========================================================

replace_once(
    "server/actions/admin-create.js",
    """        confirmationDeadline,
        symplaLink,
        driveLink,
      } = data
""",
    """        confirmationDeadline,
        registrationFee,
        registrationDeadline,
        symplaLink,
        driveLink,
      } = data
""",
    "Event registration inputs"
)

replace_once(
    "server/actions/admin-create.js",
    """        !location?.trim() ||
        !confirmationDeadline
""",
    """        !location?.trim() ||
        !confirmationDeadline ||
        !registrationDeadline ||
        Number.isNaN(
          Number(registrationFee)
        ) ||
        Number(registrationFee) < 0
""",
    "Event registration validation"
)

replace_once(
    "server/actions/admin-create.js",
    """          confirmation_deadline,
          sympla_link,
          drive_link,
          active
""",
    """          confirmation_deadline,
          registration_fee,
          registration_deadline,
          registrations_open,
          sympla_link,
          drive_link,
          active
""",
    "Event insert fields"
)

replace_once(
    "server/actions/admin-create.js",
    """          ${confirmationDeadline},
          ${symplaLink?.trim() || null},
          ${driveLink?.trim() || null},
          1
""",
    """          ${confirmationDeadline},
          ${Number(registrationFee)},
          ${registrationDeadline},
          1,
          ${symplaLink?.trim() || null},
          ${driveLink?.trim() || null},
          1
""",
    "Event insert registration values"
)


# =========================================================
# 6. ADMIN CREATE — COUPON
# =========================================================

replace_once(
    "server/actions/admin-create.js",
    """    if (action === 'event') {
""",
    """    if (action === 'coupon') {
      const code =
        typeof data.code === 'string'
          ? data.code
              .trim()
              .toUpperCase()
          : ''

      const usageLimit =
        Number(data.usageLimit)

      if (
        !code ||
        !Number.isInteger(usageLimit) ||
        usageLimit < 1
      ) {
        return response.status(400).json({
          error:
            'Preencha corretamente o cupom.',
        })
      }

      const existing = await sql`
        SELECT id
        FROM registration_coupons
        WHERE UPPER(code) = ${code}
        LIMIT 1
      `

      if (existing[0]) {
        return response.status(409).json({
          error:
            'Esse cupom já existe.',
        })
      }

      await sql`
        INSERT INTO registration_coupons (
          code,
          usage_limit,
          active
        )
        VALUES (
          ${code},
          ${usageLimit},
          1
        )
      `

      return response.status(201).json({
        success: true,
        message:
          'Cupom criado! 🎟️',
      })
    }

    if (action === 'event') {
""",
    "Coupon creation backend"
)


# =========================================================
# 7. ADMIN CREATE PANEL
# =========================================================

replace_once(
    "src/components/AdminCreatePanel.jsx",
    """            <label>
              Link do Sympla
            </label>
""",
    """            <label>
              Valor da inscrição
            </label>

            <input
              type="number"
              name="registrationFee"
              min="0"
              step="0.01"
              placeholder="35.00"
              required
            />

            <label>
              Prazo das inscrições
            </label>

            <input
              type="datetime-local"
              name="registrationDeadline"
              required
            />

            <label>
              Link do Sympla
            </label>
""",
    "Event registration form"
)

replace_once(
    "src/components/AdminCreatePanel.jsx",
    """        <details>
          <summary>
            📅 Criar evento
""",
    """        <details>
          <summary>
            🎟️ Criar cupom de gratuidade
          </summary>

          <form
            onSubmit={handleSubmit(
              'coupon'
            )}
          >
            <label>
              Nome do cupom
            </label>

            <input
              name="code"
              placeholder="SONHADOR2026"
              required
            />

            <label>
              Quantidade de usos
            </label>

            <input
              type="number"
              name="usageLimit"
              min="1"
              required
            />

            <button
              disabled={isLoading}
              type="submit"
            >
              Criar cupom
            </button>
          </form>
        </details>

        <details>
          <summary>
            📅 Criar evento
""",
    "Coupon create form"
)


# =========================================================
# 8. ADMIN DATA
# =========================================================

replace_once(
    "server/actions/admin-data.js",
    """        e.confirmation_deadline,
        e.sympla_link,
""",
    """        e.confirmation_deadline,
        e.registration_fee,
        e.registration_deadline,
        e.registrations_open,
        e.sympla_link,
""",
    "Admin event registration fields"
)

replace_once(
    "server/actions/admin-data.js",
    """    const announcements = await sql`
""",
    """    const registrationCoupons = await sql`
      SELECT
        rc.id,
        rc.code,
        rc.usage_limit,
        rc.active,
        rc.created_at,
        COUNT(er.id)::int AS used_count
      FROM registration_coupons rc
      LEFT JOIN event_registrations er
        ON er.coupon_id = rc.id
        AND er.status IN (
          'pending_coupon_review',
          'confirmed'
        )
      GROUP BY
        rc.id,
        rc.code,
        rc.usage_limit,
        rc.active,
        rc.created_at
      ORDER BY rc.created_at DESC
    `

    const registrations = await sql`
      SELECT
        er.id,
        er.event_id,
        er.user_id,
        er.email,
        er.team,
        er.status,
        er.payment_receipt_path,
        er.rejection_reason,
        er.created_at,
        er.updated_at,
        er.reviewed_at,
        u.name AS user_name,
        p.name AS project_name,
        e.name AS event_name,
        e.event_date,
        rc.code AS coupon_code,
        r.name AS activity_name
      FROM event_registrations er
      JOIN users u
        ON er.user_id = u.id
      JOIN projects p
        ON u.project_id = p.id
      JOIN events e
        ON er.event_id = e.id
      LEFT JOIN registration_coupons rc
        ON er.coupon_id = rc.id
      LEFT JOIN LATERAL (
        SELECT roles.name
        FROM confirmations c
        JOIN event_roles evr
          ON c.event_role_id = evr.id
        JOIN roles
          ON evr.role_id = roles.id
        WHERE c.user_id = er.user_id
          AND evr.event_id = er.event_id
          AND c.status = 'confirmed'
        ORDER BY roles.name
        LIMIT 1
      ) r ON TRUE
      ORDER BY
        e.event_date DESC,
        er.created_at DESC
    `

    const announcements = await sql`
""",
    "Admin registrations queries"
)

replace_once(
    "server/actions/admin-data.js",
    """      tasks,
      activityParticipants,
""",
    """      tasks,
      registrationCoupons,
      registrations,
      activityParticipants,
""",
    "Admin registration return"
)


# =========================================================
# 9. HOME BACKEND
# =========================================================

replace_once(
    "server/actions/home.js",
    """        users.name,
        users.avatar_path,
""",
    """        users.name,
        users.email,
        users.avatar_path,
""",
    "Current user email"
)

replace_once(
    "server/actions/home.js",
    """        events.confirmation_deadline,
        projects.name AS project
""",
    """        events.confirmation_deadline,
        events.registration_fee,
        events.registration_deadline,
        events.registrations_open,
        (
          SELECT COUNT(*)::int
          FROM event_registrations er_count
          WHERE er_count.event_id =
            events.id
            AND er_count.status =
              'confirmed'
        ) AS registration_count,
        projects.name AS project
""",
    "Upcoming registration data"
)

replace_once(
    "server/actions/home.js",
    """        return {
          ...event,
          activities,
        }
""",
    """        const registrations = await sql`
          SELECT
            id,
            email,
            team,
            status,
            rejection_reason,
            created_at
          FROM event_registrations
          WHERE event_id = ${event.id}
            AND user_id =
              ${currentUser.id}
          LIMIT 1
        `

        return {
          ...event,
          activities,
          registration:
            registrations[0] || null,
        }
""",
    "User event registration"
)


# =========================================================
# 10. CONFIRM ACTIVITY REQUIRES REGISTRATION
# =========================================================

replace_once(
    "server/actions/confirm-activity.js",
    """        er.id,
        er.vacancy_limit,
""",
    """        er.id,
        er.event_id,
        er.vacancy_limit,
""",
    "Activity event id"
)

replace_once(
    "server/actions/confirm-activity.js",
    """    const existing = await sql`
""",
    """    const registrations = await sql`
      SELECT id
      FROM event_registrations
      WHERE event_id =
        ${eventRole.event_id}
        AND user_id =
          ${sessionUser.userId}
        AND status = 'confirmed'
      LIMIT 1
    `

    if (!registrations[0]) {
      return response.status(403).json({
        error:
          'Você precisa ter sua inscrição no evento confirmada antes de assumir uma atividade.',
      })
    }

    const existing = await sql`
""",
    "Activity registration requirement"
)


# =========================================================
# 11. EVENT REGISTRATION COMPONENT
# =========================================================

Path(
    "src/components/EventRegistrationPanel.jsx"
).write_text("""import { useState } from 'react'

import {
  REGISTRATION_TEAMS,
  getTeamLabel,
} from '../constants/registrationTeams'

import {
  formatDateBr,
  formatDateTimeBr,
} from '../utils/formatters'

const PIX_KEY =
  '04507472000196'

const PIX_DISPLAY =
  '04.507.472/0001-96'

function EventRegistrationPanel({
  event,
  currentUser,
  onUpdated,
}) {
  const [email, setEmail] =
    useState(
      event.registration?.email ||
      currentUser.email ||
      ''
    )

  const [team, setTeam] =
    useState(
      event.registration?.team ||
      ''
    )

  const [coupon, setCoupon] =
    useState('')

  const [receipt, setReceipt] =
    useState(null)

  const [message, setMessage] =
    useState('')

  const [isLoading, setIsLoading] =
    useState(false)

  const registration =
    event.registration

  const status =
    registration?.status

  const deadlineOpen =
    event.registration_deadline &&
    new Date(
      event.registration_deadline
    ) >= new Date()

  const registrationOpen =
    Number(
      event.registrations_open
    ) === 1 &&
    deadlineOpen

  async function copyPix() {
    try {
      await navigator.clipboard
        .writeText(PIX_KEY)

      setMessage(
        '✅ Chave PIX copiada!'
      )
    } catch {
      setMessage(
        `PIX: ${PIX_DISPLAY}`
      )
    }
  }

  async function prepareReceipt() {
    if (!receipt) {
      throw new Error(
        'Selecione o comprovante do PIX.'
      )
    }

    if (
      receipt.size >
      8 * 1024 * 1024
    ) {
      throw new Error(
        'O comprovante deve ter até 8 MB.'
      )
    }

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]

    if (!allowed.includes(receipt.type)) {
      throw new Error(
        'Use JPG, PNG, WebP ou PDF.'
      )
    }

    const prepareResponse =
      await fetch(
        '/api/volunteer?action=registration',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            operation:
              'prepare-receipt',
            eventId:
              event.id,
            contentType:
              receipt.type,
          }),
        }
      )

    const prepareResult =
      await prepareResponse.json()

    if (!prepareResponse.ok) {
      throw new Error(
        prepareResult.error ||
        'Não foi possível preparar o comprovante.'
      )
    }

    const formData =
      new FormData()

    formData.append(
      'cacheControl',
      '3600'
    )

    formData.append(
      '',
      receipt
    )

    const uploadResponse =
      await fetch(
        prepareResult.signedUrl,
        {
          method: 'PUT',

          headers: {
            'x-upsert': 'false',
          },

          body: formData,
        }
      )

    if (!uploadResponse.ok) {
      throw new Error(
        'Não foi possível enviar o comprovante.'
      )
    }

    return prepareResult.storagePath
  }

  async function handleSubmit(
    submitEvent
  ) {
    submitEvent.preventDefault()

    setIsLoading(true)
    setMessage('')

    try {
      const usingCoupon =
        Boolean(coupon.trim())

      let storagePath = null

      if (!usingCoupon) {
        setMessage(
          '☁️ Enviando comprovante...'
        )

        storagePath =
          await prepareReceipt()
      }

      setMessage(
        '🎟️ Registrando inscrição...'
      )

      const response =
        await fetch(
          '/api/volunteer?action=registration',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                operation: 'submit',
                eventId: event.id,
                email,
                team,
                couponCode:
                  coupon,
                storagePath,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível realizar a inscrição.'
        )
      }

      setMessage(
        `✅ ${result.message}`
      )

      setReceipt(null)
      setCoupon('')

      await onUpdated()
    } catch (error) {
      setMessage(
        error.message ||
        'Não foi possível concluir.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (
    status === 'confirmed'
  ) {
    return (
      <section className="registration-confirmed-card">
        <span className="registration-ticket-icon">
          🎟️
        </span>

        <div>
          <p className="eyebrow">
            VOCÊ ESTÁ DENTRO!
          </p>

          <h3>{event.name}</h3>

          <p>
            📅 {formatDateBr(
              event.event_date
            )}
          </p>

          <p>
            👥 {getTeamLabel(
              registration.team
            )}
          </p>

          <strong className="registration-confirmed-label">
            INSCRIÇÃO CONFIRMADA ✓
          </strong>
        </div>
      </section>
    )
  }

  if (
    status ===
      'pending_payment_review' ||
    status ===
      'pending_coupon_review'
  ) {
    return (
      <div className="registration-status-card">
        <strong>
          🟡 Inscrição em análise
        </strong>

        <p>
          {status ===
          'pending_coupon_review'
            ? 'Seu cupom de gratuidade está aguardando aprovação.'
            : 'Seu comprovante PIX está aguardando conferência.'}
        </p>
      </div>
    )
  }

  if (!registrationOpen) {
    return (
      <div className="registration-status-card">
        <strong>
          🔒 Inscrições encerradas
        </strong>
      </div>
    )
  }

  return (
    <section className="registration-panel">
      <div className="registration-panel-heading">
        <div>
          <p className="eyebrow">
            INSCRIÇÕES
          </p>

          <h3>
            🎟️ Quero participar
          </h3>
        </div>

        <span className="registration-counter">
          ❤️ {event.registration_count || 0}
          {' '}
          confirmado
          {Number(event.registration_count) !== 1
            ? 's'
            : ''}
        </span>
      </div>

      <div className="registration-payment-box">
        <strong>
          💙 Ajuda de custo
        </strong>

        <span>
          R$ {Number(
            event.registration_fee || 0
          ).toFixed(2).replace('.', ',')}
        </span>

        <p>
          PIX — Associação Sonhos de Criança
        </p>

        <button
          type="button"
          className="secondary-button"
          onClick={copyPix}
        >
          📋 Copiar CNPJ PIX
        </button>

        <small>
          {PIX_DISPLAY}
        </small>
      </div>

      <form
        className="registration-form"
        onSubmit={handleSubmit}
      >
        <label>
          E-mail de confirmação
        </label>

        <input
          type="email"
          value={email}
          onChange={(e) =>
            setEmail(
              e.target.value
            )
          }
          required
        />

        <label>
          Sua equipe neste evento
        </label>

        <select
          value={team}
          onChange={(e) =>
            setTeam(
              e.target.value
            )
          }
          required
        >
          <option value="">
            Selecione
          </option>

          {REGISTRATION_TEAMS.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            )
          )}
        </select>

        <div className="registration-divider">
          <span>
            PAGAMENTO OU GRATUIDADE
          </span>
        </div>

        <label>
          Cupom de gratuidade
          <small>
            {' '}
            (se possuir)
          </small>
        </label>

        <input
          value={coupon}
          onChange={(e) =>
            setCoupon(
              e.target.value
                .toUpperCase()
            )
          }
          placeholder="Ex.: SONHADOR2026"
        />

        {!coupon.trim() && (
          <>
            <label>
              Comprovante do PIX
            </label>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) =>
                setReceipt(
                  e.target.files?.[0] ||
                  null
                )
              }
              required
            />
          </>
        )}

        {status ===
          'payment_rejected' && (
          <div className="registration-rejected">
            <strong>
              ⚠️ Precisamos de uma correção
            </strong>

            <p>
              {registration.rejection_reason ||
                'Reenvie sua inscrição.'}
            </p>
          </div>
        )}

        <button
          type="submit"
          className="primary-button"
          disabled={isLoading}
        >
          {isLoading
            ? 'Enviando...'
            : 'Enviar inscrição ❤️'}
        </button>

        <small>
          Inscrições até{' '}
          {formatDateTimeBr(
            event.registration_deadline
          )}
        </small>
      </form>

      {message && (
        <p className="action-message">
          {message}
        </p>
      )}
    </section>
  )
}

export default EventRegistrationPanel
""")

print("✅ Componente de inscrição criado.")


# =========================================================
# 12. HOME PAGE
# =========================================================

replace_once(
    "src/pages/HomePage.jsx",
    """import VolunteerCard from '../components/VolunteerCard'
""",
    """import VolunteerCard from '../components/VolunteerCard'
import EventRegistrationPanel from '../components/EventRegistrationPanel'
""",
    "Import EventRegistrationPanel"
)

replace_once(
    "src/pages/HomePage.jsx",
    """                    <EventCard event={event} />

                    <div className="event-activities-block">
""",
    """                    <EventCard event={event} />

                    <EventRegistrationPanel
                      event={event}
                      currentUser={currentUser}
                      onUpdated={loadHome}
                    />

                    <div className="event-activities-block">
""",
    "Registration UI on Home"
)


# =========================================================
# 13. ADMIN REGISTRATION PANEL
# =========================================================

Path(
    "src/components/AdminRegistrationsPanel.jsx"
).write_text("""import { useState } from 'react'
import { formatDateTimeBr } from '../utils/formatters'
import { getTeamLabel } from '../constants/registrationTeams'

function AdminRegistrationsPanel({
  registrations = [],
  coupons = [],
  onUpdated,
}) {
  const [message, setMessage] =
    useState('')

  const [isLoading, setIsLoading] =
    useState(false)

  async function action(
    operation,
    data
  ) {
    setIsLoading(true)
    setMessage('')

    try {
      const response =
        await fetch(
          '/api/admin?action=registrations',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              operation,
              ...data,
            }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível concluir.'
        )
      }

      setMessage(
        result.message || ''
      )

      await onUpdated()

      return result
    } catch (error) {
      setMessage(error.message)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  async function openReceipt(
    registration
  ) {
    const result =
      await action(
        'receipt-url',
        {
          registrationId:
            registration.id,
        }
      )

    if (result?.url) {
      window.open(
        result.url,
        '_blank',
        'noopener,noreferrer'
      )
    }
  }

  async function approve(
    registration
  ) {
    if (
      !window.confirm(
        `Confirmar inscrição de ${registration.user_name}?`
      )
    ) {
      return
    }

    await action(
      'approve',
      {
        registrationId:
          registration.id,
      }
    )
  }

  async function reject(
    registration
  ) {
    const reason =
      window.prompt(
        'Motivo da rejeição/correção:'
      )

    if (!reason?.trim()) {
      return
    }

    await action(
      'reject',
      {
        registrationId:
          registration.id,
        reason,
      }
    )
  }

  const confirmedCount =
    registrations.filter(
      (item) =>
        item.status ===
        'confirmed'
    ).length

  const pendingCount =
    registrations.filter(
      (item) =>
        item.status ===
          'pending_payment_review' ||
        item.status ===
          'pending_coupon_review'
    ).length

  return (
    <section
      id="inscricoes"
      className="admin-section"
    >
      <p className="admin-eyebrow admin-orange">
        QUEM VEM SONHAR
      </p>

      <h2>
        🎟️ Inscrições
      </h2>

      <div className="admin-registration-summary">
        <article>
          <strong>
            {confirmedCount}
          </strong>
          <span>
            confirmados
          </span>
        </article>

        <article>
          <strong>
            {pendingCount}
          </strong>
          <span>
            aguardando análise
          </span>
        </article>
      </div>

      {message && (
        <p className="admin-action-message">
          {message}
        </p>
      )}

      <div className="registration-admin-table">
        {registrations.length === 0 ? (
          <p>
            Nenhuma inscrição ainda.
          </p>
        ) : (
          registrations.map(
            (registration) => (
              <article
                key={registration.id}
                className="registration-admin-row"
              >
                <div>
                  <strong>
                    {registration.user_name}
                  </strong>

                  <span>
                    {registration.project_name}
                  </span>
                </div>

                <div>
                  <span>
                    {registration.event_name}
                  </span>

                  <small>
                    {getTeamLabel(
                      registration.team
                    )}
                  </small>
                </div>

                <div>
                  <span>
                    {registration.email}
                  </span>

                  <small>
                    {registration.activity_name
                      ? `🙋 ${registration.activity_name}`
                      : 'Sem atividade específica'}
                  </small>
                </div>

                <div>
                  <span>
                    {formatDateTimeBr(
                      registration.created_at
                    )}
                  </span>

                  <small>
                    {registration.status}
                  </small>
                </div>

                <div className="registration-admin-actions">
                  {registration.payment_receipt_path && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() =>
                        openReceipt(
                          registration
                        )
                      }
                    >
                      📎 Comprovante
                    </button>
                  )}

                  {registration.coupon_code && (
                    <span className="admin-tag">
                      🎟️ {registration.coupon_code}
                    </span>
                  )}

                  {registration.status !==
                    'confirmed' &&
                    registration.status !==
                    'cancelled' && (
                      <>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() =>
                            approve(
                              registration
                            )
                          }
                        >
                          ✅ Aprovar
                        </button>

                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() =>
                            reject(
                              registration
                            )
                          }
                        >
                          ❌ Rejeitar
                        </button>
                      </>
                    )}
                </div>
              </article>
            )
          )
        )}
      </div>

      <div className="admin-coupons-box">
        <h3>
          🎫 Cupons de gratuidade
        </h3>

        {coupons.map((coupon) => (
          <div
            key={coupon.id}
            className="admin-coupon-row"
          >
            <strong>
              {coupon.code}
            </strong>

            <span>
              {coupon.used_count}
              {' / '}
              {coupon.usage_limit}
            </span>

            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                action(
                  'toggle-coupon',
                  {
                    couponId:
                      coupon.id,
                  }
                )
              }
            >
              {Number(coupon.active) === 1
                ? '⚪ Desativar'
                : '🟢 Ativar'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

export default AdminRegistrationsPanel
""")

print("✅ Painel de inscrições criado.")


# =========================================================
# 14. ADMIN PAGE
# =========================================================

replace_once(
    "src/pages/AdminPage.jsx",
    """import AdminParticipantAction from '../components/AdminParticipantAction'
""",
    """import AdminParticipantAction from '../components/AdminParticipantAction'
import AdminRegistrationsPanel from '../components/AdminRegistrationsPanel'
""",
    "Import AdminRegistrationsPanel"
)

replace_once(
    "src/pages/AdminPage.jsx",
    """        <a href="#atividades">
          🙋 Atividades
        </a>
""",
    """        <a href="#inscricoes">
          🎟️ Inscrições
        </a>

        <a href="#atividades">
          🙋 Atividades
        </a>
""",
    "Admin nav registrations"
)

replace_once(
    "src/pages/AdminPage.jsx",
    """        <section
          id="atividades"
""",
    """        <AdminRegistrationsPanel
          registrations={
            data.registrations || []
          }
          coupons={
            data.registrationCoupons || []
          }
          onUpdated={reloadAdmin}
        />

        <section
          id="atividades"
""",
    "Admin registrations section"
)


# =========================================================
# 15. CSS
# =========================================================

with open(
    "src/styles/home.css",
    "a"
) as file:
    file.write("""

/* =========================================================
   EVENT REGISTRATIONS
   ========================================================= */

.registration-panel,
.registration-confirmed-card,
.registration-status-card {
  margin-top: 16px;
  padding: 18px;
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  background: rgba(255, 255, 255, 0.92);
}

.registration-panel-heading {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
}

.registration-counter {
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
}

.registration-payment-box {
  display: grid;
  gap: 6px;
  margin: 16px 0;
  padding: 14px;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.035);
}

.registration-payment-box > span {
  font-size: 1.35rem;
  font-weight: 800;
}

.registration-payment-box small {
  opacity: 0.7;
}

.registration-form {
  display: grid;
  gap: 10px;
}

.registration-form label {
  margin-top: 4px;
  font-weight: 700;
  font-size: 0.85rem;
}

.registration-form input,
.registration-form select {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  background: white;
}

.registration-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px 0;
  opacity: 0.55;
  font-size: 0.7rem;
  font-weight: 800;
}

.registration-divider::before,
.registration-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: currentColor;
}

.registration-confirmed-card {
  display: flex;
  gap: 16px;
  align-items: center;
}

.registration-ticket-icon {
  font-size: 2.4rem;
}

.registration-confirmed-label {
  display: inline-block;
  margin-top: 8px;
}

.registration-rejected {
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 0, 0, 0.05);
}

@media (max-width: 520px) {
  .registration-panel-heading {
    display: grid;
  }
}
""")


with open(
    "src/styles/admin.css",
    "a"
) as file:
    file.write("""

/* =========================================================
   ADMIN REGISTRATIONS
   ========================================================= */

.admin-registration-summary {
  display: grid;
  grid-template-columns:
    repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 18px 0;
}

.admin-registration-summary article {
  padding: 16px;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.035);
}

.admin-registration-summary strong {
  display: block;
  font-size: 1.5rem;
}

.registration-admin-table {
  display: grid;
  gap: 10px;
}

.registration-admin-row {
  display: grid;
  grid-template-columns:
    1fr 1.2fr 1.4fr 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.07);
}

.registration-admin-row > div {
  min-width: 0;
}

.registration-admin-row span,
.registration-admin-row small {
  display: block;
  overflow-wrap: anywhere;
}

.registration-admin-row small {
  margin-top: 4px;
  opacity: 0.66;
}

.registration-admin-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.admin-coupons-box {
  margin-top: 28px;
}

.admin-coupon-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.035);
}

.admin-coupon-row span {
  margin-left: auto;
}

@media (max-width: 900px) {
  .registration-admin-row {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
  }

  .registration-admin-actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 560px) {
  .registration-admin-row,
  .admin-registration-summary {
    grid-template-columns: 1fr;
  }
}
""")

print("✅ CSS adicionado.")

print("")
print("🚀 TURBO 2 aplicado!")

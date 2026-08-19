import crypto from 'node:crypto'
import process from 'node:process'

import {
  createClient,
} from '@supabase/supabase-js'

import {
  getAdminTeamIds,
  isGlobalAdmin,
  isProjectAdmin,
  isTeamAdmin,
  requireAdmin,
  sql,
} from './_admin.js'


// =========================================================
// STORAGE
// =========================================================

const EXPENSE_BUCKET =
  process.env.REGISTRATION_RECEIPTS_BUCKET ||
  'sonhar-receipts'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])


function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL

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
    .getBucket(EXPENSE_BUCKET)

  if (!error && data) {
    return
  }

  const {
    error: createError,
  } = await supabase.storage
    .createBucket(
      EXPENSE_BUCKET,
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


function extensionForType(type) {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }

  return map[type]
}


// =========================================================
// ACCESS
// =========================================================

async function getEventAndTeam(
  eventId,
  teamId
) {
  const rows = await sql`
    SELECT
      e.id AS event_id,
      e.name AS event_name,
      e.project_id,

      t.id AS team_id,
      t.code AS team_code,
      t.name AS team_name

    FROM events e

    CROSS JOIN teams t

    WHERE
      e.id = ${eventId}
      AND t.id = ${teamId}
      AND t.active = 1

    LIMIT 1
  `

  return rows[0] || null
}


// =========================================================
// CAN CREATE EXPENSE
// =========================================================
//
// Admin Geral:
// - qualquer equipe / projeto.
//
// Admin de Equipe:
// - somente própria equipe;
// - somente próprio projeto;
// - Mídias pode atuar transversalmente.
//
// Admin de Projeto:
// - nesta V1 apenas visualiza.
// =========================================================

async function canCreateExpense(
  admin,
  eventId,
  teamId
) {
  const target =
    await getEventAndTeam(
      eventId,
      teamId
    )

  if (!target) {
    return false
  }

  if (isGlobalAdmin(admin)) {
    return true
  }

  if (!isTeamAdmin(admin)) {
    return false
  }

  const teamIds =
    getAdminTeamIds(admin)

  if (
    !teamIds.includes(
      Number(teamId)
    )
  ) {
    return false
  }

  // Mídias é transversal.
  if (
    target.team_code === 'media'
  ) {
    return true
  }

  return (
    Number(
      target.project_id
    ) ===
    Number(
      admin.projectId
    )
  )
}


// =========================================================
// CAN READ EXPENSE
// =========================================================

function canReadExpense(
  admin,
  expense
) {
  if (isGlobalAdmin(admin)) {
    return true
  }

  if (
    isProjectAdmin(admin)
  ) {
    return (
      Number(
        expense.project_id
      ) ===
      Number(
        admin.projectId
      )
    )
  }

  if (!isTeamAdmin(admin)) {
    return false
  }

  const teamIds =
    getAdminTeamIds(admin)

  if (
    !teamIds.includes(
      Number(
        expense.team_id
      )
    )
  ) {
    return false
  }

  if (
    expense.team_code ===
    'media'
  ) {
    return true
  }

  return (
    Number(
      expense.project_id
    ) ===
    Number(
      admin.projectId
    )
  )
}


// =========================================================
// HANDLER
// =========================================================

export default async function handler(
  request,
  response
) {
  const admin =
    await requireAdmin(request)

  if (!admin) {
    return response
      .status(403)
      .json({
        error:
          'Acesso administrativo não autorizado.',
      })
  }

  const {
    operation,
    eventId,
    teamId,
    description,
    amount,
    contentType,
    storagePath,
    expenseId,
  } =
    request.method === 'GET'
      ? request.query ?? {}
      : request.body ?? {}

  try {

    // =====================================================
    // LIST
    // =====================================================

    if (operation === 'list') {
      const rows = await sql`
        SELECT
          te.id,
          te.event_id,
          te.team_id,
          te.description,
          te.amount,
          te.receipt_path,
          te.created_by,
          te.created_at,
          te.updated_at,

          e.name AS event_name,
          e.event_date,
          e.project_id,

          p.name AS project_name,

          t.code AS team_code,
          t.name AS team_name,

          u.name AS created_by_name

        FROM team_expenses te

        JOIN events e
          ON e.id =
            te.event_id

        LEFT JOIN projects p
          ON p.id =
            e.project_id

        JOIN teams t
          ON t.id =
            te.team_id

        JOIN users u
          ON u.id =
            te.created_by

        WHERE te.active = 1

        ORDER BY
          e.event_date DESC,
          te.created_at DESC
      `

      const expenses =
        rows.filter(
          (expense) =>
            canReadExpense(
              admin,
              expense
            )
        )

      return response
        .status(200)
        .json({
          expenses,
        })
    }


    // =====================================================
    // PREPARE RECEIPT
    // =====================================================

    if (
      operation ===
      'prepare-receipt'
    ) {
      const numericEventId =
        Number(eventId)

      const numericTeamId =
        Number(teamId)

      if (
        !Number.isInteger(
          numericEventId
        ) ||
        !Number.isInteger(
          numericTeamId
        )
      ) {
        return response
          .status(400)
          .json({
            error:
              'Evento ou equipe inválido.',
          })
      }

      const allowed =
        await canCreateExpense(
          admin,
          numericEventId,
          numericTeamId
        )

      if (!allowed) {
        return response
          .status(403)
          .json({
            error:
              'Você não pode registrar gastos para esta equipe.',
          })
      }

      if (
        !ALLOWED_TYPES.has(
          contentType
        )
      ) {
        return response
          .status(400)
          .json({
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
        extensionForType(
          contentType
        )

      const path =
        [
          'expenses',
          `event-${numericEventId}`,
          `team-${numericTeamId}`,
          `admin-${admin.id}`,
          `${Date.now()}-${crypto.randomUUID()}.${extension}`,
        ].join('/')

      const {
        data,
        error,
      } = await supabase.storage
        .from(EXPENSE_BUCKET)
        .createSignedUploadUrl(
          path,
          {
            upsert: false,
          }
        )

      if (error) {
        throw error
      }

      return response
        .status(200)
        .json({
          success: true,

          storagePath:
            path,

          signedUrl:
            data.signedUrl,
        })
    }


    // =====================================================
    // CREATE EXPENSE
    // =====================================================

    if (operation === 'create') {
      const numericEventId =
        Number(eventId)

      const numericTeamId =
        Number(teamId)

      const numericAmount =
        Number(amount)

      const cleanDescription =
        typeof description ===
        'string'
          ? description.trim()
          : ''

      if (
        !Number.isInteger(
          numericEventId
        ) ||
        !Number.isInteger(
          numericTeamId
        ) ||
        !Number.isFinite(
          numericAmount
        ) ||
        numericAmount < 0 ||
        !cleanDescription
      ) {
        return response
          .status(400)
          .json({
            error:
              'Preencha corretamente descrição e valor.',
          })
      }

      const allowed =
        await canCreateExpense(
          admin,
          numericEventId,
          numericTeamId
        )

      if (!allowed) {
        return response
          .status(403)
          .json({
            error:
              'Você não pode registrar gastos para esta equipe.',
          })
      }

      const expectedPrefix =
        `expenses/event-${numericEventId}/team-${numericTeamId}/admin-${admin.id}/`

      if (
        typeof storagePath !==
          'string' ||
        !storagePath.startsWith(
          expectedPrefix
        )
      ) {
        return response
          .status(400)
          .json({
            error:
              'Envie o comprovante da compra.',
          })
      }

      // Confirma que o arquivo realmente
      // chegou ao Storage.
      const supabase =
        getSupabaseAdmin()

      const pieces =
        storagePath.split('/')

      const fileName =
        pieces.pop()

      const folder =
        pieces.join('/')

      const {
        data: files,
        error: listError,
      } = await supabase.storage
        .from(EXPENSE_BUCKET)
        .list(
          folder,
          {
            search:
              fileName,

            limit: 5,
          }
        )

      if (listError) {
        throw listError
      }

      const exists =
        files?.some(
          (file) =>
            file.name ===
            fileName
        )

      if (!exists) {
        return response
          .status(400)
          .json({
            error:
              'O comprovante ainda não chegou ao armazenamento.',
          })
      }

      const rows = await sql`
        INSERT INTO team_expenses (
          event_id,
          team_id,
          description,
          amount,
          receipt_path,
          created_by
        )

        VALUES (
          ${numericEventId},
          ${numericTeamId},
          ${cleanDescription},
          ${numericAmount},
          ${storagePath},
          ${admin.id}
        )

        RETURNING
          id,
          event_id,
          team_id,
          description,
          amount,
          receipt_path,
          created_by,
          created_at
      `

      return response
        .status(201)
        .json({
          success: true,

          expense:
            rows[0],

          message:
            'Gasto registrado! 🧾✅',
        })
    }


    // =====================================================
    // RECEIPT URL
    // =====================================================

    if (
      operation ===
      'receipt-url'
    ) {
      const numericExpenseId =
        Number(expenseId)

      if (
        !Number.isInteger(
          numericExpenseId
        )
      ) {
        return response
          .status(400)
          .json({
            error:
              'Gasto inválido.',
          })
      }

      const rows = await sql`
        SELECT
          te.id,
          te.team_id,
          te.receipt_path,

          e.project_id,

          t.code AS team_code

        FROM team_expenses te

        JOIN events e
          ON e.id =
            te.event_id

        JOIN teams t
          ON t.id =
            te.team_id

        WHERE
          te.id =
            ${numericExpenseId}

          AND te.active = 1

        LIMIT 1
      `

      const expense =
        rows[0]

      if (
        !expense ||
        !canReadExpense(
          admin,
          expense
        )
      ) {
        return response
          .status(403)
          .json({
            error:
              'Comprovante não disponível.',
          })
      }

      if (
        !expense.receipt_path
      ) {
        return response
          .status(404)
          .json({
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
        .from(EXPENSE_BUCKET)
        .createSignedUrl(
          expense.receipt_path,
          60 * 5
        )

      if (error) {
        throw error
      }

      return response
        .status(200)
        .json({
          url:
            data.signedUrl,
        })
    }


    return response
      .status(400)
      .json({
        error:
          'Operação de gastos desconhecida.',
      })

  } catch (error) {
    console.error(
      'Admin expenses error:',
      error
    )

    return response
      .status(500)
      .json({
        error:
          error?.message ||
          'Não foi possível administrar os gastos.',
      })
  }
}

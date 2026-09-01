import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { neon } from '@neondatabase/serverless'
import { createClient } from '@supabase/supabase-js'
import { requireDreamerUser } from './_dreamer-access.js'

const sql = neon(process.env.DATABASE_URL)
const OLYMPIAD_SLUG = 'olimpiada-sonhadora'
const RECEIPT_BUCKET =
  process.env.REGISTRATION_RECEIPTS_BUCKET ||
  'sonhar-receipts'

const ALLOWED_RECEIPT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

const REVIEW_STATUSES = new Set([
  'confirmed',
  'correction_requested',
  'rejected',
])

function money(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : NaN
}

function referenceCode() {
  return `DREAM-${crypto.randomBytes(6).toString('hex').toUpperCase()}`
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase Storage não configurado.')
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function ensurePrivateBucket(supabase) {
  const { data, error } =
    await supabase.storage.getBucket(RECEIPT_BUCKET)

  if (!error && data) return

  const { error: createError } =
    await supabase.storage.createBucket(
      RECEIPT_BUCKET,
      {
        public: false,
        fileSizeLimit: 8 * 1024 * 1024,
      }
    )

  if (
    createError &&
    !String(createError.message || '')
      .toLowerCase()
      .includes('already')
  ) {
    throw createError
  }
}

function extensionForType(type) {
  return {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }[type]
}

async function storageFileExists(storagePath) {
  const supabase = getSupabaseAdmin()
  const pieces = storagePath.split('/')
  const fileName = pieces.pop()
  const folder = pieces.join('/')

  const { data, error } =
    await supabase.storage
      .from(RECEIPT_BUCKET)
      .list(folder, {
        search: fileName,
        limit: 5,
      })

  if (error) throw error

  return Boolean(
    data?.some(file => file.name === fileName)
  )
}

async function hashStoredReceipt(storagePath) {
  const supabase = getSupabaseAdmin()
  const { data, error } =
    await supabase.storage
      .from(RECEIPT_BUCKET)
      .download(storagePath)

  if (error || !data) {
    throw error || new Error(
      'Não foi possível ler o comprovante enviado.'
    )
  }

  const arrayBuffer = await data.arrayBuffer()

  return crypto
    .createHash('sha256')
    .update(Buffer.from(arrayBuffer))
    .digest('hex')
}

async function getOlympiad() {
  const rows = await sql`
    SELECT id, name, slug, status, allows_direct_contributions
    FROM dreamer_campaigns
    WHERE slug = ${OLYMPIAD_SLUG}
    LIMIT 1
  `
  return rows[0] || null
}

async function getTeams(campaignId) {
  if (!campaignId) return []

  return sql`
    SELECT p.id AS project_id, p.name AS project
    FROM dreamer_campaign_teams dct
    JOIN projects p ON p.id = dct.project_id
    WHERE dct.campaign_id = ${campaignId}
      AND dct.active = 1
    ORDER BY p.id
  `
}

async function getContribution(contributionId) {
  const rows = await sql`
    SELECT *
    FROM dreamer_contributions
    WHERE id = ${contributionId}
      AND source_type = 'app'
    LIMIT 1
  `
  return rows[0] || null
}

async function buildPayload(user) {
  const olympiad = await getOlympiad()
  const teams = await getTeams(olympiad?.id)

  const mine = await sql`
    SELECT dc.id, dc.campaign_id, dc.project_id, p.name AS project,
           dc.amount, dc.message, dc.source_type, dc.payment_reference,
           dc.status, dc.provider, dc.payment_method, dc.created_at,
           dc.confirmed_at, dc.cancelled_at, dc.payment_receipt_path,
           dc.review_reason, dc.reviewed_at, dc.submitted_at
    FROM dreamer_contributions dc
    LEFT JOIN projects p ON p.id = dc.project_id
    WHERE dc.contributor_user_id = ${user.id}
      AND dc.source_type = 'app'
    ORDER BY dc.created_at DESC, dc.id DESC
    LIMIT 50
  `

  let admin = null
  if (user.isDreamerAdmin) {
    const summaryRows = await sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE status IN ('pending', 'pending_payment_review')
        )::int AS pending,
        COUNT(*) FILTER (
          WHERE status = 'pending_payment_review'
        )::int AS pending_review,
        COUNT(*) FILTER (
          WHERE status = 'correction_requested'
        )::int AS correction_requested,
        COUNT(*) FILTER (
          WHERE status = 'rejected'
        )::int AS rejected,
        COUNT(*) FILTER (
          WHERE status = 'confirmed'
        )::int AS confirmed,
        COUNT(*) FILTER (
          WHERE status = 'cancelled'
        )::int AS cancelled,
        COALESCE(
          SUM(amount) FILTER (
            WHERE status = 'confirmed'
          ),
          0
        ) AS confirmed_amount
      FROM dreamer_contributions
      WHERE source_type = 'app'
    `

    const latest = await sql`
      SELECT dc.id, dc.campaign_id, dc.project_id, p.name AS project,
             dc.amount, dc.message, dc.payment_reference, dc.status,
             dc.provider, dc.payment_method, dc.created_at, dc.confirmed_at,
             dc.payment_receipt_path, dc.review_reason, dc.reviewed_at,
             dc.submitted_at,
             COALESCE(NULLIF(u.full_name, ''), u.name, u.username, dc.contributor_name) AS contributor
      FROM dreamer_contributions dc
      LEFT JOIN users u ON u.id = dc.contributor_user_id
      LEFT JOIN projects p ON p.id = dc.project_id
      WHERE dc.source_type = 'app'
      ORDER BY
        CASE dc.status
          WHEN 'pending_payment_review' THEN 0
          WHEN 'correction_requested' THEN 1
          WHEN 'pending' THEN 2
          ELSE 3
        END,
        dc.created_at DESC,
        dc.id DESC
      LIMIT 100
    `

    admin = {
      summary: summaryRows[0] || {
        total: 0,
        pending: 0,
        pending_review: 0,
        correction_requested: 0,
        rejected: 0,
        confirmed: 0,
        cancelled: 0,
        confirmed_amount: 0,
      },
      contributions: latest,
    }
  }

  return {
    olympiad,
    teams,
    contributions: mine,
    isDreamerAdmin: Boolean(user.isDreamerAdmin),
    pix: {
      key: '04507472000196',
      display: '04.507.472/0001-96',
      beneficiary: 'Associação Sonhos de Criança',
    },
    admin,
  }
}

export default async function handler(request, response) {
  try {
    const user = await requireDreamerUser(request)
    if (!user) {
      return response.status(401).json({ error: 'Não autorizado.' })
    }

    if (request.method === 'GET') {
      return response.status(200).json(await buildPayload(user))
    }

    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Método não permitido.' })
    }

    const operation = request.body?.operation

    if (operation === 'create_intent') {
      const amount = money(request.body?.amount)
      const destination = String(request.body?.destination || 'general')
      const message = String(request.body?.message || '').trim().slice(0, 500)

      if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
        return response.status(400).json({
          error: 'Informe um valor entre R$ 1 e R$ 100.000.',
        })
      }

      let campaignId = null
      let projectId = null
      const olympiad = await getOlympiad()

      if (destination === 'olympiad') {
        if (olympiad?.status === 'closed') {
          return response.status(409).json({
            error:
              'A Olimpíada já foi fechada. Você ainda pode fazer uma doação livre ao Sonhar.',
          })
        }

        if (!olympiad || Number(olympiad.allows_direct_contributions) !== 1) {
          return response.status(400).json({
            error: 'A Olimpíada não está aceitando apoios diretos neste momento.',
          })
        }

        projectId = Number(request.body?.projectId)
        const validTeams = await getTeams(olympiad.id)
        const valid = validTeams.some(
          team => Number(team.project_id) === projectId
        )

        if (!valid) {
          return response.status(400).json({ error: 'Escolha um time válido.' })
        }

        campaignId = olympiad.id
      }

      const reference = referenceCode()
      const contributorName = String(
        user.full_name || user.name || user.username || ''
      ).trim()

      const rows = await sql`
        INSERT INTO dreamer_contributions (
          campaign_id,
          project_id,
          contributor_user_id,
          contributor_name,
          amount,
          source_type,
          payment_reference,
          status,
          message,
          provider,
          payment_method,
          updated_at
        ) VALUES (
          ${campaignId},
          ${projectId},
          ${user.id},
          ${contributorName},
          ${amount},
          'app',
          ${reference},
          'pending',
          ${message},
          'pix_manual',
          'pix',
          CURRENT_TIMESTAMP
        )
        RETURNING id, payment_reference
      `

      return response.status(201).json({
        success: true,
        contributionId: rows[0]?.id,
        paymentReference: rows[0]?.payment_reference,
        message:
          'Apoio preparado. Faça o PIX e envie o comprovante para validação do Admin Sócio.',
        ...(await buildPayload(user)),
      })
    }

    if (operation === 'prepare-receipt') {
      const contributionId = Number(request.body?.contributionId)
      const contentType = String(
        request.body?.contentType || ''
      ).toLowerCase()

      if (
        !Number.isInteger(contributionId) ||
        contributionId <= 0
      ) {
        return response.status(400).json({
          error: 'Contribuição inválida.',
        })
      }

      if (!ALLOWED_RECEIPT_TYPES.has(contentType)) {
        return response.status(400).json({
          error: 'Use JPG, PNG, WebP ou PDF como comprovante.',
        })
      }

      const contribution =
        await getContribution(contributionId)

      if (
        !contribution ||
        Number(contribution.contributor_user_id) !==
          Number(user.id) ||
        !['pending', 'correction_requested'].includes(
          contribution.status
        )
      ) {
        return response.status(404).json({
          error:
            'Apoio não encontrado ou indisponível para envio de comprovante.',
        })
      }

      if (contribution.campaign_id) {
        const olympiad = await getOlympiad()
        if (olympiad?.status === 'closed') {
          return response.status(409).json({
            error:
              'A Olimpíada já foi fechada. Não é possível alterar este apoio.',
          })
        }
      }

      const supabase = getSupabaseAdmin()
      await ensurePrivateBucket(supabase)

      const extension =
        extensionForType(contentType)
      const storagePath = [
        'dreamer',
        'direct-contributions',
        `user-${user.id}`,
        `contribution-${contributionId}`,
        `${Date.now()}-${crypto.randomUUID()}.${extension}`,
      ].join('/')

      const { data, error } =
        await supabase.storage
          .from(RECEIPT_BUCKET)
          .createSignedUploadUrl(
            storagePath,
            { upsert: false }
          )

      if (error) throw error

      return response.status(200).json({
        success: true,
        storagePath,
        token: data.token,
        signedUrl: data.signedUrl,
      })
    }

    if (operation === 'submit-receipt') {
      const contributionId = Number(
        request.body?.contributionId
      )
      const storagePath = String(
        request.body?.storagePath || ''
      ).trim()

      const contribution =
        await getContribution(contributionId)

      if (
        !contribution ||
        Number(contribution.contributor_user_id) !==
          Number(user.id) ||
        !['pending', 'correction_requested'].includes(
          contribution.status
        )
      ) {
        return response.status(404).json({
          error:
            'Apoio não encontrado ou indisponível para envio.',
        })
      }

      const expectedPrefix =
        `dreamer/direct-contributions/user-${user.id}/contribution-${contributionId}/`

      if (
        !storagePath ||
        !storagePath.startsWith(expectedPrefix)
      ) {
        return response.status(400).json({
          error: 'Comprovante inválido.',
        })
      }

      if (!(await storageFileExists(storagePath))) {
        return response.status(400).json({
          error:
            'O comprovante ainda não foi encontrado no armazenamento.',
        })
      }

      const receiptHash =
        await hashStoredReceipt(storagePath)

      const rows = await sql`
        UPDATE dreamer_contributions
        SET
          status = 'pending_payment_review',
          provider = 'pix_manual',
          payment_method = 'pix',
          payment_receipt_path = ${storagePath},
          receipt_hash = ${receiptHash},
          review_reason = '',
          reviewed_by = NULL,
          reviewed_at = NULL,
          submitted_at = CURRENT_TIMESTAMP,
          confirmed_at = NULL,
          cancelled_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${contributionId}
          AND contributor_user_id = ${user.id}
          AND source_type = 'app'
          AND status IN ('pending', 'correction_requested')
        RETURNING id
      `

      if (!rows[0]) {
        return response.status(409).json({
          error:
            'Este apoio foi alterado enquanto o comprovante era enviado.',
        })
      }

      return response.status(200).json({
        success: true,
        message:
          'Comprovante enviado. O apoio está aguardando revisão do Admin Sócio.',
        ...(await buildPayload(user)),
      })
    }

    if (operation === 'receipt-url') {
      const contributionId = Number(
        request.body?.contributionId
      )
      const contribution =
        await getContribution(contributionId)

      if (
        !contribution ||
        !contribution.payment_receipt_path
      ) {
        return response.status(404).json({
          error: 'Comprovante não encontrado.',
        })
      }

      if (
        !user.isDreamerAdmin &&
        Number(contribution.contributor_user_id) !==
          Number(user.id)
      ) {
        return response.status(403).json({
          error:
            'Você não pode abrir este comprovante.',
        })
      }

      const supabase = getSupabaseAdmin()
      const { data, error } =
        await supabase.storage
          .from(RECEIPT_BUCKET)
          .createSignedUrl(
            contribution.payment_receipt_path,
            10 * 60
          )

      if (error) throw error

      return response.status(200).json({
        success: true,
        signedUrl: data.signedUrl,
      })
    }

    if (operation === 'review') {
      if (!user.isDreamerAdmin) {
        return response.status(403).json({
          error:
            'Apenas Admins do Sócio podem revisar contribuições.',
        })
      }

      const contributionId = Number(
        request.body?.contributionId
      )
      const decision = String(
        request.body?.decision || ''
      ).trim()
      const reviewReason = String(
        request.body?.reviewReason || ''
      ).trim()

      if (
        !Number.isInteger(contributionId) ||
        !REVIEW_STATUSES.has(decision)
      ) {
        return response.status(400).json({
          error: 'Revisão inválida.',
        })
      }

      if (
        decision !== 'confirmed' &&
        !reviewReason
      ) {
        return response.status(400).json({
          error:
            'Informe o motivo para reprovar ou pedir correção.',
        })
      }

      const contribution =
        await getContribution(contributionId)

      if (
        !contribution ||
        contribution.status !==
          'pending_payment_review'
      ) {
        return response.status(409).json({
          error:
            'Esta contribuição já foi revisada ou não está disponível.',
        })
      }

      if (contribution.campaign_id) {
        const olympiad = await getOlympiad()
        if (olympiad?.status === 'closed') {
          return response.status(409).json({
            error:
              'A Olimpíada já foi fechada. O placar oficial está congelado.',
          })
        }
      }

      const rows = await sql`
        UPDATE dreamer_contributions
        SET
          status = ${decision},
          reviewed_by = ${user.id},
          review_reason = ${reviewReason},
          reviewed_at = CURRENT_TIMESTAMP,
          confirmed_at = CASE
            WHEN ${decision} = 'confirmed'
            THEN CURRENT_TIMESTAMP
            ELSE NULL
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${contributionId}
          AND source_type = 'app'
          AND status = 'pending_payment_review'
        RETURNING id
      `

      if (!rows[0]) {
        return response.status(409).json({
          error:
            'Esta contribuição já foi revisada ou não está disponível.',
        })
      }

      return response.status(200).json({
        success: true,
        message:
          decision === 'confirmed'
            ? 'Contribuição confirmada e incluída nos totais oficiais.'
            : decision === 'correction_requested'
              ? 'Correção solicitada ao apoiador.'
              : 'Contribuição reprovada.',
        ...(await buildPayload(user)),
      })
    }

    if (operation === 'cancel_intent') {
      const contributionId = Number(request.body?.contributionId)
      if (!Number.isInteger(contributionId) || contributionId <= 0) {
        return response.status(400).json({ error: 'Contribuição inválida.' })
      }

      const rows = await sql`
        UPDATE dreamer_contributions
        SET status = 'cancelled',
            cancelled_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${contributionId}
          AND contributor_user_id = ${user.id}
          AND source_type = 'app'
          AND status = 'pending'
        RETURNING id
      `

      if (!rows[0]) {
        return response.status(404).json({
          error: 'Apoio pendente não encontrado ou já processado.',
        })
      }

      return response.status(200).json({
        success: true,
        ...(await buildPayload(user)),
      })
    }

    return response.status(400).json({ error: 'Operação de contribuição inválida.' })
  } catch (error) {
    console.error('Dreamer contributions error:', error)
    return response.status(500).json({
      error: error.message || 'Não foi possível processar o apoio.',
    })
  }
}

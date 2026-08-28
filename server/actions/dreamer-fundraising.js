import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import process from 'node:process'

import { neon } from '@neondatabase/serverless'
import { createClient } from '@supabase/supabase-js'

import {
  requireDreamerUser,
} from './_dreamer-access.js'

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
  'validated',
  'rejected',
  'correction_requested',
])

const INITIATIVE_TYPES = new Set([
  'sale',
  'raffle',
  'donation',
  'campaign',
  'other',
])

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Supabase Storage não configurado.'
    )
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
    await supabase.storage.getBucket(
      RECEIPT_BUCKET
    )

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

function cleanMoney(value) {
  const number = Number(value)
  return Number.isFinite(number)
    ? Math.round((number + Number.EPSILON) * 100) /
        100
    : NaN
}

async function getCampaign() {
  const rows = await sql`
    SELECT
      id,
      name,
      slug,
      status,
      allows_external_entries
    FROM dreamer_campaigns
    WHERE slug = ${OLYMPIAD_SLUG}
    LIMIT 1
  `

  return rows[0] || null
}

async function getCampaignTeams(campaignId) {
  return sql`
    SELECT
      dct.project_id,
      p.name AS project
    FROM dreamer_campaign_teams dct
    JOIN projects p
      ON p.id = dct.project_id
    WHERE
      dct.campaign_id = ${campaignId}
      AND dct.active = 1
    ORDER BY p.id
  `
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

async function getMyEntries({
  campaignId,
  userId,
}) {
  const rows = await sql`
    SELECT
      entry.id,
      entry.project_id,
      project.name AS project,
      entry.initiative_type,
      entry.title,
      entry.gross_amount,
      entry.cost_amount,
      entry.net_amount,
      entry.received_at,
      entry.notes,
      entry.status,
      entry.possible_duplicate,
      entry.review_reason,
      entry.created_at,
      receipt.id AS receipt_id
    FROM dreamer_fundraising_entries entry
    JOIN projects project
      ON project.id = entry.project_id
    LEFT JOIN LATERAL (
      SELECT id
      FROM dreamer_receipts
      WHERE fundraising_entry_id = entry.id
      ORDER BY id DESC
      LIMIT 1
    ) receipt ON TRUE
    WHERE
      entry.campaign_id = ${campaignId}
      AND entry.submitted_by = ${userId}
    ORDER BY entry.created_at DESC, entry.id DESC
    LIMIT 50
  `

  return rows
}

async function getAdminEntries(campaignId) {
  const rows = await sql`
    SELECT
      entry.id,
      entry.project_id,
      project.name AS project,
      entry.submitted_by,
      COALESCE(
        NULLIF(user_account.full_name, ''),
        user_account.name
      ) AS submitted_by_name,
      entry.initiative_type,
      entry.title,
      entry.gross_amount,
      entry.cost_amount,
      entry.net_amount,
      entry.received_at,
      entry.notes,
      entry.status,
      entry.possible_duplicate,
      entry.review_reason,
      entry.reviewed_at,
      entry.created_at,
      receipt.id AS receipt_id
    FROM dreamer_fundraising_entries entry
    JOIN projects project
      ON project.id = entry.project_id
    JOIN users user_account
      ON user_account.id = entry.submitted_by
    LEFT JOIN LATERAL (
      SELECT id
      FROM dreamer_receipts
      WHERE fundraising_entry_id = entry.id
      ORDER BY id DESC
      LIMIT 1
    ) receipt ON TRUE
    WHERE entry.campaign_id = ${campaignId}
    ORDER BY
      CASE entry.status
        WHEN 'pending' THEN 0
        WHEN 'correction_requested' THEN 1
        ELSE 2
      END,
      entry.created_at DESC,
      entry.id DESC
    LIMIT 200
  `

  const summaryRows = await sql`
    SELECT
      COUNT(*) FILTER (
        WHERE status = 'pending'
      )::int AS pending_count,
      COUNT(*) FILTER (
        WHERE possible_duplicate = 1
        AND status = 'pending'
      )::int AS duplicate_count,
      COALESCE(
        SUM(net_amount) FILTER (
          WHERE status = 'validated'
        ),
        0
      ) AS validated_total
    FROM dreamer_fundraising_entries
    WHERE campaign_id = ${campaignId}
  `

  return {
    entries: rows,
    summary: summaryRows[0] || {
      pending_count: 0,
      duplicate_count: 0,
      validated_total: 0,
    },
  }
}

export default async function handler(
  request,
  response
) {
  const currentUser =
    await requireDreamerUser(request)

  if (!currentUser) {
    return response.status(401).json({
      error:
        'Você não possui acesso ao Sócio Sonhador.',
    })
  }

  try {
    const campaign = await getCampaign()

    if (!campaign) {
      return response.status(404).json({
        error:
          'Campanha Olimpíada Sonhadora não encontrada.',
      })
    }

    const teams = await getCampaignTeams(
      campaign.id
    )

    if (request.method === 'GET') {
      const scope = String(
        request.query?.scope || 'mine'
      )

      if (scope === 'admin') {
        if (!currentUser.isDreamerAdmin) {
          return response.status(403).json({
            error:
              'Apenas Admins do Sócio podem revisar arrecadações.',
          })
        }

        const adminData =
          await getAdminEntries(campaign.id)

        return response.status(200).json({
          campaign,
          teams,
          ...adminData,
        })
      }

      const entries = await getMyEntries({
        campaignId: campaign.id,
        userId: currentUser.id,
      })

      return response.status(200).json({
        campaign,
        teams,
        entries,
      })
    }

    if (request.method !== 'POST') {
      return response.status(405).json({
        error: 'Método não permitido.',
      })
    }

    const body = request.body ?? {}
    const operation = body.operation

    if (operation === 'prepare-receipt') {
      const contentType = String(
        body.contentType || ''
      ).toLowerCase()

      if (
        !ALLOWED_RECEIPT_TYPES.has(
          contentType
        )
      ) {
        return response.status(400).json({
          error:
            'Use JPG, PNG, WebP ou PDF como comprovante.',
        })
      }

      const projectId = Number(body.projectId)
      const team = teams.find(
        item =>
          Number(item.project_id) ===
          projectId
      )

      if (!team) {
        return response.status(400).json({
          error: 'Equipe inválida.',
        })
      }

      const supabase = getSupabaseAdmin()
      await ensurePrivateBucket(supabase)

      const extension =
        extensionForType(contentType)
      const storagePath = [
        'dreamer',
        `campaign-${campaign.id}`,
        `project-${projectId}`,
        `user-${currentUser.id}`,
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
        signedUrl: data.signedUrl,
      })
    }

    if (operation === 'create') {
      if (
        Number(
          campaign.allows_external_entries
        ) !== 1
      ) {
        return response.status(409).json({
          error:
            'Esta campanha não aceita arrecadações externas.',
        })
      }

      const projectId = Number(body.projectId)
      const grossAmount = cleanMoney(
        body.grossAmount
      )
      const costAmount = cleanMoney(
        body.costAmount || 0
      )
      const initiativeType = String(
        body.initiativeType || ''
      ).trim()
      const title = String(
        body.title || ''
      ).trim()
      const notes = String(
        body.notes || ''
      ).trim()
      const receivedAt = String(
        body.receivedAt || ''
      ).trim()
      const storagePath = String(
        body.storagePath || ''
      ).trim()

      const team = teams.find(
        item =>
          Number(item.project_id) ===
          projectId
      )

      if (!team) {
        return response.status(400).json({
          error: 'Equipe inválida.',
        })
      }

      if (
        !INITIATIVE_TYPES.has(initiativeType) ||
        !title ||
        title.length > 120 ||
        notes.length > 500 ||
        !Number.isFinite(grossAmount) ||
        grossAmount <= 0 ||
        !Number.isFinite(costAmount) ||
        costAmount < 0 ||
        costAmount > grossAmount
      ) {
        return response.status(400).json({
          error:
            'Preencha iniciativa, título e valores corretamente.',
        })
      }

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
          receivedAt
        ) ||
        receivedAt > new Date().toISOString().slice(0, 10)
      ) {
        return response.status(400).json({
          error:
            'Informe uma data válida, sem usar uma data futura.',
        })
      }

      const expectedPrefix =
        `dreamer/campaign-${campaign.id}/project-${projectId}/user-${currentUser.id}/`

      if (
        !storagePath.startsWith(
          expectedPrefix
        )
      ) {
        return response.status(400).json({
          error:
            'Envie um comprovante válido antes de registrar.',
        })
      }

      const exists =
        await storageFileExists(storagePath)

      if (!exists) {
        return response.status(400).json({
          error:
            'O comprovante ainda não chegou ao armazenamento.',
        })
      }

      const fileHash =
        await hashStoredReceipt(storagePath)

      const duplicateRows = await sql`
        SELECT id
        FROM dreamer_receipts
        WHERE file_hash = ${fileHash}
        LIMIT 1
      `

      const possibleDuplicate =
        duplicateRows.length > 0 ? 1 : 0
      const netAmount = cleanMoney(
        grossAmount - costAmount
      )

      const entryRows = await sql`
        INSERT INTO dreamer_fundraising_entries (
          campaign_id,
          project_id,
          submitted_by,
          initiative_type,
          title,
          gross_amount,
          cost_amount,
          net_amount,
          received_at,
          notes,
          status,
          possible_duplicate,
          updated_at
        )
        VALUES (
          ${campaign.id},
          ${projectId},
          ${currentUser.id},
          ${initiativeType},
          ${title},
          ${grossAmount},
          ${costAmount},
          ${netAmount},
          ${receivedAt},
          ${notes},
          'pending',
          ${possibleDuplicate},
          CURRENT_TIMESTAMP
        )
        RETURNING id
      `

      const entryId = Number(
        entryRows[0]?.id
      )

      await sql`
        INSERT INTO dreamer_receipts (
          fundraising_entry_id,
          file_url,
          file_hash
        )
        VALUES (
          ${entryId},
          ${storagePath},
          ${fileHash}
        )
      `

      return response.status(201).json({
        success: true,
        entryId,
        possibleDuplicate:
          Boolean(possibleDuplicate),
        message:
          possibleDuplicate
            ? 'Arrecadação enviada para revisão. O comprovante foi sinalizado para conferência de possível duplicidade.'
            : 'Arrecadação enviada para validação do Admin Sócio. ❤️',
      })
    }

    if (operation === 'resubmit') {
      const entryId = Number(body.entryId)
      const projectId = Number(body.projectId)
      const grossAmount = cleanMoney(body.grossAmount)
      const costAmount = cleanMoney(body.costAmount || 0)
      const initiativeType = String(
        body.initiativeType || ''
      ).trim()
      const title = String(body.title || '').trim()
      const notes = String(body.notes || '').trim()
      const receivedAt = String(
        body.receivedAt || ''
      ).trim()
      const storagePath = String(
        body.storagePath || ''
      ).trim()

      const team = teams.find(
        item => Number(item.project_id) === projectId
      )

      if (!Number.isInteger(entryId) || !team) {
        return response.status(400).json({
          error: 'Arrecadação ou equipe inválida.',
        })
      }

      if (
        !INITIATIVE_TYPES.has(initiativeType) ||
        !title ||
        title.length > 120 ||
        notes.length > 500 ||
        !Number.isFinite(grossAmount) ||
        grossAmount <= 0 ||
        !Number.isFinite(costAmount) ||
        costAmount < 0 ||
        costAmount > grossAmount
      ) {
        return response.status(400).json({
          error:
            'Preencha iniciativa, título e valores corretamente.',
        })
      }

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(receivedAt) ||
        receivedAt > new Date().toISOString().slice(0, 10)
      ) {
        return response.status(400).json({
          error:
            'Informe uma data válida, sem usar uma data futura.',
        })
      }

      const existing = await sql`
        SELECT id
        FROM dreamer_fundraising_entries
        WHERE
          id = ${entryId}
          AND campaign_id = ${campaign.id}
          AND submitted_by = ${currentUser.id}
          AND status = 'correction_requested'
        LIMIT 1
      `

      if (!existing[0]) {
        return response.status(409).json({
          error:
            'Este registro não está disponível para correção.',
        })
      }

      const expectedPrefix =
        `dreamer/campaign-${campaign.id}/project-${projectId}/user-${currentUser.id}/`

      if (!storagePath.startsWith(expectedPrefix)) {
        return response.status(400).json({
          error:
            'Envie um novo comprovante válido antes de reenviar.',
        })
      }

      const exists = await storageFileExists(storagePath)
      if (!exists) {
        return response.status(400).json({
          error:
            'O comprovante ainda não chegou ao armazenamento.',
        })
      }

      const fileHash =
        await hashStoredReceipt(storagePath)

      const duplicateRows = await sql`
        SELECT receipt.id
        FROM dreamer_receipts receipt
        WHERE
          receipt.file_hash = ${fileHash}
          AND receipt.fundraising_entry_id <> ${entryId}
        LIMIT 1
      `

      const possibleDuplicate = duplicateRows.length > 0 ? 1 : 0
      const netAmount = cleanMoney(grossAmount - costAmount)

      const updated = await sql`
        UPDATE dreamer_fundraising_entries
        SET
          project_id = ${projectId},
          initiative_type = ${initiativeType},
          title = ${title},
          gross_amount = ${grossAmount},
          cost_amount = ${costAmount},
          net_amount = ${netAmount},
          received_at = ${receivedAt},
          notes = ${notes},
          status = 'pending',
          possible_duplicate = ${possibleDuplicate},
          reviewed_by = NULL,
          review_reason = '',
          reviewed_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE
          id = ${entryId}
          AND campaign_id = ${campaign.id}
          AND submitted_by = ${currentUser.id}
          AND status = 'correction_requested'
        RETURNING id
      `

      if (!updated[0]) {
        return response.status(409).json({
          error:
            'A arrecadação mudou de status. Atualize a página e tente novamente.',
        })
      }

      await sql`
        INSERT INTO dreamer_receipts (
          fundraising_entry_id,
          file_url,
          file_hash
        )
        VALUES (
          ${entryId},
          ${storagePath},
          ${fileHash}
        )
      `

      return response.status(200).json({
        success: true,
        possibleDuplicate: Boolean(possibleDuplicate),
        message: possibleDuplicate
          ? 'Correção reenviada. O novo comprovante foi sinalizado para conferência de possível duplicidade.'
          : 'Correção reenviada para validação do Admin Sócio. ❤️',
      })
    }

    if (operation === 'receipt-url') {
      const receiptId = Number(body.receiptId)

      if (!Number.isInteger(receiptId)) {
        return response.status(400).json({
          error: 'Comprovante inválido.',
        })
      }

      const receipts = await sql`
        SELECT
          receipt.file_url,
          entry.submitted_by
        FROM dreamer_receipts receipt
        LEFT JOIN dreamer_fundraising_entries entry
          ON entry.id = receipt.fundraising_entry_id
        WHERE receipt.id = ${receiptId}
        LIMIT 1
      `

      const receipt = receipts[0]

      if (!receipt) {
        return response.status(404).json({
          error:
            'Comprovante não encontrado.',
        })
      }

      if (
        !currentUser.isDreamerAdmin &&
        Number(receipt.submitted_by) !==
          Number(currentUser.id)
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
            receipt.file_url,
            10 * 60
          )

      if (error) throw error

      return response.status(200).json({
        success: true,
        signedUrl: data.signedUrl,
      })
    }

    if (operation === 'review') {
      if (!currentUser.isDreamerAdmin) {
        return response.status(403).json({
          error:
            'Apenas Admins do Sócio podem revisar arrecadações.',
        })
      }

      const entryId = Number(body.entryId)
      const decision = String(
        body.decision || ''
      ).trim()
      const reviewReason = String(
        body.reviewReason || ''
      ).trim()

      if (
        !Number.isInteger(entryId) ||
        !REVIEW_STATUSES.has(decision)
      ) {
        return response.status(400).json({
          error: 'Revisão inválida.',
        })
      }

      if (
        decision !== 'validated' &&
        !reviewReason
      ) {
        return response.status(400).json({
          error:
            'Informe o motivo para reprovar ou pedir correção.',
        })
      }

      const rows = await sql`
        UPDATE dreamer_fundraising_entries
        SET
          status = ${decision},
          reviewed_by = ${currentUser.id},
          review_reason = ${reviewReason},
          reviewed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE
          id = ${entryId}
          AND campaign_id = ${campaign.id}
          AND status = 'pending'
        RETURNING id
      `

      if (!rows[0]) {
        return response.status(409).json({
          error:
            'Esta arrecadação já foi revisada ou não está disponível.',
        })
      }

      return response.status(200).json({
        success: true,
        message:
          decision === 'validated'
            ? 'Arrecadação validada e incluída no placar oficial.'
            : decision === 'correction_requested'
              ? 'Correção solicitada ao responsável.'
              : 'Arrecadação reprovada.',
      })
    }

    return response.status(400).json({
      error:
        'Operação de arrecadação inválida.',
    })
  } catch (error) {
    console.error(
      'Dreamer fundraising error:',
      error
    )

    return response.status(500).json({
      error:
        'Não foi possível processar a arrecadação agora.',
    })
  }
}

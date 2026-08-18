import process from 'node:process'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, sql } from './_admin.js'

const ALLOWED_TYPES = new Set([
  'image/jpeg',
])

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase Storage environment variables are missing.'
    )
  }

  return createClient(
    url,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}

function getBucket() {
  return (
    process.env.SUPABASE_BUCKET ||
    'central-sonhar'
  )
}

function getFolder(target) {
  return target === 'avatar'
    ? 'avatars'
    : 'events'
}

function isValidTarget(target) {
  return ['avatar', 'event']
    .includes(target)
}

async function recordExists(
  target,
  recordId
) {
  if (target === 'avatar') {
    const users = await sql`
      SELECT id
      FROM users
      WHERE id = ${recordId}
      LIMIT 1
    `

    return Boolean(users[0])
  }

  const events = await sql`
    SELECT id
    FROM events
    WHERE id = ${recordId}
    LIMIT 1
  `

  return Boolean(events[0])
}

// =========================================================
// PREPARE SIGNED UPLOAD
// =========================================================

async function prepareUpload({
  target,
  recordId,
  contentType,
}) {
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error(
      'A imagem processada precisa ser JPEG.'
    )
  }

  const exists =
    await recordExists(
      target,
      recordId
    )

  if (!exists) {
    const error =
      new Error(
        target === 'avatar'
          ? 'Usuário não encontrado.'
          : 'Evento não encontrado.'
      )

    error.statusCode = 404
    throw error
  }

  const folder =
    getFolder(target)

  const fileName =
    `${recordId}-${Date.now()}-${crypto.randomUUID()}.jpg`

  const storagePath =
    `${folder}/${fileName}`

  const supabase =
    getSupabaseAdmin()

  const bucket =
    getBucket()

  const {
    data,
    error,
  } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(
      storagePath,
      {
        upsert: false,
      }
    )

  if (error) {
    throw error
  }

  return {
    bucket,
    storagePath,
    signedUrl:
      data.signedUrl,
  }
}

// =========================================================
// FINALIZE UPLOAD
// =========================================================

async function finalizeUpload({
  target,
  recordId,
  storagePath,
}) {
  const expectedFolder =
    getFolder(target)

  const expectedPrefix =
    `${expectedFolder}/${recordId}-`

  if (
    typeof storagePath !== 'string' ||
    !storagePath.startsWith(
      expectedPrefix
    ) ||
    !storagePath.endsWith('.jpg')
  ) {
    const error =
      new Error(
        'Caminho da imagem inválido.'
      )

    error.statusCode = 400
    throw error
  }

  const supabase =
    getSupabaseAdmin()

  const bucket =
    getBucket()

  // Confirm that the object really exists before
  // storing its URL in Neon.
  const fileName =
    storagePath.split('/').pop()

  const folder =
    storagePath
      .split('/')
      .slice(0, -1)
      .join('/')

  const {
    data: files,
    error: listError,
  } = await supabase.storage
    .from(bucket)
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
        file.name === fileName
    )

  if (!exists) {
    const error =
      new Error(
        'O arquivo ainda não chegou ao Storage.'
      )

    error.statusCode = 400
    throw error
  }

  const {
    data: publicData,
  } = supabase.storage
    .from(bucket)
    .getPublicUrl(
      storagePath
    )

  const publicUrl =
    publicData.publicUrl

  if (target === 'avatar') {
    const updated = await sql`
      UPDATE users
      SET avatar_path = ${publicUrl}
      WHERE id = ${recordId}
      RETURNING id
    `

    if (!updated[0]) {
      throw new Error(
        'Usuário não encontrado.'
      )
    }
  }

  if (target === 'event') {
    const updated = await sql`
      UPDATE events
      SET event_image_path = ${publicUrl}
      WHERE id = ${recordId}
      RETURNING id
    `

    if (!updated[0]) {
      throw new Error(
        'Evento não encontrado.'
      )
    }
  }

  return {
    publicUrl,
  }
}

export default async function handler(
  request,
  response
) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error:
        'Method not allowed.',
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

  try {
    const {
      stage,
      target,
      id,
      contentType,
      storagePath,
    } = request.body ?? {}

    const recordId =
      Number(id)

    if (
      !isValidTarget(target) ||
      !Number.isInteger(recordId) ||
      recordId < 1
    ) {
      return response.status(400).json({
        error:
          'Destino da imagem inválido.',
      })
    }

    if (stage === 'prepare') {
      const prepared =
        await prepareUpload({
          target,
          recordId,
          contentType,
        })

      return response
        .status(200)
        .json({
          success: true,
          ...prepared,
        })
    }

    if (stage === 'complete') {
      const completed =
        await finalizeUpload({
          target,
          recordId,
          storagePath,
        })

      return response
        .status(200)
        .json({
          success: true,
          url:
            completed.publicUrl,

          message:
            target === 'avatar'
              ? 'Avatar atualizado! 📸'
              : 'Capa do evento atualizada! 🎨',
        })
    }

    return response.status(400).json({
      error:
        'Etapa do upload inválida.',
    })
  } catch (error) {
    console.error(
      'Admin upload error:',
      error
    )

    return response
      .status(
        error.statusCode || 500
      )
      .json({
        error:
          error.message ||
          'Não foi possível enviar a imagem.',
      })
  }
}

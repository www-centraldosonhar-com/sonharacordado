import process from 'node:process'
import { Buffer } from 'node:buffer'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin, sql } from './_admin.js'

const MAX_FILE_SIZE = 5 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
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

function getExtension(contentType) {
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }

  return extensions[contentType]
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
}

export default async function handler(
  request,
  response
) {
  if (request.method !== 'POST') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }

  const admin = await requireAdmin(request)

  if (!admin) {
    return response.status(403).json({
      error:
        'Acesso administrativo não autorizado.',
    })
  }

  try {
    const {
      target,
      id,
      fileName,
      contentType,
      base64,
    } = request.body ?? {}

    const recordId = Number(id)

    if (
      !['avatar', 'event'].includes(target) ||
      !Number.isInteger(recordId) ||
      recordId < 1
    ) {
      return response.status(400).json({
        error: 'Destino da imagem inválido.',
      })
    }

    if (
      !fileName ||
      !base64 ||
      !ALLOWED_TYPES.has(contentType)
    ) {
      return response.status(400).json({
        error:
          'Envie uma imagem JPG, PNG ou WebP.',
      })
    }

    const buffer =
      Buffer.from(base64, 'base64')

    if (
      buffer.length === 0 ||
      buffer.length > MAX_FILE_SIZE
    ) {
      return response.status(400).json({
        error:
          'A imagem deve ter no máximo 5 MB.',
      })
    }

    const extension =
      getExtension(contentType)

    const folder =
      target === 'avatar'
        ? 'avatars'
        : 'events'

    const storagePath =
      `${folder}/${recordId}-${Date.now()}.${extension}`

    const supabase =
      getSupabaseAdmin()

    const bucket =
      process.env.SUPABASE_BUCKET ||
      'central-sonhar'

    const {
      error: uploadError,
    } = await supabase.storage
      .from(bucket)
      .upload(
        storagePath,
        buffer,
        {
          contentType,
          upsert: false,
        }
      )

    if (uploadError) {
      throw uploadError
    }

    const {
      data: publicData,
    } = supabase.storage
      .from(bucket)
      .getPublicUrl(storagePath)

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
        await supabase.storage
          .from(bucket)
          .remove([storagePath])

        return response.status(404).json({
          error: 'Usuário não encontrado.',
        })
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
        await supabase.storage
          .from(bucket)
          .remove([storagePath])

        return response.status(404).json({
          error: 'Evento não encontrado.',
        })
      }
    }

    return response.status(200).json({
      success: true,
      url: publicUrl,
      message:
        target === 'avatar'
          ? 'Avatar atualizado! 📸'
          : 'Capa do evento atualizada! 🎨',
    })
  } catch (error) {
    console.error(
      'Admin upload error:',
      error
    )

    return response.status(500).json({
      error:
        process.env.NODE_ENV === 'production'
          ? 'Não foi possível enviar a imagem.'
          : `Não foi possível enviar a imagem: ${error.message}`,
    })
  }
}

import { useState } from 'react'

import {
  supabase,
} from '../services/supabase'

import {
  processAdminImage,
} from '../utils/adminImageProcessor'

function AdminImageUpload({
  target,
  id,
  label,
  onUpdated,
}) {
  const [isLoading, setIsLoading] =
    useState(false)

  const [message, setMessage] =
    useState('')

  function formatMb(bytes) {
    return (
      bytes /
      1024 /
      1024
    ).toFixed(2)
  }

  async function handleFile(event) {
    const input =
      event.target

    const originalFile =
      input.files?.[0]

    if (!originalFile) {
      return
    }

    setIsLoading(true)

    try {
      // ===================================================
      // 1. PROCESS IMAGE LOCALLY
      // ===================================================

      setMessage(
        '✨ Otimizando imagem...'
      )

      const processedFile =
        await processAdminImage(
          originalFile,
          target
        )

      setMessage(
        `✨ ${formatMb(originalFile.size)} MB → ${formatMb(processedFile.size)} MB`
      )

      // ===================================================
      // 2. ASK SERVER FOR SIGNED UPLOAD TOKEN
      // ===================================================

      setMessage(
        '🔐 Preparando envio seguro...'
      )

      const prepareResponse =
        await fetch(
          '/api/upload',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                stage:
                  'prepare',

                target,
                id,

                contentType:
                  processedFile.type,
              }),
          }
        )

      const prepareResult =
        await prepareResponse.json()

      if (!prepareResponse.ok) {
        throw new Error(
          prepareResult.error ||
          'Não foi possível preparar o upload.'
        )
      }

      // ===================================================
      // 3. DIRECT BROWSER -> SUPABASE STORAGE
      // ===================================================
      // The image no longer passes through the Vercel
      // Function as Base64.
      // ===================================================

      setMessage(
        '☁️ Enviando imagem...'
      )

      const {
        error: uploadError,
      } = await supabase.storage
        .from(
          prepareResult.bucket
        )
        .uploadToSignedUrl(
          prepareResult.storagePath,
          prepareResult.token,
          processedFile,
          {
            contentType:
              'image/jpeg',
          }
        )

      if (uploadError) {
        throw uploadError
      }

      // ===================================================
      // 4. CONFIRM UPLOAD AND SAVE URL IN NEON
      // ===================================================

      setMessage(
        '💾 Salvando imagem...'
      )

      const completeResponse =
        await fetch(
          '/api/upload',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                stage:
                  'complete',

                target,
                id,

                storagePath:
                  prepareResult.storagePath,
              }),
          }
        )

      const completeResult =
        await completeResponse.json()

      if (!completeResponse.ok) {
        throw new Error(
          completeResult.error ||
          'A imagem foi enviada, mas não foi possível salvá-la.'
        )
      }

      setMessage(
        `✅ ${completeResult.message}`
      )

      await onUpdated()
    } catch (error) {
      console.error(
        'Admin image upload error:',
        error
      )

      setMessage(
        error.message ||
        'Não foi possível enviar esta imagem.'
      )
    } finally {
      setIsLoading(false)
      input.value = ''
    }
  }

  return (
    <div className="admin-image-upload">
      <label>
        {isLoading
          ? 'Processando imagem...'
          : label}

        <input
          type="file"
          accept="image/*,.heic,.heif"
          disabled={isLoading}
          onChange={handleFile}
        />
      </label>

      {message && (
        <p className="admin-action-message">
          {message}
        </p>
      )}
    </div>
  )
}

export default AdminImageUpload

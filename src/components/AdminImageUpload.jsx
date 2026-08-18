import { useState } from 'react'

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
    setMessage('✨ Otimizando imagem...')

    try {
      // ===================================================
      // 1. PROCESS LOCALLY
      // ===================================================

      const processedFile =
        await processAdminImage(
          originalFile,
          target
        )

      setMessage(
        `✨ ${formatMb(originalFile.size)} MB → ${formatMb(processedFile.size)} MB`
      )

      // ===================================================
      // 2. REQUEST TEMPORARY SIGNED URL
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
                stage: 'prepare',
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
          `PREPARE: ${
            prepareResult.error ||
            'Não foi possível preparar o upload.'
          }`
        )
      }

      if (!prepareResult.signedUrl) {
        throw new Error(
          'PREPARE: O servidor não retornou a URL de upload.'
        )
      }

      // ===================================================
      // 3. DIRECT UPLOAD
      // ===================================================
      // Mirrors Supabase uploadToSignedUrl behavior for
      // Blob/File: multipart FormData + PUT.
      // ===================================================

      setMessage(
        '☁️ Enviando imagem...'
      )

      const formData =
        new FormData()

      formData.append(
        'cacheControl',
        '3600'
      )

      formData.append(
        '',
        processedFile
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
        let details = ''

        try {
          const errorData =
            await uploadResponse.json()

          details =
            errorData?.message ||
            errorData?.error ||
            ''
        } catch {
          details =
            await uploadResponse.text()
        }

        throw new Error(
          `UPLOAD: ${
            details ||
            `HTTP ${uploadResponse.status}`
          }`
        )
      }

      // ===================================================
      // 4. SAVE PUBLIC URL IN NEON
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
                stage: 'complete',
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
          `COMPLETE: ${
            completeResult.error ||
            'Não foi possível registrar a imagem.'
          }`
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

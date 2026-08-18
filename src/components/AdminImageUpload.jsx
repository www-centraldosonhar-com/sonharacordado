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

  async function fileToBase64(file) {
    const buffer =
      await file.arrayBuffer()

    const bytes =
      new Uint8Array(buffer)

    let binary = ''

    for (
      let index = 0;
      index < bytes.length;
      index += 1
    ) {
      binary +=
        String.fromCharCode(
          bytes[index]
        )
    }

    return window.btoa(binary)
  }

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

    const file =
      input.files?.[0]

    if (!file) {
      return
    }

    setIsLoading(true)

    setMessage(
      '✨ Preparando imagem...'
    )

    try {
      // ===================================================
      // AUTOMATIC PROCESSING
      // ===================================================

      const processedFile =
        await processAdminImage(
          file,
          target
        )

      setMessage(
        `✨ Imagem otimizada: ${formatMb(file.size)} MB → ${formatMb(processedFile.size)} MB`
      )

      // ===================================================
      // EXTRA SAFETY
      // ===================================================
      // Server currently accepts up to 3 MB.
      // The processor targets considerably less than that.
      // ===================================================

      if (
        processedFile.size >
        3 * 1024 * 1024
      ) {
        throw new Error(
          'Não foi possível reduzir a imagem para menos de 3 MB.'
        )
      }

      const base64 =
        await fileToBase64(
          processedFile
        )

      setMessage(
        '☁️ Enviando imagem...'
      )

      const response =
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
                target,
                id,

                fileName:
                  processedFile.name,

                contentType:
                  processedFile.type,

                base64,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
            'Não foi possível enviar a imagem.'
        )
      }

      setMessage(
        `✅ ${result.message}`
      )

      await onUpdated()
    } catch (error) {
      console.error(
        'Admin image upload error:',
        error
      )

      setMessage(
        error.message ||
          'Não foi possível preparar esta imagem.'
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

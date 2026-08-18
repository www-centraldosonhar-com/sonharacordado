import { useState } from 'react'

function AdminImageUpload({
  target,
  id,
  label,
  onUpdated,
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function fileToBase64(file) {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    let binary = ''

    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index])
    }

    return window.btoa(binary)
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setMessage('')

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowedTypes.includes(file.type)) {
      setMessage('Use uma imagem JPG, PNG ou WebP.')
      event.target.value = ''
      return
    }

    if (file.size > 3 * 1024 * 1024) {
      setMessage('A imagem deve ter no máximo 3 MB.')
      event.target.value = ''
      return
    }

    setIsLoading(true)

    try {
      const base64 = await fileToBase64(file)

      const response = await fetch('/api/admin-upload', {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          target,
          id,
          fileName: file.name,
          contentType: file.type,
          base64,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível enviar a imagem.'
        )
      }

      setMessage(result.message)

      await onUpdated()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setIsLoading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="admin-image-upload">
      <label>
        {isLoading
          ? 'Enviando imagem...'
          : label}

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
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

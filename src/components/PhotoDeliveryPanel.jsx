import {
  useEffect,
  useState,
} from 'react'

import {
  formatFileSize,
  processPhoto,
} from '../utils/photoProcessor'

import {
  connectGoogleDrive,
  driveFileExists,
  getEventDriveFolder,
  uploadPhotoToDrive,
} from '../services/googleDrive'

const WATERMARK_URL =
  '/watermark.png'

function PhotoDeliveryPanel({
  event,
  photographerName,
}) {
  const [
    driveAccessToken,
    setDriveAccessToken,
  ] = useState(null)

  const [
    isConnectingDrive,
    setIsConnectingDrive,
  ] = useState(false)

  const [
    driveMessage,
    setDriveMessage,
  ] = useState('')

  const [
    isUploadingDrive,
    setIsUploadingDrive,
  ] = useState(false)

  const [
    driveUploadProgress,
    setDriveUploadProgress,
  ] = useState({
    current: 0,
    total: 0,
  })

  const [
    eventDriveFolder,
    setEventDriveFolder,
  ] = useState(null)
  async function handleConnectDrive() {
    try {
      setIsConnectingDrive(true)
      setDriveMessage('')

      const authorization =
        await connectGoogleDrive()

      setDriveAccessToken(
        authorization.accessToken
      )

      setDriveMessage(
        'Google Drive conectado! ☁️✅'
      )
    } catch (error) {
      console.error(
        'Google Drive connection error:',
        error
      )

      setDriveMessage(
        error.message ||
          'Não foi possível conectar ao Google Drive.'
      )
    } finally {
      setIsConnectingDrive(false)
    }
  }

  async function handleUploadDrive() {
    if (!driveAccessToken) {
      setDriveMessage(
        'Conecte o Google Drive primeiro.'
      )

      return
    }

    if (processedPhotos.length === 0) {
      setDriveMessage(
        'Prepare as fotos antes do envio.'
      )

      return
    }

    try {
      setIsUploadingDrive(true)

      setDriveMessage(
        'Preparando pasta do evento...'
      )

      setDriveUploadProgress({
        current: 0,
        total:
          processedPhotos.length,
      })

      const folder =
        await getEventDriveFolder(
          driveAccessToken,
          event.name,
          photographerName
        )

      // Memories points to the whole event,
      // while uploads go to this photographer's folder.
      setEventDriveFolder(
        folder.eventFolder
      )

      let uploadedCount = 0
      let duplicateCount = 0

      for (
        let index = 0;
        index < processedPhotos.length;
        index += 1
      ) {
        const photo =
          processedPhotos[index]

        setDriveMessage(
          `Verificando foto ${index + 1} de ${processedPhotos.length}...`
        )

        const alreadyExists =
          await driveFileExists(
            driveAccessToken,
            folder.photographerFolder.id,
            photo.fileName
          )

        if (alreadyExists) {
          duplicateCount += 1
        } else {
          setDriveMessage(
            `Enviando foto ${index + 1} de ${processedPhotos.length}...`
          )

          await uploadPhotoToDrive(
            driveAccessToken,
            folder.photographerFolder.id,
            photo
          )

          uploadedCount += 1
        }

        setDriveUploadProgress({
          current:
            index + 1,

          total:
            processedPhotos.length,
        })
      }

      // ===================================================
      // SAVE EVENT DRIVE FOLDER IN THE DATABASE
      // ===================================================
      // After every photo has been uploaded successfully,
      // link this Google Drive folder to the event.
      // This allows the Memories section to keep the folder
      // available even after the page is refreshed.
      // ===================================================

      setDriveMessage(
        'Fotos enviadas! Vinculando ao evento...'
      )

      const saveResponse =
        await fetch(
          '/api/volunteer?action=save-event-drive',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              eventId:
                event.id,

              driveLink:
                folder.eventFolder.webViewLink,
            }),
          }
        )

      const saveResult =
        await saveResponse.json()

      if (!saveResponse.ok) {
        throw new Error(
          saveResult.error ||
            'As fotos foram enviadas, mas não foi possível vinculá-las ao evento.'
        )
      }

      const duplicateText =
        duplicateCount > 0
          ? ` • ${duplicateCount} duplicada(s) ignorada(s)`
          : ''

      setDriveMessage(
        `${uploadedCount} nova(s) foto(s) enviada(s) 📸✅${duplicateText}`
      )
    } catch (error) {
      console.error(
        'Google Drive upload error:',
        error
      )

      setDriveMessage(
        error.message ||
          'Não foi possível enviar as fotos.'
      )
    } finally {
      setIsUploadingDrive(false)
    }
  }

  const [files, setFiles] =
    useState([])

  const [
    processedPhotos,
    setProcessedPhotos,
  ] = useState([])

  const [
    isProcessing,
    setIsProcessing,
  ] = useState(false)

  const [
    progress,
    setProgress,
  ] = useState({
    current: 0,
    total: 0,
  })

  const [
    message,
    setMessage,
  ] = useState('')

  // Clean preview URLs when the component
  // is removed to avoid browser memory leaks.
  useEffect(() => {
    return () => {
      processedPhotos.forEach(
        (photo) => {
          if (photo.previewUrl) {
            URL.revokeObjectURL(
              photo.previewUrl
            )
          }
        }
      )
    }
  }, [processedPhotos])


  function handleSelect(eventChange) {
    const selectedFiles =
      Array.from(
        eventChange.target.files || []
      )

    processedPhotos.forEach(
      (photo) => {
        if (photo.previewUrl) {
          URL.revokeObjectURL(
            photo.previewUrl
          )
        }
      }
    )

    setFiles(selectedFiles)
    setProcessedPhotos([])
    setMessage('')
  }


  async function handleProcess() {
    if (files.length === 0) {
      setMessage(
        'Selecione pelo menos uma foto.'
      )

      return
    }

    setIsProcessing(true)
    setMessage('')

    setProgress({
      current: 0,
      total: files.length,
    })

    const results = []

    try {
      // Process sequentially instead of all at once.
      // This prevents large batches from exhausting
      // the phone/computer memory.
      for (
        let index = 0;
        index < files.length;
        index += 1
      ) {
        const file =
          files[index]

        const processed =
          await processPhoto(
            file,
            WATERMARK_URL
          )

        results.push({
          ...processed,

          previewUrl:
            URL.createObjectURL(
              processed.blob
            ),
        })

        setProgress({
          current:
            index + 1,

          total:
            files.length,
        })
      }

      setProcessedPhotos(
        results
      )

      setMessage(
        `${results.length} foto(s) preparada(s) com sucesso. 📸`
      )
    } catch (error) {
      results.forEach(
        (photo) => {
          if (photo.previewUrl) {
            URL.revokeObjectURL(
              photo.previewUrl
            )
          }
        }
      )

      setMessage(
        error.message
      )
    } finally {
      setIsProcessing(false)
    }
  }


  return (
    <section className="photo-delivery-panel">
      <div className="section-heading">
        <p className="eyebrow eyebrow-blue">
          ENTREGA DE FOTOGRAFIA
        </p>

        <h2>
          📸 Fotos do evento
        </h2>

        <p className="photo-event-name">
          {event.name}
        </p>
      </div>

      <div className="photo-upload-box">
        <label className="photo-file-picker">
          <span className="photo-picker-icon">
            📁
          </span>

          <strong>
            Selecionar fotos
          </strong>

          <small>
            JPG, PNG ou outras imagens
            compatíveis com o navegador
          </small>

          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleSelect}
          />
        </label>

        {files.length > 0 && (
          <div className="photo-selected-summary">
            <strong>
              {files.length}
            </strong>

            <span>
              foto
              {files.length !== 1
                ? 's'
                : ''}
              {' '}
              selecionada
              {files.length !== 1
                ? 's'
                : ''}
            </span>
          </div>
        )}

        <button
          type="button"
          className="primary-button"
          disabled={
            isProcessing ||
            files.length === 0
          }
          onClick={
            handleProcess
          }
        >
          {isProcessing
            ? `Preparando ${progress.current}/${progress.total}...`
            : 'Preparar fotos ✨'}
        </button>
      </div>

      {isProcessing && (
        <div className="photo-progress">
          <div
            className="photo-progress-bar"
            style={{
              width:
                progress.total > 0
                  ? `${
                      (
                        progress.current /
                        progress.total
                      ) * 100
                    }%`
                  : '0%',
            }}
          />
        </div>
      )}

      {message && (
        <p className="action-message">
          {message}
        </p>
      )}

      {processedPhotos.length > 0 && (
        <>
          <div className="photo-processing-summary">
            <div>
              <strong>
                Fotos prontas ✅
              </strong>

              <span>
                JPEG 92% +
                marca d'água
              </span>
            </div>
          </div>

          <div className="photo-preview-grid">
            {processedPhotos
              .slice(0, 6)
              .map(
                (
                  photo,
                  index
                ) => (
                  <article
                    className="photo-preview-card"
                    key={
                      `${photo.fileName}-${index}`
                    }
                  >
                    <img
                      src={
                        photo.previewUrl
                      }
                      alt={
                        photo.fileName
                      }
                    />

                    <div>
                      <strong>
                        {
                          photo.fileName
                        }
                      </strong>

                      <small>
                        {
                          formatFileSize(
                            photo.originalSize
                          )
                        }
                        {' → '}
                        {
                          formatFileSize(
                            photo.finalSize
                          )
                        }
                      </small>

                      <small>
                        {photo.width}
                        ×
                        {photo.height}
                      </small>
                    </div>
                  </article>
                )
              )}
          </div>

          {processedPhotos.length > 6 && (
            <p className="photo-more-text">
              +{' '}
              {
                processedPhotos.length -
                6
              }
              {' '}
              foto(s) preparada(s)
            </p>
          )}

          {!driveAccessToken ? (
            <button
              type="button"
              className="secondary-button"
              disabled={
                isConnectingDrive
              }
              onClick={
                handleConnectDrive
              }
            >
              {isConnectingDrive
                ? 'Conectando...'
                : '☁️ Conectar Google Drive'}
            </button>
          ) : (
            <button
              type="button"
              className="secondary-button"
              disabled={
                isUploadingDrive
              }
              onClick={
                handleUploadDrive
              }
            >
              {isUploadingDrive
                ? `☁️ Enviando ${driveUploadProgress.current}/${driveUploadProgress.total}...`
                : '☁️ Enviar fotos para o Google Drive'}
            </button>
          )}

          {driveMessage && (
            <p className="action-message">
              {driveMessage}
            </p>
          )}

          {eventDriveFolder?.webViewLink && (
            <a
              className="secondary-button"
              href={
                eventDriveFolder.webViewLink
              }
              target="_blank"
              rel="noreferrer"
            >
              📁 Abrir pasta do evento
            </a>
          )}

          <p className="photo-drive-note">
            Vamos ativar o envio para o
            Drive depois de aprovarmos a
            qualidade das imagens.
          </p>
        </>
      )}
    </section>
  )
}

export default PhotoDeliveryPanel

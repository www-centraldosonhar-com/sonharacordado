// =========================================================
// PHOTO PROCESSOR
// Runs entirely inside the volunteer's browser.
//
// Flow:
// Original image
//   → resize if necessary
//   → draw watermark
//   → convert to JPEG 92%
//   → return optimized Blob
//
// The original file is NEVER modified.
// =========================================================

const DEFAULT_OPTIONS = {
  maxWidth: 3200,
  quality: 0.92,

  // Watermark appearance.
  watermarkOpacity: 0.55,
  watermarkScale: 0.12,
  watermarkMargin: 32,
}


// =========================================================
// LOAD ORIGINAL IMAGE
// =========================================================

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)

      reject(
        new Error(
          `Não foi possível abrir ${file.name}.`
        )
      )
    }

    image.src = objectUrl
  })
}


// =========================================================
// LOAD PNG WATERMARK
// =========================================================

function loadWatermark(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)

    image.onerror = () => {
      reject(
        new Error(
          'Não foi possível carregar a marca d’água.'
        )
      )
    }

    image.src = url
  })
}


// =========================================================
// RESIZE WITHOUT UPSCALING
// =========================================================

function calculateSize(
  originalWidth,
  originalHeight,
  maxWidth
) {
  if (originalWidth <= maxWidth) {
    return {
      width: originalWidth,
      height: originalHeight,
    }
  }

  const ratio =
    maxWidth / originalWidth

  return {
    width:
      Math.round(
        originalWidth * ratio
      ),

    height:
      Math.round(
        originalHeight * ratio
      ),
  }
}


// =========================================================
// CANVAS → JPEG
// =========================================================

function canvasToJpeg(
  canvas,
  quality
) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error(
              'Não foi possível gerar o JPEG.'
            )
          )

          return
        }

        resolve(blob)
      },

      'image/jpeg',
      quality
    )
  })
}


// =========================================================
// PROCESS ONE PHOTO
// =========================================================

export async function processPhoto(
  file,
  watermarkUrl,
  customOptions = {}
) {
  const options = {
    ...DEFAULT_OPTIONS,
    ...customOptions,
  }

  if (!file?.type?.startsWith('image/')) {
    throw new Error(
      `${file?.name || 'Arquivo'} não é uma imagem válida.`
    )
  }

  const photo =
    await loadImageFromFile(file)

  const watermark =
    await loadWatermark(
      watermarkUrl
    )

  const size =
    calculateSize(
      photo.naturalWidth,
      photo.naturalHeight,
      options.maxWidth
    )

  const canvas =
    document.createElement('canvas')

  canvas.width = size.width
  canvas.height = size.height

  const context =
    canvas.getContext('2d')

  if (!context) {
    throw new Error(
      'Este navegador não suporta processamento de imagens.'
    )
  }

  // Draw original photo.
  context.drawImage(
    photo,
    0,
    0,
    size.width,
    size.height
  )

  // Watermark width remains proportional
  // regardless of the original photo resolution.
  const watermarkWidth =
    Math.round(
      size.width *
      options.watermarkScale
    )

  const watermarkRatio =
    watermark.naturalHeight /
    watermark.naturalWidth

  const watermarkHeight =
    Math.round(
      watermarkWidth *
      watermarkRatio
    )

  const margin =
    Math.max(
      options.watermarkMargin,
      Math.round(
        size.width * 0.012
      )
    )

  // Bottom-right corner.
  const x =
    size.width -
    watermarkWidth -
    margin

  const y =
    size.height -
    watermarkHeight -
    margin

  context.save()

  context.globalAlpha =
    options.watermarkOpacity

  context.drawImage(
    watermark,
    x,
    y,
    watermarkWidth,
    watermarkHeight
  )

  context.restore()

  const blob =
    await canvasToJpeg(
      canvas,
      options.quality
    )

  const baseName =
    file.name.replace(
      /\.[^.]+$/,
      ''
    )

  return {
    blob,

    fileName:
      `${baseName}-sonhar.jpg`,

    originalSize:
      file.size,

    finalSize:
      blob.size,

    width:
      size.width,

    height:
      size.height,

    type:
      'image/jpeg',
  }
}


// =========================================================
// FORMAT FILE SIZE
// =========================================================

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) {
    return '0 MB'
  }

  const megabytes =
    bytes / 1024 / 1024

  return `${megabytes.toFixed(2)} MB`
}

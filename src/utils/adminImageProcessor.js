// =========================================================
// ADMIN IMAGE PROCESSOR
// =========================================================
// Prepares avatars and event covers before upload.
//
// Pipeline:
// 1. Convert HEIC / HEIF to JPEG when necessary.
// 2. Decode the image in the browser.
// 3. Resize while preserving proportions.
// 4. Convert everything to JPEG.
// 5. Compress progressively.
// 6. Reduce dimensions again if necessary.
// 7. Return a lightweight JPEG ready for upload.
// =========================================================

const KB = 1024
const MB = 1024 * KB

const IMAGE_PROFILES = {
  avatar: {
    maxDimension: 800,
    targetBytes: 600 * KB,
    initialQuality: 0.9,
    minQuality: 0.42,
  },

  event: {
    maxDimension: 1920,
    targetBytes: 1.8 * MB,
    initialQuality: 0.9,
    minQuality: 0.42,
  },
}

// =========================================================
// HELPERS
// =========================================================

function isHeicFile(file) {
  const name =
    file.name?.toLowerCase() || ''

  return (
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  )
}

function createJpegName(fileName) {
  const cleanName =
    fileName
      ?.replace(/\.[^/.]+$/, '')
      .trim() ||
    'image'

  return `${cleanName}.jpg`
}

async function convertHeicToJpeg(file) {
  // Load the HEIC converter only when a HEIC/HEIF image
  // is selected. This keeps the normal Central bundle light.
  const {
    default: heic2any,
  } = await import('heic2any')

  const result =
    await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    })

  const blob =
    Array.isArray(result)
      ? result[0]
      : result

  return new File(
    [blob],
    createJpegName(file.name),
    {
      type: 'image/jpeg',
    }
  )
}

function loadImage(file) {
  return new Promise(
    (resolve, reject) => {
      const url =
        URL.createObjectURL(file)

      const image =
        new Image()

      image.onload = () => {
        URL.revokeObjectURL(url)
        resolve(image)
      }

      image.onerror = () => {
        URL.revokeObjectURL(url)

        reject(
          new Error(
            'Não foi possível abrir esta imagem.'
          )
        )
      }

      image.src = url
    }
  )
}

function calculateSize(
  width,
  height,
  maxDimension
) {
  const largest =
    Math.max(width, height)

  if (largest <= maxDimension) {
    return {
      width,
      height,
    }
  }

  const ratio =
    maxDimension / largest

  return {
    width:
      Math.round(width * ratio),

    height:
      Math.round(height * ratio),
  }
}

function canvasToJpeg(
  canvas,
  quality
) {
  return new Promise(
    (resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error(
                'Não foi possível compactar a imagem.'
              )
            )

            return
          }

          resolve(blob)
        },
        'image/jpeg',
        quality
      )
    }
  )
}

// =========================================================
// MAIN PROCESSOR
// =========================================================

export async function processAdminImage(
  originalFile,
  target
) {
  const profile =
    target === 'avatar'
      ? IMAGE_PROFILES.avatar
      : IMAGE_PROFILES.event

  let sourceFile =
    originalFile

  // -------------------------------------------------------
  // HEIC / HEIF
  // -------------------------------------------------------

  if (isHeicFile(sourceFile)) {
    try {
      sourceFile =
        await convertHeicToJpeg(
          sourceFile
        )
    } catch (error) {
      console.error(
        'HEIC conversion error:',
        error
      )

      throw new Error(
        'Não consegui converter esta foto HEIC. Tente selecionar a foto novamente ou usar outra imagem.',
        { cause: error }
      )
    }
  }

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ]

  if (
    !allowedTypes.includes(
      sourceFile.type
    )
  ) {
    throw new Error(
      'Formato de imagem não suportado.'
    )
  }

  const image =
    await loadImage(sourceFile)

  let {
    width,
    height,
  } = calculateSize(
    image.naturalWidth,
    image.naturalHeight,
    profile.maxDimension
  )

  // =======================================================
  // MULTI-PASS COMPRESSION
  // =======================================================
  // First reduce JPEG quality.
  // If that is still not enough, reduce resolution and
  // repeat until the image fits comfortably below the
  // upload limit.
  // =======================================================

  for (
    let resizeAttempt = 0;
    resizeAttempt < 7;
    resizeAttempt += 1
  ) {
    const canvas =
      document.createElement(
        'canvas'
      )

    canvas.width = width
    canvas.height = height

    const context =
      canvas.getContext('2d')

    if (!context) {
      throw new Error(
        'Seu navegador não conseguiu processar esta imagem.'
      )
    }

    // JPEG has no transparency.
    // White prevents transparent PNGs from becoming black.
    context.fillStyle = '#ffffff'

    context.fillRect(
      0,
      0,
      width,
      height
    )

    context.drawImage(
      image,
      0,
      0,
      width,
      height
    )

    let quality =
      profile.initialQuality

    while (
      quality >=
      profile.minQuality
    ) {
      const blob =
        await canvasToJpeg(
          canvas,
          quality
        )

      if (
        blob.size <=
        profile.targetBytes
      ) {
        return new File(
          [blob],
          createJpegName(
            originalFile.name
          ),
          {
            type:
              'image/jpeg',
          }
        )
      }

      quality -= 0.08
    }

    // Still too large:
    // reduce resolution by 15% and retry.
    width =
      Math.max(
        400,
        Math.round(
          width * 0.85
        )
      )

    height =
      Math.max(
        400,
        Math.round(
          height * 0.85
        )
      )
  }

  throw new Error(
    'Mesmo após compactar bastante, a imagem ainda ficou grande demais.'
  )
}

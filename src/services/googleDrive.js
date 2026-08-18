// =========================================================
// GOOGLE DRIVE AUTH
// Handles Google OAuth authentication in the browser.
//
// Important:
// - Client ID comes from .env.local.
// - No Client Secret is stored in the frontend.
// - We request only the drive.file scope.
// =========================================================

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID

const DRIVE_SCOPE =
  'https://www.googleapis.com/auth/drive.file'

let tokenClient = null


// =========================================================
// LOAD GOOGLE IDENTITY SERVICES
// =========================================================

export function loadGoogleIdentity() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve()
      return
    }

    const existingScript =
      document.querySelector(
        'script[data-google-identity]'
      )

    if (existingScript) {
      existingScript.addEventListener(
        'load',
        resolve,
        { once: true }
      )

      existingScript.addEventListener(
        'error',
        () => {
          reject(
            new Error(
              'Não foi possível carregar o Google.'
            )
          )
        },
        { once: true }
      )

      return
    }

    const script =
      document.createElement('script')

    script.src =
      'https://accounts.google.com/gsi/client'

    script.async = true
    script.defer = true

    script.dataset.googleIdentity =
      'true'

    script.onload = () => {
      resolve()
    }

    script.onerror = () => {
      reject(
        new Error(
          'Não foi possível carregar o Google.'
        )
      )
    }

    document.head.appendChild(
      script
    )
  })
}


// =========================================================
// REQUEST DRIVE ACCESS TOKEN
// =========================================================

export async function connectGoogleDrive() {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      'Google Client ID não configurado.'
    )
  }

  await loadGoogleIdentity()

  return new Promise(
    (resolve, reject) => {
      tokenClient =
        window.google.accounts.oauth2.initTokenClient({
          client_id:
            GOOGLE_CLIENT_ID,

          scope:
            DRIVE_SCOPE,

          callback:
            (response) => {
              if (response.error) {
                reject(
                  new Error(
                    response.error_description ||
                    response.error
                  )
                )

                return
              }

              if (!response.access_token) {
                reject(
                  new Error(
                    'O Google não retornou uma autorização válida.'
                  )
                )

                return
              }

              resolve({
                accessToken:
                  response.access_token,

                expiresIn:
                  response.expires_in,

                scope:
                  response.scope,
              })
            },
        })

      tokenClient.requestAccessToken({
        prompt: 'consent',
      })
    }
  )
}


// =========================================================
// GOOGLE DRIVE API
// =========================================================

const DRIVE_API =
  'https://www.googleapis.com/drive/v3'

const DRIVE_UPLOAD_API =
  'https://www.googleapis.com/upload/drive/v3'


// =========================================================
// ESCAPE DRIVE SEARCH VALUE
// Prevents event names containing apostrophes from
// breaking Google Drive search queries.
// =========================================================

function escapeDriveQueryValue(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
}


// =========================================================
// DRIVE REQUEST HELPER
// =========================================================

async function driveRequest(
  url,
  accessToken,
  options = {}
) {
  const response =
    await fetch(url, {
      ...options,

      headers: {
        Authorization:
          `Bearer ${accessToken}`,

        ...(options.headers || {}),
      },
    })

  if (!response.ok) {
    let details

    try {
      const errorData =
        await response.json()

      details =
        errorData?.error?.message || ''
    } catch {
      details =
        await response.text()
    }

    throw new Error(
      details ||
      `Erro Google Drive (${response.status}).`
    )
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}


// =========================================================
// FIND FOLDER
// Searches only folders created/accessible through
// the drive.file authorization.
// =========================================================

async function findFolder(
  accessToken,
  folderName,
  parentId = null
) {
  const safeName =
    escapeDriveQueryValue(folderName)

  const queryParts = [
    `name = '${safeName}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ]

  if (parentId) {
    queryParts.push(
      `'${parentId}' in parents`
    )
  }

  const params =
    new URLSearchParams({
      q:
        queryParts.join(' and '),

      fields:
        'files(id,name,webViewLink)',

      pageSize:
        '10',
    })

  const data =
    await driveRequest(
      `${DRIVE_API}/files?${params.toString()}`,
      accessToken
    )

  return data.files?.[0] || null
}


// =========================================================
// CREATE FOLDER
// =========================================================

async function createFolder(
  accessToken,
  folderName,
  parentId = null
) {
  const metadata = {
    name: folderName,

    mimeType:
      'application/vnd.google-apps.folder',
  }

  if (parentId) {
    metadata.parents = [
      parentId,
    ]
  }

  return driveRequest(
    `${DRIVE_API}/files?fields=id,name,webViewLink`,
    accessToken,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body:
        JSON.stringify(metadata),
    }
  )
}


// =========================================================
// FIND OR CREATE FOLDER
// =========================================================

async function findOrCreateFolder(
  accessToken,
  folderName,
  parentId = null
) {
  const existing =
    await findFolder(
      accessToken,
      folderName,
      parentId
    )

  if (existing) {
    return existing
  }

  return createFolder(
    accessToken,
    folderName,
    parentId
  )
}


// =========================================================
// CREATE EVENT FOLDER
//
// Drive:
// Central do Sonhar/
//   Eventos/
//     Event name/
// =========================================================

export async function getEventDriveFolder(
  accessToken,
  eventName,
  photographerName
) {
  // =======================================================
  // MAIN CENTRAL FOLDER
  // =======================================================

  const centralFolder =
    await findOrCreateFolder(
      accessToken,
      'Central do Sonhar'
    )

  // =======================================================
  // EVENTS FOLDER
  // =======================================================

  const eventsFolder =
    await findOrCreateFolder(
      accessToken,
      'Eventos',
      centralFolder.id
    )

  // =======================================================
  // EVENT FOLDER
  // This is the folder saved in Memories.
  // =======================================================

  const eventFolder =
    await findOrCreateFolder(
      accessToken,
      eventName,
      eventsFolder.id
    )

  // =======================================================
  // PHOTOGRAPHER FOLDER
  // Each photographer receives their own folder inside
  // the same event.
  // =======================================================

  const safePhotographerName =
    String(
      photographerName ||
      'Fotógrafo'
    ).trim()

  const photographerFolder =
    await findOrCreateFolder(
      accessToken,
      safePhotographerName,
      eventFolder.id
    )

  return {
    eventFolder,
    photographerFolder,
  }
}


// =========================================================
// UPLOAD JPEG
// Uses multipart upload so metadata and JPEG are sent
// in one request.
// =========================================================

export async function uploadPhotoToDrive(
  accessToken,
  folderId,
  photo
) {
  const metadata = {
    name:
      photo.fileName,

    mimeType:
      'image/jpeg',

    parents: [
      folderId,
    ],
  }

  const formData =
    new FormData()

  formData.append(
    'metadata',
    new Blob(
      [
        JSON.stringify(
          metadata
        ),
      ],
      {
        type:
          'application/json',
      }
    )
  )

  formData.append(
    'file',
    photo.blob,
    photo.fileName
  )

  return driveRequest(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,webViewLink`,
    accessToken,
    {
      method: 'POST',
      body: formData,
    }
  )
}


// =========================================================
// CHECK IF FILE ALREADY EXISTS
// =========================================================
// Google Drive allows multiple files with the same name.
// Before uploading, the Central checks the photographer's
// folder and skips an existing file with the same name.
// =========================================================

export async function driveFileExists(
  accessToken,
  folderId,
  fileName
) {
  const safeName =
    escapeDriveQueryValue(fileName)

  const params =
    new URLSearchParams({
      q: [
        `name = '${safeName}'`,
        `'${folderId}' in parents`,
        'trashed = false',
      ].join(' and '),

      fields:
        'files(id,name)',

      pageSize:
        '1',
    })

  const data =
    await driveRequest(
      `${DRIVE_API}/files?${params.toString()}`,
      accessToken
    )

  return Boolean(
    data.files?.length
  )
}

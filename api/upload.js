import adminUploadHandler from '../server/actions/admin-upload.js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '256kb',
    },
  },
}

export default async function handler(
  request,
  response
) {
  return adminUploadHandler(
    request,
    response
  )
}

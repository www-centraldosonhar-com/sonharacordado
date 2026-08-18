import adminUploadHandler from '../server/actions/admin-upload.js'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb',
    },
  },
}

export default async function handler(request, response) {
  return adminUploadHandler(request, response)
}

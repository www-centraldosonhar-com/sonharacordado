import process from 'node:process'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

import {
  isGlobalAdmin,
  isProjectAdmin,
  isVolunteerTeamAdmin,
  requireAdmin,
} from './_admin.js'


function canImportVolunteers(admin) {
  return (
    isGlobalAdmin(admin) ||
    isProjectAdmin(admin) ||
    isVolunteerTeamAdmin(admin)
  )
}


export default async function handler(
  request,
  response
) {
  if (request.method !== 'GET') {
    return response.status(405).json({
      error: 'Method not allowed.',
    })
  }


  const admin =
    await requireAdmin(request)


  if (!admin) {
    return response.status(403).json({
      error:
        'Acesso administrativo não autorizado.',
    })
  }


  if (!canImportVolunteers(admin)) {
    return response.status(403).json({
      error:
        'Você não possui permissão para configurar voluntários.',
    })
  }


  const clientId =
    process.env.GOOGLE_CLIENT_ID || ''

  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI || ''


  if (!clientId || !redirectUri) {
    return response.status(400).json({
      error:
        'OAuth do Google ainda não foi configurado.',
      configured: false,
    })
  }


  const oauthStateSecret =
    process.env.AUTH_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET

  if (!oauthStateSecret) {
    return response.status(400).json({
      error:
        'Não foi possível preparar o OAuth com segurança.',
    })
  }

  const statePayload = JSON.stringify({
    adminId:
      admin.id,

    createdAt:
      Date.now(),
  })

  const statePayloadEncoded =
    Buffer
      .from(statePayload)
      .toString('base64url')

  const stateSignature =
    crypto
      .createHmac(
        'sha256',
        oauthStateSecret
      )
      .update(
        statePayloadEncoded
      )
      .digest('base64url')

  const state =
    `${statePayloadEncoded}.${stateSignature}`


  const params =
    new URLSearchParams({
      client_id:
        clientId,

      redirect_uri:
        redirectUri,

      state,

      response_type:
        'code',

      access_type:
        'offline',

      /*
       * Força consentimento para aumentar a chance
       * de o Google retornar refresh_token.
       */
      prompt:
        'consent',

      scope:
        [
          'https://www.googleapis.com/auth/spreadsheets.readonly',
        ].join(' '),
    })


  const authorizationUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`


  return response.status(200).json({
    success: true,
    authorizationUrl,
  })
}

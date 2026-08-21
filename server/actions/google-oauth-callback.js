import process from 'node:process'
import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'

import {
  sql,
} from './_admin.js'


function htmlResponse(
  response,
  {
    title,
    message,
    success = false,
  }
) {
  const accent =
    success
      ? '#3c7b61'
      : '#a34848'

  return response
    .status(success ? 200 : 400)
    .setHeader(
      'Content-Type',
      'text/html; charset=utf-8'
    )
    .send(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />

          <title>${title}</title>

          <style>
            * {
              box-sizing: border-box;
            }

            body {
              min-height: 100vh;
              margin: 0;

              display: grid;
              place-items: center;

              padding: 24px;

              background:
                linear-gradient(
                  145deg,
                  #f7f9fc,
                  #eef3f8
                );

              font-family:
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                sans-serif;

              color: #293644;
            }

            .card {
              width: min(100%, 480px);

              padding: 30px;

              border:
                1px solid
                rgba(43, 61, 82, .07);

              border-radius: 24px;

              background:
                rgba(255,255,255,.96);

              box-shadow:
                0 22px 60px
                rgba(31, 45, 62, .10);

              text-align: center;
            }

            .icon {
              width: 52px;
              height: 52px;

              margin:
                0 auto 18px;

              display: grid;
              place-items: center;

              border-radius: 17px;

              background:
                ${accent}14;

              color:
                ${accent};

              font-size: 1.25rem;
              font-weight: 800;
            }

            h1 {
              margin: 0;

              font-size: 1.3rem;
              letter-spacing: -.03em;
            }

            p {
              margin:
                10px auto 0;

              max-width: 360px;

              color:
                rgba(42, 57, 75, .58);

              font-size: .9rem;
              line-height: 1.55;
            }

            small {
              display: block;

              margin-top: 18px;

              color:
                rgba(42, 57, 75, .38);

              font-size: .72rem;
            }
          </style>
        </head>

        <body>
          <main class="card">
            <div class="icon">
              ${success ? '✓' : '!'}
            </div>

            <h1>${title}</h1>

            <p>
              ${message}
            </p>

            <small>
              Você já pode fechar esta aba
              e voltar para a Central.
            </small>
          </main>
        </body>
      </html>
    `)
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


  const {
    code,
    error,
    state,
  } = request.query ?? {}


  if (!state) {
    return htmlResponse(
      response,
      {
        title:
          'Autorização inválida',

        message:
          'O estado de segurança da autorização não foi encontrado.',

        success:
          false,
      }
    )
  }


  const oauthStateSecret =
    process.env.AUTH_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET


  if (!oauthStateSecret) {
    throw new Error(
      'Secret de validação OAuth indisponível.'
    )
  }


  const stateParts =
    String(state).split('.')


  if (stateParts.length !== 2) {
    return htmlResponse(
      response,
      {
        title:
          'Autorização inválida',

        message:
          'O estado de segurança recebido é inválido.',

        success:
          false,
      }
    )
  }


  const [
    statePayloadEncoded,
    receivedSignature,
  ] = stateParts


  const expectedSignature =
    crypto
      .createHmac(
        'sha256',
        oauthStateSecret
      )
      .update(
        statePayloadEncoded
      )
      .digest('base64url')


  const receivedBuffer =
    Buffer.from(receivedSignature)

  const expectedBuffer =
    Buffer.from(expectedSignature)


  if (
    receivedBuffer.length !==
      expectedBuffer.length ||
    !crypto.timingSafeEqual(
      receivedBuffer,
      expectedBuffer
    )
  ) {
    return htmlResponse(
      response,
      {
        title:
          'Autorização inválida',

        message:
          'A verificação de segurança da autorização falhou.',

        success:
          false,
      }
    )
  }


  let statePayload

  try {
    statePayload = JSON.parse(
      Buffer
        .from(
          statePayloadEncoded,
          'base64url'
        )
        .toString('utf8')
    )
  } catch {
    return htmlResponse(
      response,
      {
        title:
          'Autorização inválida',

        message:
          'Não foi possível validar os dados da autorização.',

        success:
          false,
      }
    )
  }


  const maxStateAge =
    15 * 60 * 1000


  if (
    !statePayload?.adminId ||
    !statePayload?.createdAt ||
    Date.now() -
      Number(statePayload.createdAt) >
      maxStateAge
  ) {
    return htmlResponse(
      response,
      {
        title:
          'Autorização expirada',

        message:
          'Inicie novamente a conexão pelo Admin da Central.',

        success:
          false,
      }
    )
  }


  if (error) {
    return htmlResponse(
      response,
      {
        title:
          'Autorização cancelada',

        message:
          'O Google não concedeu acesso à planilha.',

        success:
          false,
      }
    )
  }


  if (!code) {
    return htmlResponse(
      response,
      {
        title:
          'Autorização inválida',

        message:
          'O Google não retornou o código de autorização.',

        success:
          false,
      }
    )
  }


  const clientId =
    process.env.GOOGLE_CLIENT_ID

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET

  const redirectUri =
    process.env.GOOGLE_OAUTH_REDIRECT_URI


  if (
    !clientId ||
    !clientSecret ||
    !redirectUri
  ) {
    throw new Error(
      'Configuração OAuth incompleta.'
    )
  }


  const tokenResponse =
    await fetch(
      'https://oauth2.googleapis.com/token',
      {
        method:
          'POST',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },

        body:
          new URLSearchParams({
            code:
              String(code),

            client_id:
              clientId,

            client_secret:
              clientSecret,

            redirect_uri:
              redirectUri,

            grant_type:
              'authorization_code',
          }),
      }
    )


  const tokenData =
    await tokenResponse.json()


  if (!tokenResponse.ok) {
    console.error(
      'GOOGLE TOKEN EXCHANGE ERROR:',
      tokenData
    )

    return htmlResponse(
      response,
      {
        title:
          'Não foi possível conectar',

        message:
          tokenData.error_description ||
          tokenData.error ||
          'O Google recusou a autorização.',

        success:
          false,
      }
    )
  }


  const accessToken =
    tokenData.access_token || null

  const refreshToken =
    tokenData.refresh_token || null

  const expiresIn =
    Number(
      tokenData.expires_in || 0
    )


  if (!refreshToken) {
    return htmlResponse(
      response,
      {
        title:
          'Autorização incompleta',

        message:
          'O Google não retornou um refresh token. Tente autorizar novamente.',

        success:
          false,
      }
    )
  }


  const expiresAt =
    expiresIn > 0
      ? new Date(
          Date.now() +
          expiresIn * 1000
        )
      : null


  await sql`
    INSERT INTO external_integrations (
      provider,
      integration_key,
      refresh_token,
      access_token,
      access_token_expires_at,
      metadata,
      active,
      updated_at
    )
    VALUES (
      'google',
      'volunteer_sheet',
      ${refreshToken},
      ${accessToken},
      ${expiresAt},
      ${JSON.stringify({
        scope:
          tokenData.scope || null,

        tokenType:
          tokenData.token_type || null,
      })}::jsonb,
      1,
      CURRENT_TIMESTAMP
    )

    ON CONFLICT (
      provider,
      integration_key
    )
    DO UPDATE SET
      refresh_token =
        EXCLUDED.refresh_token,

      access_token =
        EXCLUDED.access_token,

      access_token_expires_at =
        EXCLUDED.access_token_expires_at,

      metadata =
        EXCLUDED.metadata,

      active =
        1,

      updated_at =
        CURRENT_TIMESTAMP
  `


  return htmlResponse(
    response,
    {
      title:
        'Google conectado ✨',

      message:
        'A Central recebeu autorização para ler a planilha de voluntários.',

      success:
        true,
    }
  )
}

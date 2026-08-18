import { useState } from 'react'

import {
  REGISTRATION_TEAMS,
  getTeamLabel,
} from '../constants/registrationTeams'

import {
  formatDateBr,
  formatDateTimeBr,
} from '../utils/formatters'

const PIX_KEY =
  '04507472000196'

const PIX_DISPLAY =
  '04.507.472/0001-96'

function EventRegistrationPanel({
  event,
  currentUser,
  onUpdated,
}) {
  const [email, setEmail] =
    useState(
      event.registration?.email ||
      currentUser.email ||
      ''
    )

  const [team, setTeam] =
    useState(
      event.registration?.team ||
      ''
    )

  const [coupon, setCoupon] =
    useState('')

  const [receipt, setReceipt] =
    useState(null)

  const [message, setMessage] =
    useState('')

  const [isLoading, setIsLoading] =
    useState(false)

  const registration =
    event.registration

  const status =
    registration?.status

  const deadlineOpen =
    event.registration_deadline &&
    new Date(
      event.registration_deadline
    ) >= new Date()

  const registrationOpen =
    Number(
      event.registrations_open
    ) === 1 &&
    deadlineOpen

  async function copyPix() {
    try {
      await navigator.clipboard
        .writeText(PIX_KEY)

      setMessage(
        '✅ Chave PIX copiada!'
      )
    } catch {
      setMessage(
        `PIX: ${PIX_DISPLAY}`
      )
    }
  }

  async function prepareReceipt() {
    if (!receipt) {
      throw new Error(
        'Selecione o comprovante do PIX.'
      )
    }

    if (
      receipt.size >
      8 * 1024 * 1024
    ) {
      throw new Error(
        'O comprovante deve ter até 8 MB.'
      )
    }

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]

    if (!allowed.includes(receipt.type)) {
      throw new Error(
        'Use JPG, PNG, WebP ou PDF.'
      )
    }

    const prepareResponse =
      await fetch(
        '/api/volunteer?action=registration',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            operation:
              'prepare-receipt',
            eventId:
              event.id,
            contentType:
              receipt.type,
          }),
        }
      )

    const prepareResult =
      await prepareResponse.json()

    if (!prepareResponse.ok) {
      throw new Error(
        prepareResult.error ||
        'Não foi possível preparar o comprovante.'
      )
    }

    const formData =
      new FormData()

    formData.append(
      'cacheControl',
      '3600'
    )

    formData.append(
      '',
      receipt
    )

    const uploadResponse =
      await fetch(
        prepareResult.signedUrl,
        {
          method: 'PUT',

          headers: {
            'x-upsert': 'false',
          },

          body: formData,
        }
      )

    if (!uploadResponse.ok) {
      throw new Error(
        'Não foi possível enviar o comprovante.'
      )
    }

    return prepareResult.storagePath
  }

  async function handleSubmit(
    submitEvent
  ) {
    submitEvent.preventDefault()

    setIsLoading(true)
    setMessage('')

    try {
      const usingCoupon =
        Boolean(coupon.trim())

      let storagePath = null

      if (!usingCoupon) {
        setMessage(
          '☁️ Enviando comprovante...'
        )

        storagePath =
          await prepareReceipt()
      }

      setMessage(
        '🎟️ Registrando inscrição...'
      )

      const response =
        await fetch(
          '/api/volunteer?action=registration',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                operation: 'submit',
                eventId: event.id,
                email,
                team,
                couponCode:
                  coupon,
                storagePath,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível realizar a inscrição.'
        )
      }

      setMessage(
        `✅ ${result.message}`
      )

      setReceipt(null)
      setCoupon('')

      await onUpdated()
    } catch (error) {
      setMessage(
        error.message ||
        'Não foi possível concluir.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (
    status === 'confirmed'
  ) {
    return (
      <section className="registration-confirmed-card">
        <span className="registration-ticket-icon">
          🎟️
        </span>

        <div>
          <p className="eyebrow">
            VOCÊ ESTÁ DENTRO!
          </p>

          <h3>{event.name}</h3>

          <p>
            📅 {formatDateBr(
              event.event_date
            )}
          </p>

          <p>
            👥 {getTeamLabel(
              registration.team
            )}
          </p>

          <strong className="registration-confirmed-label">
            INSCRIÇÃO CONFIRMADA ✓
          </strong>
        </div>
      </section>
    )
  }

  if (
    status ===
      'pending_payment_review' ||
    status ===
      'pending_coupon_review'
  ) {
    return (
      <div className="registration-status-card">
        <strong>
          🟡 Inscrição em análise
        </strong>

        <p>
          {status ===
          'pending_coupon_review'
            ? 'Seu cupom de gratuidade está aguardando aprovação.'
            : 'Seu comprovante PIX está aguardando conferência.'}
        </p>
      </div>
    )
  }

  if (!registrationOpen) {
    return (
      <div className="registration-status-card">
        <strong>
          🔒 Inscrições encerradas
        </strong>
      </div>
    )
  }

  return (
    <section className="registration-panel">
      <div className="registration-panel-heading">
        <div>
          <p className="eyebrow">
            INSCRIÇÕES
          </p>

          <h3>
            🎟️ Quero participar
          </h3>
        </div>

        <span className="registration-counter">
          ❤️ {event.registration_count || 0}
          {' '}
          confirmado
          {Number(event.registration_count) !== 1
            ? 's'
            : ''}
        </span>
      </div>

      <div className="registration-payment-box">
        <strong>
          💙 Ajuda de custo
        </strong>

        <span>
          R$ {Number(
            event.registration_fee || 0
          ).toFixed(2).replace('.', ',')}
        </span>

        <p>
          PIX — Associação Sonhos de Criança
        </p>

        <button
          type="button"
          className="secondary-button"
          onClick={copyPix}
        >
          📋 Copiar CNPJ PIX
        </button>

        <small>
          {PIX_DISPLAY}
        </small>
      </div>

      <form
        className="registration-form"
        onSubmit={handleSubmit}
      >
        <label>
          E-mail de confirmação
        </label>

        <input
          type="email"
          value={email}
          onChange={(e) =>
            setEmail(
              e.target.value
            )
          }
          required
        />

        <label>
          Como você pretende participar?
        </label>

        <select
          value={team}
          onChange={(e) =>
            setTeam(
              e.target.value
            )
          }
          required
        >
          <option value="">
            Selecione
          </option>

          {REGISTRATION_TEAMS.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            )
          )}
        </select>

        <div className="registration-divider">
          <span>
            PAGAMENTO OU GRATUIDADE
          </span>
        </div>

        <label>
          Cupom de gratuidade
          <small>
            {' '}
            (se possuir)
          </small>
        </label>

        <input
          value={coupon}
          onChange={(e) =>
            setCoupon(
              e.target.value
                .toUpperCase()
            )
          }
          placeholder="Ex.: SONHADOR2026"
        />

        {!coupon.trim() && (
          <>
            <label>
              Comprovante do PIX
            </label>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) =>
                setReceipt(
                  e.target.files?.[0] ||
                  null
                )
              }
              required
            />
          </>
        )}

        {status ===
          'payment_rejected' && (
          <div className="registration-rejected">
            <strong>
              ⚠️ Precisamos de uma correção
            </strong>

            <p>
              {registration.rejection_reason ||
                'Reenvie sua inscrição.'}
            </p>
          </div>
        )}

        <button
          type="submit"
          className="primary-button"
          disabled={isLoading}
        >
          {isLoading
            ? 'Enviando...'
            : 'Enviar inscrição ❤️'}
        </button>

        <small>
          Inscrições até{' '}
          {formatDateTimeBr(
            event.registration_deadline
          )}
        </small>
      </form>

      {message && (
        <p className="action-message">
          {message}
        </p>
      )}
    </section>
  )
}

export default EventRegistrationPanel

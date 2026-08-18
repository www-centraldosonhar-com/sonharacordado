import { useState } from 'react'
import { formatDateTimeBr } from '../utils/formatters'
import { getTeamLabel } from '../constants/registrationTeams'

function AdminRegistrationsPanel({
  registrations = [],
  coupons = [],
  onUpdated,
}) {
  const [message, setMessage] =
    useState('')

  const [isLoading, setIsLoading] =
    useState(false)

  async function action(
    operation,
    data
  ) {
    setIsLoading(true)
    setMessage('')

    try {
      const response =
        await fetch(
          '/api/admin?action=registrations',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              operation,
              ...data,
            }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível concluir.'
        )
      }

      setMessage(
        result.message || ''
      )

      await onUpdated()

      return result
    } catch (error) {
      setMessage(error.message)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  async function openReceipt(
    registration
  ) {
    const result =
      await action(
        'receipt-url',
        {
          registrationId:
            registration.id,
        }
      )

    if (result?.url) {
      window.open(
        result.url,
        '_blank',
        'noopener,noreferrer'
      )
    }
  }

  async function approve(
    registration
  ) {
    if (
      !window.confirm(
        `Confirmar inscrição de ${registration.user_name}?`
      )
    ) {
      return
    }

    await action(
      'approve',
      {
        registrationId:
          registration.id,
      }
    )
  }

  async function reject(
    registration
  ) {
    const reason =
      window.prompt(
        'Motivo da rejeição/correção:'
      )

    if (!reason?.trim()) {
      return
    }

    await action(
      'reject',
      {
        registrationId:
          registration.id,
        reason,
      }
    )
  }

  const confirmedCount =
    registrations.filter(
      (item) =>
        item.status ===
        'confirmed'
    ).length

  const pendingCount =
    registrations.filter(
      (item) =>
        item.status ===
          'pending_payment_review' ||
        item.status ===
          'pending_coupon_review'
    ).length

  return (
    <section
      id="inscricoes"
      className="admin-section"
    >
      <p className="admin-eyebrow admin-orange">
        QUEM VEM SONHAR
      </p>

      <h2>
        🎟️ Inscrições
      </h2>

      <div className="admin-registration-summary">
        <article>
          <strong>
            {confirmedCount}
          </strong>
          <span>
            confirmados
          </span>
        </article>

        <article>
          <strong>
            {pendingCount}
          </strong>
          <span>
            aguardando análise
          </span>
        </article>
      </div>

      {message && (
        <p className="admin-action-message">
          {message}
        </p>
      )}

      <div className="registration-admin-table">
        {registrations.length === 0 ? (
          <p>
            Nenhuma inscrição ainda.
          </p>
        ) : (
          registrations.map(
            (registration) => (
              <article
                key={registration.id}
                className="registration-admin-row"
              >
                <div>
                  <strong>
                    {registration.user_name}
                  </strong>

                  <span>
                    {registration.project_name}
                  </span>
                </div>

                <div>
                  <span>
                    {registration.event_name}
                  </span>

                  <small>
                    {getTeamLabel(
                      registration.team
                    )}
                  </small>
                </div>

                <div>
                  <span>
                    {registration.email}
                  </span>

                  <small>
                    {registration.activity_name
                      ? `🙋 ${registration.activity_name}`
                      : 'Sem atividade específica'}
                  </small>
                </div>

                <div>
                  <span>
                    {formatDateTimeBr(
                      registration.created_at
                    )}
                  </span>

                  <small>
                    {registration.status}
                  </small>
                </div>

                <div className="registration-admin-actions">
                  {registration.payment_receipt_path && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() =>
                        openReceipt(
                          registration
                        )
                      }
                    >
                      📎 Comprovante
                    </button>
                  )}

                  {registration.coupon_code && (
                    <span className="admin-tag">
                      🎟️ {registration.coupon_code}
                    </span>
                  )}

                  {registration.status !==
                    'confirmed' &&
                    registration.status !==
                    'cancelled' && (
                      <>
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() =>
                            approve(
                              registration
                            )
                          }
                        >
                          ✅ Aprovar
                        </button>

                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() =>
                            reject(
                              registration
                            )
                          }
                        >
                          ❌ Rejeitar
                        </button>
                      </>
                    )}
                </div>
              </article>
            )
          )
        )}
      </div>

      <div className="admin-coupons-box">
        <h3>
          🎫 Cupons de gratuidade
        </h3>

        {coupons.map((coupon) => (
          <div
            key={coupon.id}
            className="admin-coupon-row"
          >
            <strong>
              {coupon.code}
            </strong>

            <span>
              {coupon.used_count}
              {' / '}
              {coupon.usage_limit}
            </span>

            <button
              type="button"
              disabled={isLoading}
              onClick={() =>
                action(
                  'toggle-coupon',
                  {
                    couponId:
                      coupon.id,
                  }
                )
              }
            >
              {Number(coupon.active) === 1
                ? '⚪ Desativar'
                : '🟢 Ativar'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}

export default AdminRegistrationsPanel

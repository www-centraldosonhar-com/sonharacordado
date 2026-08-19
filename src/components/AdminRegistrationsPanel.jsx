import {
  useMemo,
  useState,
} from 'react'

import {
  formatDateBr,
  formatDateTimeBr,
} from '../utils/formatters'

import {
  getTeamLabel,
} from '../constants/registrationTeams'

function AdminRegistrationsPanel({
  registrations = [],
  coupons = [],
  canManageCoupons = false,
  onUpdated,
}) {
  const [message, setMessage] =
    useState('')

  const [isLoading, setIsLoading] =
    useState(false)


  // =====================================================
  // GROUP BY EVENT
  // =====================================================

  const eventGroups =
    useMemo(() => {
      const groups =
        new Map()

      for (
        const registration
        of registrations
      ) {
        const key =
          Number(
            registration.event_id
          )

        if (!groups.has(key)) {
          groups.set(
            key,
            {
              eventId:
                registration.event_id,

              eventName:
                registration.event_name,

              eventDate:
                registration.event_date,

              projectName:
                registration.project_name,

              registrations: [],
            }
          )
        }

        groups
          .get(key)
          .registrations
          .push(registration)
      }

      return Array.from(
        groups.values()
      )
    }, [registrations])


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
        `Confirmar inscrição de ${registration.user_name} em ${registration.event_name}?`
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
        `Motivo da rejeição/correção para ${registration.user_name}:`
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

        <article>
          <strong>
            {eventGroups.length}
          </strong>

          <span>
            eventos
          </span>
        </article>
      </div>


      {message && (
        <p className="admin-action-message">
          {message}
        </p>
      )}


      {eventGroups.length === 0 ? (
        <div className="empty-state">
          <p>
            Nenhuma inscrição disponível.
          </p>
        </div>
      ) : (
        <div className="admin-registration-events">
          {eventGroups.map(
            (group) => {
              const eventConfirmed =
                group.registrations.filter(
                  (item) =>
                    item.status ===
                    'confirmed'
                ).length

              const eventPending =
                group.registrations.filter(
                  (item) =>
                    item.status ===
                      'pending_payment_review' ||
                    item.status ===
                      'pending_coupon_review'
                ).length

              return (
                <section
                  key={group.eventId}
                  className="admin-registration-event"
                >
                  <header className="admin-registration-event-header">
                    <div>
                      <p className="admin-eyebrow">
                        EVENTO
                      </p>

                      <h3>
                        {group.eventName}
                      </h3>

                      <p>
                        {group.projectName}
                        {' · '}
                        {formatDateBr(
                          group.eventDate
                        )}
                      </p>
                    </div>

                    <div className="admin-registration-event-counts">
                      <span>
                        ⏳ {eventPending}
                      </span>

                      <span>
                        ✅ {eventConfirmed}
                      </span>
                    </div>
                  </header>


                  <div className="registration-admin-table">
                    {group.registrations.map(
                      (registration) => (
                        <article
                          key={
                            registration.id
                          }
                          className="registration-admin-row"
                        >
                          <div>
                            <strong>
                              {
                                registration.user_name
                              }
                            </strong>

                            <span>
                              {
                                registration.project_name
                              }
                            </span>
                          </div>


                          <div>
                            <span>
                              {getTeamLabel(
                                registration.team
                              )}
                            </span>

                            <small>
                              {
                                registration.activity_name
                                  ? `🙋 ${registration.activity_name}`
                                  : 'Sem atividade específica'
                              }
                            </small>
                          </div>


                          <div>
                            <span>
                              {
                                registration.email
                              }
                            </span>

                            <small>
                              Inscrito em{' '}
                              {formatDateTimeBr(
                                registration.created_at
                              )}
                            </small>
                          </div>


                          <div>
                            <strong>
                              {
                                registration.status
                              }
                            </strong>

                            {registration.rejection_reason && (
                              <small>
                                ❌ {
                                  registration.rejection_reason
                                }
                              </small>
                            )}
                          </div>


                          <div className="registration-admin-actions">
                            {registration.payment_receipt_path && (
                              <button
                                type="button"
                                disabled={
                                  isLoading
                                }
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
                                🎟️ {
                                  registration.coupon_code
                                }
                              </span>
                            )}


                            {registration.status !==
                              'confirmed' &&
                              registration.status !==
                              'cancelled' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={
                                      isLoading
                                    }
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
                                    disabled={
                                      isLoading
                                    }
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
                    )}
                  </div>
                </section>
              )
            }
          )}
        </div>
      )}


      {canManageCoupons &&
        coupons.length > 0 && (
          <div className="admin-coupons-box">
            <h3>
              🎫 Cupons de gratuidade
            </h3>

            {coupons.map(
              (coupon) => (
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
                    {Number(
                      coupon.active
                    ) === 1
                      ? '⚪ Desativar'
                      : '🟢 Ativar'}
                  </button>
                </div>
              )
            )}
          </div>
        )}
    </section>
  )
}

export default AdminRegistrationsPanel

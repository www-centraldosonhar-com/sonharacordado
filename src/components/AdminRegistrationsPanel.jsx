import {
  useMemo,
  useState,
} from 'react'

import {
  formatDateBr,
} from '../utils/formatters'

import {
  getTeamLabel,
} from '../constants/registrationTeams'


const STATUS_INFO = {
  pending_payment_review: {
    label: 'Aguardando análise',
    icon: '🟡',
    className: 'status-review',
  },

  pending_coupon_review: {
    label: 'Cupom em análise',
    icon: '🎟️',
    className: 'status-review',
  },

  payment_rejected: {
    label: 'Correção necessária',
    icon: '🟠',
    className: 'status-correction',
  },

  confirmed: {
    label: 'Confirmada',
    icon: '✅',
    className: 'status-confirmed',
  },

  cancelled: {
    label: 'Cancelada',
    icon: '⚪',
    className: 'status-cancelled',
  },
}


function getStatusInfo(status) {
  return (
    STATUS_INFO[status] || {
      label: 'Em processamento',
      icon: '🔵',
      className: '',
    }
  )
}


function getStatusOrder(status) {
  if (
    status === 'pending_payment_review' ||
    status === 'pending_coupon_review'
  ) {
    return 1
  }

  if (status === 'payment_rejected') {
    return 2
  }

  if (status === 'confirmed') {
    return 3
  }

  if (status === 'cancelled') {
    return 4
  }

  return 5
}


function formatMoney(value) {
  const number =
    Number(value || 0)

  return new Intl.NumberFormat(
    'pt-BR',
    {
      style: 'currency',
      currency: 'BRL',
    }
  ).format(number)
}


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
  // AGRUPAMENTO POR EVENTO
  // =====================================================
  // Nunca misturamos aprovações de eventos diferentes.
  // =====================================================

  const eventGroups =
    useMemo(() => {
      const groups =
        new Map()

      for (
        const registration
        of registrations
      ) {
        const eventId =
          Number(
            registration.event_id
          )

        if (!groups.has(eventId)) {
          groups.set(
            eventId,
            {
              eventId,
              eventName:
                registration.event_name,

              eventDate:
                registration.event_date,

              registrations: [],
            }
          )
        }

        groups
          .get(eventId)
          .registrations
          .push(registration)
      }


      const result =
        Array.from(
          groups.values()
        )


      // Pendentes ficam sempre no topo.
      // Confirmados vão para o fim.
      for (const group of result) {
        group.registrations.sort(
          (a, b) => {
            const statusDifference =
              getStatusOrder(a.status) -
              getStatusOrder(b.status)

            if (statusDifference !== 0) {
              return statusDifference
            }

            return (
              new Date(a.created_at) -
              new Date(b.created_at)
            )
          }
        )
      }

      return result
    }, [registrations])


  // =====================================================
  // AÇÃO ADMINISTRATIVA
  // =====================================================

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
      setMessage(
        error.message
      )

      return null
    } finally {
      setIsLoading(false)
    }
  }


  // =====================================================
  // COMPROVANTE
  // =====================================================
  // Navegamos na própria aba.
  //
  // Isso evita o bloqueio de popup que acontece
  // principalmente no Safari/iPhone.
  // =====================================================

  async function openReceipt(
    registration
  ) {
    setMessage('')

    // Abre a nova aba imediatamente a partir do clique.
    // Isso evita bloqueio de popup em navegadores mobile.
    const receiptWindow =
      window.open(
        'about:blank',
        '_blank'
      )

    if (!receiptWindow) {
      setMessage(
        'O navegador bloqueou a nova aba. Permita pop-ups para abrir o comprovante.'
      )
      return
    }

    try {
      receiptWindow.document.title =
        'Abrindo comprovante...'

      receiptWindow.document.body.innerHTML =
        '<p style="font-family: sans-serif; padding: 20px;">Abrindo comprovante...</p>'

      const response =
        await fetch(
          '/api/admin?action=registrations',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                operation:
                  'receipt-url',

                registrationId:
                  registration.id,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível abrir o comprovante.'
        )
      }

      if (!result.url) {
        throw new Error(
          'Comprovante indisponível.'
        )
      }

      receiptWindow.location.href =
        result.url
    } catch (error) {
      try {
        receiptWindow.close()
      } catch {
        // Nada a fazer.
      }

      setMessage(
        error.message ||
        'Não foi possível abrir o comprovante.'
      )
    }
  }


  async function approve(
    registration
  ) {
    if (
      !window.confirm(
        `Aprovar a inscrição de ${registration.user_name} em ${registration.event_name}?`
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
        `O que precisa ser corrigido por ${registration.user_name}?`
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

      <p className="admin-form-help">
        Cada evento possui sua própria fila
        de análise.
      </p>


      {message && (
        <p className="admin-action-message">
          {message}
        </p>
      )}


      {eventGroups.length === 0 ? (
        <div className="empty-state">
          Nenhuma inscrição aguardando
          administração.
        </div>
      ) : (
        <div className="registration-event-list">
          {eventGroups.map(
            (group) => {
              const pending =
                group.registrations.filter(
                  (registration) =>
                    getStatusOrder(
                      registration.status
                    ) <= 2
                ).length

              const confirmed =
                group.registrations.filter(
                  (registration) =>
                    registration.status ===
                    'confirmed'
                ).length

              return (
                <details
                  key={group.eventId}
                  className="registration-event-card registration-event-collapsible"
                >
                  <summary className="registration-event-header registration-event-summary">
                    <div>
                      <h3>
                        {group.eventName}
                      </h3>

                      <small>
                        📅{' '}
                        {formatDateBr(
                          group.eventDate
                        )}
                      </small>
                    </div>

                    <div className="registration-event-badges">
                      {pending > 0 && (
                        <span className="registration-count-pending">
                          🟡 {pending} para analisar
                        </span>
                      )}

                      <span>
                        ✅ {confirmed}
                      </span>
                    </div>
                  </summary>


                  <div className="registration-compact-list">
                    {group.registrations.map(
                      (registration) => {
                        const status =
                          getStatusInfo(
                            registration.status
                          )

                        const actionable =
                          registration.status !==
                            'confirmed' &&
                          registration.status !==
                            'cancelled'

                        return (
                          <article
                            key={
                              registration.id
                            }
                            className={
                              `registration-compact-row ${
                                registration.status ===
                                'confirmed'
                                  ? 'registration-row-confirmed'
                                  : ''
                              }`
                            }
                          >
                            <div className="registration-person">
                              <strong>
                                {
                                  registration.user_name
                                }
                              </strong>

                              <small>
                                {
                                  registration.project_name
                                }
                                {' · '}
                                {getTeamLabel(
                                  registration.team
                                )}
                              </small>
                            </div>


                            <div className="registration-payment">
                              {registration.coupon_code ? (
                                <>
                                  <strong>
                                    🎟️ Cupom
                                  </strong>

                                  <small>
                                    {
                                      registration.coupon_code
                                    }
                                  </small>
                                </>
                              ) : (
                                <>
                                  <strong>
                                    {formatMoney(
                                      registration.registration_fee
                                    )}
                                  </strong>

                                  <small>
                                    inscrição
                                  </small>
                                </>
                              )}
                            </div>


                            <div className="registration-compact-actions">
                              {registration.payment_receipt_path && (
                                <button
                                  type="button"
                                  className="registration-receipt-button"
                                  disabled={
                                    isLoading
                                  }
                                  onClick={() =>
                                    openReceipt(
                                      registration
                                    )
                                  }
                                >
                                  📎 Ver
                                </button>
                              )}


                              {actionable && (
                                <>
                                  <button
                                    type="button"
                                    className="registration-approve-button"
                                    disabled={
                                      isLoading
                                    }
                                    onClick={() =>
                                      approve(
                                        registration
                                      )
                                    }
                                  >
                                    ✅
                                    <span>
                                      Aprovar
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    className="registration-reject-button"
                                    disabled={
                                      isLoading
                                    }
                                    onClick={() =>
                                      reject(
                                        registration
                                      )
                                    }
                                  >
                                    ❌
                                    <span>
                                      Rejeitar
                                    </span>
                                  </button>
                                </>
                              )}
                            </div>


                            <div
                              className={
                                `registration-status-pill ${status.className}`
                              }
                            >
                              <span>
                                {status.icon}
                              </span>

                              <strong>
                                {status.label}
                              </strong>
                            </div>


                            {registration.rejection_reason && (
                              <div className="registration-correction-message">
                                💬{' '}
                                {
                                  registration.rejection_reason
                                }
                              </div>
                            )}
                          </article>
                        )
                      }
                    )}
                  </div>
                </details>
              )
            }
          )}
        </div>
      )}


      {canManageCoupons &&
        coupons.length > 0 && (
          <details className="admin-coupons-box">
            <summary>
              🎫 Gerenciar cupons
            </summary>

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
                      ? 'Desativar'
                      : 'Ativar'}
                  </button>
                </div>
              )
            )}
          </details>
        )}
    </section>
  )
}

export default AdminRegistrationsPanel

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

  const [searchTerm, setSearchTerm] =
    useState('')

  const [statusFilter, setStatusFilter] =
    useState('all')


  const [correctionRegistrationId, setCorrectionRegistrationId] =
    useState(null)

  const [correctionReason, setCorrectionReason] =
    useState('')

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


  function openCorrection(
    registration
  ) {
    setCorrectionRegistrationId(
      registration.id
    )

    setCorrectionReason(
      registration.rejection_reason ||
      ''
    )
  }


  function cancelCorrection() {
    setCorrectionRegistrationId(null)
    setCorrectionReason('')
  }


  async function reject(
    registration
  ) {
    const reason =
      correctionReason.trim()

    if (!reason) {
      setMessage(
        'Informe o que precisa ser corrigido.'
      )

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

    setCorrectionRegistrationId(null)
    setCorrectionReason('')
  }



  const allRegistrations =
    useMemo(
      () =>
        eventGroups.flatMap(
          (group) =>
            group.registrations
        ),
      [eventGroups]
    )


  const normalizedSearch =
    searchTerm
      .trim()
      .toLowerCase()


  const filteredEventGroups =
    useMemo(
      () =>
        eventGroups
          .map((group) => ({
            ...group,

            registrations:
              group.registrations.filter(
                (registration) => {
                  const matchesSearch =
                    !normalizedSearch ||
                    String(
                      registration.user_name ||
                      ''
                    )
                      .toLowerCase()
                      .includes(
                        normalizedSearch
                      )

                  const matchesStatus =
                    statusFilter === 'all' ||
                    registration.status ===
                      statusFilter

                  return (
                    matchesSearch &&
                    matchesStatus
                  )
                }
              ),
          }))
          .filter(
            (group) =>
              group.registrations.length > 0
          ),
      [
        eventGroups,
        normalizedSearch,
        statusFilter,
      ]
    )


  const registrationSummary =
    useMemo(
      () => ({
        total:
          allRegistrations.length,

        pending:
          allRegistrations.filter(
            (registration) =>
              getStatusOrder(
                registration.status
              ) <= 2
          ).length,

        confirmed:
          allRegistrations.filter(
            (registration) =>
              registration.status ===
              'confirmed'
          ).length,

        cancelled:
          allRegistrations.filter(
            (registration) =>
              registration.status ===
              'cancelled'
          ).length,
      }),
      [allRegistrations]
    )


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


      <div className="registration-admin-overview">
        <div className="registration-admin-stats">
          <div className="is-pending">
            <strong>
              {registrationSummary.pending}
            </strong>

            <span>
              para analisar
            </span>
          </div>

          <div className="is-confirmed">
            <strong>
              {registrationSummary.confirmed}
            </strong>

            <span>
              confirmadas
            </span>
          </div>

          <div>
            <strong>
              {registrationSummary.total}
            </strong>

            <span>
              total
            </span>
          </div>
        </div>

        <div className="registration-admin-filters">
          <label>
            <span>
              Buscar
            </span>

            <input
              type="search"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value
                )
              }
              placeholder="Nome do voluntário"
            />
          </label>

          <label>
            <span>
              Status
            </span>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                Todos
              </option>

              <option value="pending">
                Pendentes
              </option>

              <option value="confirmed">
                Confirmadas
              </option>

              <option value="cancelled">
                Canceladas
              </option>
            </select>
          </label>
        </div>
      </div>


      {message && (
        <p className="admin-action-message">
          {message}
        </p>
      )}


      {filteredEventGroups.length === 0 ? (
        <div className="empty-state">
          Nenhuma inscrição aguardando
          administração.
        </div>
      ) : (
        <div className="registration-event-list">
          {filteredEventGroups.map(
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
                                      openCorrection(
                                        registration
                                      )
                                    }
                                  >
                                    ↩️
                                    <span>
                                      Solicitar correção
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


                            {correctionRegistrationId ===
                              registration.id && (
                              <div className="registration-correction-editor">
                                <div className="registration-correction-editor-head">
                                  <div>
                                    <small>
                                      SOLICITAR CORREÇÃO
                                    </small>

                                    <strong>
                                      O que precisa ser corrigido?
                                    </strong>
                                  </div>
                                </div>

                                <textarea
                                  value={correctionReason}
                                  onChange={(event) =>
                                    setCorrectionReason(
                                      event.target.value
                                    )
                                  }
                                  placeholder="Ex.: O comprovante está sem identificação ou não permite confirmar o pagamento."
                                  rows={3}
                                  autoFocus
                                />

                                <div className="registration-correction-editor-actions">
                                  <button
                                    type="button"
                                    disabled={isLoading}
                                    onClick={
                                      cancelCorrection
                                    }
                                  >
                                    Cancelar
                                  </button>

                                  <button
                                    type="button"
                                    className="is-primary"
                                    disabled={
                                      isLoading ||
                                      !correctionReason.trim()
                                    }
                                    onClick={() =>
                                      reject(
                                        registration
                                      )
                                    }
                                  >
                                    Enviar correção
                                  </button>
                                </div>
                              </div>
                            )}


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


      {canManageCoupons && (
          <details className="admin-coupons-box">
            <summary>
              🎫 Gerenciar cupons
            </summary>

            <div className="admin-coupon-row">
              <strong>
                Criar novo cupom
              </strong>

              <span>
                Gratuidade na inscrição
              </span>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  const couponCode =
                    window.prompt(
                      'Código do novo cupom (ex.: SONHAR2026):'
                    )

                  if (!couponCode) {
                    return
                  }

                  const usageLimit =
                    window.prompt(
                      'Quantas vezes esse cupom poderá ser usado?',
                      '1'
                    )

                  if (!usageLimit) {
                    return
                  }

                  action(
                    'create-coupon',
                    {
                      couponCode,
                      usageLimit:
                        Number(
                          usageLimit
                        ),
                    }
                  )
                }}
              >
                + Criar cupom
              </button>
            </div>

            {coupons.length === 0 && (
              <p>
                Nenhum cupom criado ainda.
              </p>
            )}

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

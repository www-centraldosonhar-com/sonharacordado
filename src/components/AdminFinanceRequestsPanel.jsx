import {
  useEffect,
  useState,
} from 'react'


function formatDate(value) {
  if (!value) {
    return 'Sem prazo'
  }

  return new Intl.DateTimeFormat(
    'pt-BR',
    {
      dateStyle: 'short',
    }
  ).format(
    new Date(value)
  )
}


function AdminFinanceRequestsPanel() {
  const [
    requests,
    setRequests,
  ] = useState([])

  const [
    responses,
    setResponses,
  ] = useState({})

  const [
    feedback,
    setFeedback,
  ] = useState('')

  const [
    respondingId,
    setRespondingId,
  ] = useState(null)


  // =====================================================
  // LOAD REQUESTS
  // =====================================================

  async function reloadRequests() {
    const response =
      await fetch(
        '/api/admin?action=finance-requests&operation=list'
      )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Não foi possível carregar as solicitações financeiras.'
      )
    }

    setRequests(
      result.requests || []
    )
  }


  useEffect(() => {
    let active = true

    async function loadInitialRequests() {
      try {
        const response =
          await fetch(
            '/api/admin?action=finance-requests&operation=list'
          )

        const result =
          await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível carregar as solicitações financeiras.'
          )
        }

        if (active) {
          setRequests(
            result.requests || []
          )
        }
      } catch (error) {
        if (active) {
          setFeedback(
            error.message
          )
        }
      }
    }

    loadInitialRequests()

    return () => {
      active = false
    }
  }, [])


  // =====================================================
  // RESPOND
  // =====================================================

  async function respond(
    requestId
  ) {
    const responseText =
      String(
        responses[requestId] || ''
      ).trim()

    if (
      responseText.length < 3
    ) {
      setFeedback(
        'Escreva uma resposta antes de enviar.'
      )

      return
    }

    setRespondingId(
      Number(requestId)
    )

    setFeedback('')

    try {
      const response =
        await fetch(
          '/api/admin?action=finance-requests',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                operation:
                  'respond',

                requestId:
                  Number(requestId),

                responseText,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível responder.'
        )
      }

      setResponses(
        (current) => ({
          ...current,
          [requestId]: '',
        })
      )

      setFeedback(
        result.message
      )

      await reloadRequests()
    } catch (error) {
      setFeedback(
        error.message
      )
    } finally {
      setRespondingId(
        null
      )
    }
  }


  const pendingCount =
    requests.filter(
      (item) =>
        item.status ===
        'pending'
    ).length


  return (
    <section className="admin-section admin-finance-requests">
      <div className="admin-finance-requests-heading">
        <div>
          <p className="admin-eyebrow">
            FINANCEIRO
          </p>

          <h2>
            📨 Pendências do Financeiro
          </h2>
        </div>

        {pendingCount > 0 && (
          <span className="admin-finance-request-counter">
            {pendingCount}
          </span>
        )}
      </div>


      <p className="admin-finance-requests-intro">
        Solicitações enviadas pelo
        Financeiro para conferência
        deste projeto.
      </p>


      {feedback && (
        <p className="post-event-message">
          {feedback}
        </p>
      )}


      {requests.length === 0 ? (
        <div className="admin-finance-request-empty">
          ✅ Nenhuma pendência financeira
          para este projeto.
        </div>
      ) : (
        <div className="admin-finance-request-list">
          {requests.map(
            (item) => (
              <article
                key={
                  item.id
                }
                className={
                  item.priority ===
                    'urgent'
                    ? 'admin-finance-request-card is-urgent'
                    : 'admin-finance-request-card'
                }
              >
                <header>
                  <div>
                    <small>
                      {item.priority ===
                        'urgent'
                        ? '🚨 URGENTE'
                        : 'SOLICITAÇÃO FINANCEIRA'}
                    </small>

                    <strong>
                      {item.subject}
                    </strong>
                  </div>

                  <span
                    className={
                      `admin-finance-request-status is-${item.status}`
                    }
                  >
                    {item.status ===
                      'pending'
                      ? 'Pendente'
                      : item.status ===
                          'answered'
                        ? 'Respondida'
                        : 'Resolvida'}
                  </span>
                </header>


                <div className="admin-finance-request-context">
                  {item.event_name && (
                    <span>
                      📅 {item.event_name}
                    </span>
                  )}

                  <span>
                    ⏰ Responder até:{' '}
                    {formatDate(
                      item.response_deadline
                    )}
                  </span>
                </div>


                <p className="admin-finance-request-message">
                  {item.message}
                </p>


                <small className="admin-finance-request-author">
                  Enviado por{' '}
                  {
                    item.created_by_name
                  }
                </small>


                {item.status ===
                  'pending' && (
                  <div className="admin-finance-request-response-form">
                    <label>
                      Resposta ao Financeiro
                    </label>

                    <textarea
                      rows="3"
                      placeholder="Informe o que foi conferido, corrigido ou esclarecido..."
                      value={
                        responses[
                          item.id
                        ] || ''
                      }
                      onChange={
                        (event) =>
                          setResponses(
                            (
                              current
                            ) => ({
                              ...current,

                              [item.id]:
                                event
                                  .target
                                  .value,
                            })
                          )
                      }
                    />

                    <button
                      type="button"
                      disabled={
                        Number(
                          respondingId
                        ) ===
                        Number(
                          item.id
                        )
                      }
                      onClick={() =>
                        respond(
                          item.id
                        )
                      }
                    >
                      {Number(
                        respondingId
                      ) ===
                      Number(
                        item.id
                      )
                        ? 'Enviando...'
                        : '📨 Enviar resposta'}
                    </button>
                  </div>
                )}


                {item.response_text && (
                  <div className="admin-finance-request-answer">
                    <small>
                      RESPOSTA ENVIADA
                    </small>

                    <p>
                      {
                        item.response_text
                      }
                    </p>

                    {item.responded_by_name && (
                      <span>
                        Por{' '}
                        {
                          item.responded_by_name
                        }
                      </span>
                    )}
                  </div>
                )}


                {item.status ===
                  'resolved' && (
                  <div className="admin-finance-request-resolved">
                    ✅ Financeiro confirmou
                    a resolução.
                  </div>
                )}
              </article>
            )
          )}
        </div>
      )}
    </section>
  )
}


export default AdminFinanceRequestsPanel

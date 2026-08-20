import {
  useCallback,
  useEffect,
  useMemo,
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


function FinanceRequestsPanel({
  events = [],
}) {
  const [
    requests,
    setRequests,
  ] = useState([])

  const [
    projectName,
    setProjectName,
  ] = useState('')

  const [
    eventId,
    setEventId,
  ] = useState('')

  const [
    subject,
    setSubject,
  ] = useState('')

  const [
    message,
    setMessage,
  ] = useState('')

  const [
    priority,
    setPriority,
  ] = useState('normal')

  const [
    responseDeadline,
    setResponseDeadline,
  ] = useState('')

  const [
    feedback,
    setFeedback,
  ] = useState('')

  const [
    isLoading,
    setIsLoading,
  ] = useState(false)


  const projects =
    useMemo(
      () => {
        const map =
          new Map()

        for (const event of events) {
          if (
            event.project_id &&
            event.project_name
          ) {
            map.set(
              event.project_name,
              Number(
                event.project_id
              )
            )
          }
        }

        return Array.from(
          map.entries()
        ).map(
          ([
            name,
            id,
          ]) => ({
            id,
            name,
          })
        )
      },
      [events]
    )


  const selectedProject =
    projects.find(
      (project) =>
        project.name ===
        projectName
    )


  const projectEvents =
    useMemo(
      () =>
        projectName
          ? events.filter(
              (event) =>
                event.project_name ===
                projectName
            )
          : [],
      [
        events,
        projectName,
      ]
    )


  const loadRequests =
    useCallback(
      async () => {
        try {
          const response =
            await fetch(
              '/api/finance?operation=requests'
            )

          const result =
            await response.json()

          if (!response.ok) {
            throw new Error(
              result.error ||
              'Não foi possível carregar os comunicados.'
            )
          }

          setRequests(
            result.requests || []
          )
        } catch (error) {
          setFeedback(
            error.message
          )
        }
      },
      []
    )


  useEffect(
    () => {
      let isActive = true

      async function loadInitialRequests() {
        try {
          const response =
            await fetch(
              '/api/finance?operation=requests'
            )

          const result =
            await response.json()

          if (!response.ok) {
            throw new Error(
              result.error ||
              'Não foi possível carregar os comunicados.'
            )
          }

          if (isActive) {
            setRequests(
              result.requests || []
            )
          }
        } catch (error) {
          if (isActive) {
            setFeedback(
              error.message
            )
          }
        }
      }

      loadInitialRequests()

      return () => {
        isActive = false
      }
    },
    []
  )


  async function submitRequest(
    event
  ) {
    event.preventDefault()

    if (!selectedProject) {
      setFeedback(
        'Escolha o projeto destinatário.'
      )

      return
    }

    setIsLoading(true)
    setFeedback('')

    try {
      const response =
        await fetch(
          '/api/finance?operation=create-request',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                projectId:
                  selectedProject.id,

                eventId:
                  eventId ||
                  null,

                subject,

                message,

                priority,

                responseDeadline:
                  responseDeadline ||
                  null,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível enviar o comunicado.'
        )
      }

      setSubject('')
      setMessage('')
      setEventId('')
      setPriority('normal')
      setResponseDeadline('')

      setFeedback(
        result.message
      )

      await loadRequests()
    } catch (error) {
      setFeedback(
        error.message
      )
    } finally {
      setIsLoading(false)
    }
  }


  async function resolveRequest(
    requestId
  ) {
    setIsLoading(true)
    setFeedback('')

    try {
      const response =
        await fetch(
          '/api/finance?operation=resolve-request',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                requestId,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível encerrar a solicitação.'
        )
      }

      setFeedback(
        result.message
      )

      await loadRequests()
    } catch (error) {
      setFeedback(
        error.message
      )
    } finally {
      setIsLoading(false)
    }
  }


  return (
    <section className="admin-section finance-requests-panel">
      <p className="admin-eyebrow">
        COMUNICAÇÃO FINANCEIRA
      </p>

      <h2>
        📨 Solicitações aos Projetos
      </h2>

      <p className="finance-requests-intro">
        Informe divergências, pendências
        ou necessidades diretamente ao
        Admin de Projeto responsável.
      </p>


      <form
        className="finance-request-form"
        onSubmit={
          submitRequest
        }
      >
        <div className="finance-request-form-grid">
          <label>
            <span>
              Projeto
            </span>

            <select
              required
              value={
                projectName
              }
              onChange={
                (event) => {
                  setProjectName(
                    event.target.value
                  )

                  setEventId('')
                }
              }
            >
              <option value="">
                Selecione
              </option>

              {projects.map(
                (project) => (
                  <option
                    key={
                      project.id
                    }
                    value={
                      project.name
                    }
                  >
                    {project.name}
                  </option>
                )
              )}
            </select>
          </label>


          <label>
            <span>
              Evento
            </span>

            <select
              value={
                eventId
              }
              disabled={
                !projectName
              }
              onChange={
                (event) =>
                  setEventId(
                    event.target.value
                  )
              }
            >
              <option value="">
                Geral / sem evento
              </option>

              {projectEvents.map(
                (event) => (
                  <option
                    key={
                      event.id
                    }
                    value={
                      event.id
                    }
                  >
                    {event.name}
                  </option>
                )
              )}
            </select>
          </label>


          <label>
            <span>
              Prioridade
            </span>

            <select
              value={
                priority
              }
              onChange={
                (event) =>
                  setPriority(
                    event.target.value
                  )
              }
            >
              <option value="normal">
                Normal
              </option>

              <option value="urgent">
                🚨 Urgente
              </option>
            </select>
          </label>


          <label>
            <span>
              Responder até
            </span>

            <input
              type="date"
              value={
                responseDeadline
              }
              onChange={
                (event) =>
                  setResponseDeadline(
                    event.target.value
                  )
              }
            />
          </label>
        </div>


        <label className="finance-request-wide">
          <span>
            Assunto
          </span>

          <input
            required
            minLength="3"
            maxLength="120"
            value={
              subject
            }
            placeholder="Ex.: Divergência no fechamento"
            onChange={
              (event) =>
                setSubject(
                  event.target.value
                )
            }
          />
        </label>


        <label className="finance-request-wide">
          <span>
            Mensagem
          </span>

          <textarea
            required
            minLength="5"
            rows="4"
            value={
              message
            }
            placeholder="Explique o que precisa ser conferido..."
            onChange={
              (event) =>
                setMessage(
                  event.target.value
                )
            }
          />
        </label>


        <button
          type="submit"
          className="finance-request-submit"
          disabled={
            isLoading
          }
        >
          {isLoading
            ? 'Enviando...'
            : priority ===
                'urgent'
              ? '🚨 Enviar solicitação urgente'
              : '📨 Enviar solicitação'}
        </button>
      </form>


      {feedback && (
        <p className="post-event-message">
          {feedback}
        </p>
      )}


      <div className="finance-request-history">
        <div className="finance-request-history-heading">
          <div>
            <small>
              HISTÓRICO
            </small>

            <strong>
              Solicitações enviadas
            </strong>
          </div>

          <span>
            {requests.length}
          </span>
        </div>


        {requests.length === 0 && (
          <p className="finance-request-empty">
            Nenhuma solicitação financeira
            enviada ainda.
          </p>
        )}


        {requests.map(
          (item) => (
            <article
              className={
                item.priority ===
                  'urgent'
                  ? 'finance-request-card is-urgent'
                  : 'finance-request-card'
              }
              key={
                item.id
              }
            >
              <header>
                <div>
                  <small>
                    {
                      item.project_name
                    }

                    {item.event_name
                      ? ` · ${item.event_name}`
                      : ''}
                  </small>

                  <strong>
                    {item.subject}
                  </strong>
                </div>

                <span
                  className={
                    `finance-request-status is-${item.status}`
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


              <p>
                {item.message}
              </p>


              <div className="finance-request-meta">
                <span>
                  {item.priority ===
                    'urgent'
                    ? '🚨 Urgente'
                    : 'Normal'}
                </span>

                <span>
                  Prazo:{' '}
                  {formatDate(
                    item.response_deadline
                  )}
                </span>
              </div>


              {item.response_text && (
                <div className="finance-request-response">
                  <small>
                    RESPOSTA DO PROJETO
                  </small>

                  <p>
                    {
                      item.response_text
                    }
                  </p>

                  {item.responded_by_name && (
                    <span>
                      Respondido por{' '}
                      {
                        item.responded_by_name
                      }
                    </span>
                  )}
                </div>
              )}


              {item.status ===
                'answered' && (
                <button
                  type="button"
                  className="finance-request-resolve"
                  disabled={
                    isLoading
                  }
                  onClick={() =>
                    resolveRequest(
                      item.id
                    )
                  }
                >
                  ✓ Marcar como resolvida
                </button>
              )}
            </article>
          )
        )}
      </div>
    </section>
  )
}


export default FinanceRequestsPanel

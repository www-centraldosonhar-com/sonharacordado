import { useEffect, useState } from 'react'

function AdminEventComposer({
  projects = [],
  events = [],
  onCreated,
  draftOwnerKey = 'default',
}) {
  const draftKey =
    `central-sonhar:draft:event:${draftOwnerKey}`

  const readDraft = () => {
    if (
      typeof window === 'undefined'
    ) {
      return {}
    }

    try {
      return JSON.parse(
        window.localStorage.getItem(
          draftKey
        ) || '{}'
      )
    } catch {
      return {}
    }
  }

  const initialDraft =
    readDraft()

  const [isOpen, setIsOpen] =
    useState(
      Boolean(
        initialDraft.name ||
        initialDraft.eventDate ||
        initialDraft.location
      )
    )

  const [isSaving, setIsSaving] =
    useState(false)

  const [feedback, setFeedback] =
    useState(null)

  const [eventType, setEventType] =
    useState(
      initialDraft.eventType ||
      'specific'
    )

  const [draft, setDraft] =
    useState({
      name:
        initialDraft.name || '',
      projectId:
        initialDraft.projectId || '',
      eventDate:
        initialDraft.eventDate || '',
      eventTime:
        initialDraft.eventTime || '',
      location:
        initialDraft.location || '',
      registrationDeadline:
        initialDraft.registrationDeadline || '',
      registrationFee:
        initialDraft.registrationFee ?? '0',
      pairedRegistrationEventId:
        initialDraft.pairedRegistrationEventId || '',
    })

  useEffect(() => {
    if (
      typeof window === 'undefined'
    ) {
      return
    }

    const hasDraft =
      Object.values(draft).some(
        (value) =>
          String(value || '').trim() &&
          String(value) !== '0'
      ) ||
      eventType !== 'specific'

    if (!hasDraft) {
      window.localStorage.removeItem(
        draftKey
      )
      return
    }

    window.localStorage.setItem(
      draftKey,
      JSON.stringify({
        ...draft,
        eventType,
      })
    )
  }, [
    draft,
    draftKey,
    eventType,
  ])

  function updateDraft(
    field,
    value
  ) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    const formElement =
      event.currentTarget

    const payload = {
      name:
        String(
          draft.name || ''
        ).trim(),

      projectId:
        eventType === 'general'
          ? null
          : draft.projectId
            ? Number(
                draft.projectId
              )
            : null,

      eventType,

      eventDate:
        draft.eventDate,

      eventTime:
        draft.eventTime,

      location:
        String(
          draft.location || ''
        ).trim(),

      registrationDeadline:
        draft.registrationDeadline ||
        null,

      registrationFee:
        draft.registrationFee || 0,

      pairedRegistrationEventId:
        eventType === 'specific' &&
        draft.pairedRegistrationEventId
          ? Number(draft.pairedRegistrationEventId)
          : null,

    }

    setIsSaving(true)
    setFeedback(null)

    try {
      const response =
        await fetch(
          '/api/admin?action=create',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                action: 'event',
                data: payload,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível criar o evento.'
        )
      }

      setFeedback({
        type: 'success',
        message:
          result.message ||
          'Evento criado com sucesso! 📅',
      })

      formElement.reset()
      setEventType('specific')
      setDraft({
        name: '',
        projectId: '',
        eventDate: '',
        eventTime: '',
        location: '',
        registrationDeadline: '',
        registrationFee: '0',
        pairedRegistrationEventId: '',
      })

      if (
        typeof window !== 'undefined'
      ) {
        window.localStorage.removeItem(
          draftKey
        )
      }

      await onCreated?.()

      setTimeout(() => {
        setIsOpen(false)
      }, 500)
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error?.message ||
          'Não foi possível criar o evento.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="admin-event-composer">
      <button
        type="button"
        className="admin-event-new-button"
        onClick={() => {
          setIsOpen(
            (current) =>
              !current
          )

          setFeedback(null)
        }}
      >
        <span>
          +
        </span>

        Novo evento
      </button>

      {isOpen && (
        <form
          className="admin-event-composer-form"
          onSubmit={handleSubmit}
        >
          <div className="admin-event-composer-head">
            <div>
              <small>
                NOVO EVENTO
              </small>

              <strong>
                Criar encontro
              </strong>
            </div>

            <button
              type="button"
              className="admin-event-close-button"
              onClick={() =>
                setIsOpen(false)
              }
            >
              ×
            </button>
          </div>

          <div className="admin-event-form-grid">
            <label className="is-wide">
              <span>
                Nome do evento
              </span>

              <input
                name="name"
                value={draft.name}
                onChange={(event) =>
                  updateDraft(
                    'name',
                    event.target.value
                  )
                }
                required
                placeholder="Ex.: Dia da Bondade"
              />
            </label>

            <label>
              <span>
                Tipo
              </span>

              <select
                name="eventType"
                value={eventType}
                onChange={(event) => {
                  const nextType =
                    event.target.value

                  setEventType(nextType)

                  if (nextType === 'general') {
                    updateDraft(
                      'pairedRegistrationEventId',
                      ''
                    )
                  }
                }}
              >
                <option value="specific">
                  Evento de projeto
                </option>

                <option value="general">
                  Evento geral
                </option>
              </select>
            </label>

            <label>
              <span>
                Projeto
              </span>

              <select
                name="projectId"
                value={draft.projectId}
                onChange={(event) =>
                  updateDraft(
                    'projectId',
                    event.target.value
                  )
                }
                required={
                  eventType === 'specific'
                }
                disabled={
                  eventType === 'general'
                }
              >
                <option value="">
                  {eventType === 'general'
                    ? 'Evento geral / sem projeto'
                    : 'Selecione o projeto'}
                </option>

                {projects.map(
                  (project) => (
                    <option
                      key={
                        project.id
                      }
                      value={
                        project.id
                      }
                    >
                      {
                        project.name
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            {eventType === 'specific' && (
              <label className="is-wide">
                <span>
                  Inscrição dupla
                </span>

                <select
                  name="pairedRegistrationEventId"
                  value={draft.pairedRegistrationEventId}
                  onChange={(event) =>
                    updateDraft(
                      'pairedRegistrationEventId',
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Sem evento complementar
                  </option>

                  {events
                    .filter(
                      (candidate) =>
                        candidate.event_type === 'general' &&
                        candidate.project_id == null &&
                        (!draft.eventDate ||
                          String(candidate.event_date).slice(0, 10) ===
                            draft.eventDate)
                    )
                    .map((candidate) => (
                      <option
                        key={candidate.id}
                        value={candidate.id}
                      >
                        {candidate.name} — {String(
                          candidate.event_date
                        ).slice(0, 10)}
                      </option>
                    ))}
                </select>

                <small>
                  Ao confirmar este evento, o voluntário também será inscrito no evento geral vinculado, sem nova cobrança.
                </small>
              </label>
            )}

            <label>
              <span>
                Data
              </span>

              <input
                type="date"
                name="eventDate"
                value={draft.eventDate}
                onChange={(event) =>
                  updateDraft(
                    'eventDate',
                    event.target.value
                  )
                }
                required
              />
            </label>

            <label>
              <span>
                Horário
              </span>

              <input
                type="time"
                name="eventTime"
                value={draft.eventTime}
                onChange={(event) =>
                  updateDraft(
                    'eventTime',
                    event.target.value
                  )
                }
                required
              />
            </label>

            <label className="is-wide">
              <span>
                Local
              </span>

              <input
                name="location"
                value={draft.location}
                onChange={(event) =>
                  updateDraft(
                    'location',
                    event.target.value
                  )
                }
                required
                placeholder="Endereço ou local do encontro"
              />
            </label>

            <label>
              <span>
                Prazo de inscrição
              </span>

              <input
                type="datetime-local"
                name="registrationDeadline"
                value={
                  draft.registrationDeadline
                }
                onChange={(event) =>
                  updateDraft(
                    'registrationDeadline',
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              <span>
                Valor da inscrição
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                name="registrationFee"
                value={
                  draft.registrationFee
                }
                onChange={(event) =>
                  updateDraft(
                    'registrationFee',
                    event.target.value
                  )
                }
              />
            </label>

          </div>

          {feedback && (
            <div
              className={`admin-event-feedback is-${feedback.type}`}
            >
              {feedback.message}
            </div>
          )}

          <div className="admin-event-composer-actions">
            <button
              type="button"
              className="admin-event-cancel-button"
              onClick={() =>
                setIsOpen(false)
              }
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="admin-event-save-button"
              disabled={isSaving}
            >
              {isSaving
                ? 'Criando...'
                : 'Criar evento'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default AdminEventComposer

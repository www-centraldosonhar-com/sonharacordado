import {
  useEffect,
  useState,
} from 'react'

function formatEventDate(value) {
  if (!value) return '—'

  const text = String(value).slice(0, 10)
  const [year, month, day] = text.split('-')

  if (!year || !month || !day) return text

  return `${day}/${month}/${year}`
}

function DreamerHistoricalEventsAdminPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [reviewEventId, setReviewEventId] = useState(null)
  const [reviewProjectId, setReviewProjectId] = useState('')
  const [savingReview, setSavingReview] = useState(false)
  const [reviewForm, setReviewForm] = useState({
    volunteerBase: '',
    attendanceNames: '',
    collectedAmount: '',
    expensesAmount: '',
  })

  const [form, setForm] = useState({
    name: '',
    eventDate: '',
    eventType: 'project',
    projectId: '',
    attendanceEnabled: true,
    economyEnabled: true,
  })

  async function loadHistoricalEvents() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(
        '/api/dreamer?action=historical-events'
      )

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            'Não foi possível carregar os eventos históricos.'
        )
      }

      setData(payload)
    } catch (fetchError) {
      setError(fetchError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistoricalEvents()
  }, [])

  function updateForm(field, value) {
    setForm(current => ({
      ...current,
      [field]: value,
    }))
  }

  function closeForm() {
    if (saving) return

    setShowForm(false)

    setForm({
      name: '',
      eventDate: '',
      eventType: 'project',
      projectId: '',
      attendanceEnabled: true,
      economyEnabled: true,
    })
  }

  function getReviewEvent() {
    return (data?.events || []).find(
      item => Number(item.id) === Number(reviewEventId)
    )
  }

  function getReviewProject(event, projectId) {
    return (event?.projects || []).find(
      item =>
        Number(item.projectId) === Number(projectId)
    )
  }

  function getAttendanceNames(project) {
    if (!Array.isArray(project?.attendance)) {
      return ''
    }

    return project.attendance
      .map(item =>
        typeof item === 'string'
          ? item
          : item?.name || item?.volunteerName || ''
      )
      .filter(Boolean)
      .join('\n')
  }

  function fillReviewForm(event, projectId) {
    const existing =
      getReviewProject(event, projectId)

    setReviewForm({
      volunteerBase:
        existing?.volunteerBase ?? '',
      attendanceNames:
        getAttendanceNames(existing),
      collectedAmount:
        existing?.collectedAmount ?? '',
      expensesAmount:
        existing?.expensesAmount ?? '',
    })
  }

  function openReview(item) {
    if (item.validated) return

    setError('')
    setReviewEventId(item.id)

    const initialProjectId =
      item.projectId ||
      data?.projects?.[0]?.id ||
      ''

    setReviewProjectId(
      initialProjectId
        ? String(initialProjectId)
        : ''
    )

    if (initialProjectId) {
      fillReviewForm(
        item,
        initialProjectId
      )
    } else {
      setReviewForm({
        volunteerBase: '',
        attendanceNames: '',
        collectedAmount: '',
        expensesAmount: '',
      })
    }
  }

  function closeReview() {
    if (savingReview) return

    setReviewEventId(null)
    setReviewProjectId('')
    setReviewForm({
      volunteerBase: '',
      attendanceNames: '',
      collectedAmount: '',
      expensesAmount: '',
    })
  }

  function changeReviewProject(projectId) {
    const event = getReviewEvent()

    setReviewProjectId(
      String(projectId)
    )

    fillReviewForm(
      event,
      projectId
    )
  }

  function updateReviewForm(field, value) {
    setReviewForm(current => ({
      ...current,
      [field]: value,
    }))
  }

  function getAttendanceList() {
    return reviewForm.attendanceNames
      .split(/\r?\n/)
      .map(name => name.trim())
      .filter(Boolean)
  }

  function getReviewPreview() {
    const volunteerBase =
      Number(reviewForm.volunteerBase) || 0

    const presentCount =
      getAttendanceList().length

    const attendanceRate =
      volunteerBase > 0
        ? presentCount /
          volunteerBase *
          100
        : 0

    const collected =
      reviewForm.collectedAmount === ''
        ? null
        : Number(reviewForm.collectedAmount)

    const expenses =
      reviewForm.expensesAmount === ''
        ? null
        : Number(reviewForm.expensesAmount)

    const hasFinancialValues =
      Number.isFinite(collected) &&
      Number.isFinite(expenses)

    const economyAmount =
      hasFinancialValues
        ? Math.max(
            0,
            collected - expenses
          )
        : null

    const economyPoints =
      economyAmount !== null &&
      volunteerBase > 0
        ? economyAmount /
          volunteerBase
        : null

    return {
      volunteerBase,
      presentCount,
      attendanceRate,
      economyAmount,
      economyPoints,
    }
  }

  async function saveReview() {
    const event = getReviewEvent()

    if (!event) {
      setError(
        'Evento histórico não encontrado.'
      )
      return
    }

    if (!reviewProjectId) {
      setError(
        'Escolha o projeto da revisão.'
      )
      return
    }

    const volunteerBase =
      Number(reviewForm.volunteerBase)

    if (
      !Number.isInteger(volunteerBase) ||
      volunteerBase <= 0
    ) {
      setError(
        'Informe uma base histórica válida.'
      )
      return
    }

    const names =
      getAttendanceList()

    if (
      event.attendanceEnabled &&
      names.length > volunteerBase
    ) {
      setError(
        `A lista possui ${names.length} presentes, mas a base histórica é ${volunteerBase}.`
      )
      return
    }

    if (event.economyEnabled) {
      const hasCollected =
        reviewForm.collectedAmount !== ''

      const hasExpenses =
        reviewForm.expensesAmount !== ''

      if (hasCollected !== hasExpenses) {
        setError(
          'Informe arrecadado e despesas juntos.'
        )
        return
      }

      if (
        hasCollected &&
        (
          !Number.isFinite(
            Number(reviewForm.collectedAmount)
          ) ||
          Number(reviewForm.collectedAmount) < 0 ||
          !Number.isFinite(
            Number(reviewForm.expensesAmount)
          ) ||
          Number(reviewForm.expensesAmount) < 0
        )
      ) {
        setError(
          'Informe valores financeiros válidos.'
        )
        return
      }
    }

    setSavingReview(true)
    setError('')

    try {
      const projectResponse =
        await fetch(
          '/api/dreamer?action=historical-events',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              operation: 'saveProjectData',
              historicalEventId:
                event.id,
              projectId:
                Number(reviewProjectId),
              volunteerBase,
              collectedAmount:
                event.economyEnabled
                  ? reviewForm.collectedAmount
                  : null,
              expensesAmount:
                event.economyEnabled
                  ? reviewForm.expensesAmount
                  : null,
            }),
          }
        )

      const projectPayload =
        await projectResponse.json()

      if (!projectResponse.ok) {
        throw new Error(
          projectPayload?.error ||
            'Não foi possível salvar os dados históricos.'
        )
      }

      if (event.attendanceEnabled) {
        const attendanceResponse =
          await fetch(
            '/api/dreamer?action=historical-events',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body: JSON.stringify({
                operation:
                  'saveAttendance',
                historicalEventId:
                  event.id,
                projectId:
                  Number(reviewProjectId),
                names,
              }),
            }
          )

        const attendancePayload =
          await attendanceResponse.json()

        if (!attendanceResponse.ok) {
          throw new Error(
            attendancePayload?.error ||
              'Não foi possível salvar a frequência histórica.'
          )
        }
      }

      await loadHistoricalEvents()

      setReviewEventId(event.id)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSavingReview(false)
    }
  }

  async function submitEvent(event) {
    event.preventDefault()

    if (!form.name.trim()) {
      setError('Informe o nome do evento.')
      return
    }

    if (!form.eventDate) {
      setError('Informe a data do evento.')
      return
    }

    if (
      form.eventType === 'project' &&
      !form.projectId
    ) {
      setError('Escolha o projeto do evento.')
      return
    }

    if (
      !form.attendanceEnabled &&
      !form.economyEnabled
    ) {
      setError(
        'Escolha frequência, fechamento/economia ou ambos.'
      )
      return
    }

    setSaving(true)
    setError('')

    try {
      const response = await fetch(
        '/api/dreamer?action=historical-events',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: 'createEvent',
            name: form.name,
            eventDate: form.eventDate,
            projectId:
              form.eventType === 'general'
                ? null
                : Number(form.projectId),
            attendanceEnabled:
              form.attendanceEnabled,
            economyEnabled:
              form.economyEnabled,
          }),
        }
      )

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            'Não foi possível criar o evento histórico.'
        )
      }

      closeForm()
      await loadHistoricalEvents()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data) {
    return (
      <section className="dreamer-history-admin">
        <div className="dreamer-history-loading">
          Carregando eventos históricos...
        </div>
      </section>
    )
  }

  const events = data?.events || []
  const projects = data?.projects || []

  return (
    <section className="dreamer-history-admin">
      <header className="dreamer-history-header">
        <div>
          <span className="dreamer-history-eyebrow">
            Olimpíada Sonhadora
          </span>

          <h2>Eventos Históricos</h2>

          <p>
            Registre eventos realizados antes da
            implantação da Central utilizando os
            documentos oficiais da ONG.
          </p>
        </div>

        <button
          type="button"
          className="dreamer-history-primary"
          onClick={() => setShowForm(true)}
        >
          + Novo evento histórico
        </button>
      </header>

      <div className="dreamer-history-notice">
        <strong>Histórico seguro</strong>
        <span>
          Eventos novos ficam em revisão e ainda não
          alteram a pontuação da Olimpíada.
        </span>
      </div>

      {error ? (
        <div className="dreamer-history-error">
          {error}
        </div>
      ) : null}

      {showForm ? (
        <form
          className="dreamer-history-form"
          onSubmit={submitEvent}
        >
          <div className="dreamer-history-form__header">
            <div>
              <span>Novo registro</span>
              <h3>Evento anterior à Central</h3>
            </div>

            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              aria-label="Fechar formulário"
            >
              ×
            </button>
          </div>

          <label className="dreamer-history-field">
            <span>Nome do evento</span>
            <input
              type="text"
              value={form.name}
              maxLength={180}
              placeholder="Ex.: Festa Junina APS"
              onChange={event =>
                updateForm(
                  'name',
                  event.target.value
                )
              }
            />
          </label>

          <label className="dreamer-history-field">
            <span>Data</span>
            <input
              type="date"
              value={form.eventDate}
              onChange={event =>
                updateForm(
                  'eventDate',
                  event.target.value
                )
              }
            />
          </label>

          <fieldset className="dreamer-history-options">
            <legend>Tipo de evento</legend>

            <label>
              <input
                type="radio"
                name="historical-event-type"
                checked={
                  form.eventType === 'project'
                }
                onChange={() =>
                  updateForm(
                    'eventType',
                    'project'
                  )
                }
              />
              <span>
                <strong>Evento de projeto</strong>
                <small>APS, PPF ou SJ</small>
              </span>
            </label>

            <label>
              <input
                type="radio"
                name="historical-event-type"
                checked={
                  form.eventType === 'general'
                }
                onChange={() =>
                  updateForm(
                    'eventType',
                    'general'
                  )
                }
              />
              <span>
                <strong>Evento geral</strong>
                <small>
                  Formação ou ação com vários projetos
                </small>
              </span>
            </label>
          </fieldset>

          {form.eventType === 'project' ? (
            <label className="dreamer-history-field">
              <span>Projeto</span>

              <select
                value={form.projectId}
                onChange={event =>
                  updateForm(
                    'projectId',
                    event.target.value
                  )
                }
              >
                <option value="">
                  Escolha o projeto
                </option>

                {projects.map(project => (
                  <option
                    key={project.id}
                    value={project.id}
                  >
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <fieldset className="dreamer-history-options">
            <legend>Dados disponíveis</legend>

            <label>
              <input
                type="checkbox"
                checked={
                  form.attendanceEnabled
                }
                onChange={event =>
                  updateForm(
                    'attendanceEnabled',
                    event.target.checked
                  )
                }
              />
              <span>
                <strong>Frequência</strong>
                <small>
                  Possuímos lista de presença
                </small>
              </span>
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.economyEnabled}
                onChange={event =>
                  updateForm(
                    'economyEnabled',
                    event.target.checked
                  )
                }
              />
              <span>
                <strong>
                  Fechamento / Economia
                </strong>
                <small>
                  Possuímos o fechamento financeiro
                </small>
              </span>
            </label>
          </fieldset>

          <div className="dreamer-history-form__actions">
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
            >
              {saving
                ? 'Criando...'
                : 'Criar em revisão'}
            </button>
          </div>
        </form>
      ) : null}

      {!events.length ? (
        <div className="dreamer-history-empty">
          <span>◇</span>
          <h3>Nenhum evento histórico</h3>
          <p>
            Quando os registros antigos forem
            cadastrados, eles aparecerão aqui para
            conferência antes de entrarem na
            Olimpíada.
          </p>
        </div>
      ) : (
        <div className="dreamer-history-list">
          {events.map(item => (
            <article
              className="dreamer-history-card"
              key={item.id}
            >
              <div className="dreamer-history-card__top">
                <div>
                  <span>
                    {formatEventDate(
                      item.eventDate
                    )}
                  </span>
                  <h3>{item.name}</h3>
                  <p>
                    {item.project ||
                      'Evento geral'}
                  </p>
                </div>

                <span
                  className={
                    item.validated
                      ? 'dreamer-history-status dreamer-history-status--validated'
                      : 'dreamer-history-status dreamer-history-status--review'
                  }
                >
                  {item.validated
                    ? '✓ Validado'
                    : '● Em revisão'}
                </span>
              </div>

              <div className="dreamer-history-card__flags">
                {item.attendanceEnabled ? (
                  <span>✓ Frequência</span>
                ) : (
                  <span>— Frequência</span>
                )}

                {item.economyEnabled ? (
                  <span>✓ Economia</span>
                ) : (
                  <span>— Economia</span>
                )}
              </div>

              {item.projects?.length ? (
                <div className="dreamer-history-card__summary">
                  {item.projects.map(project => (
                    <div
                      key={project.projectId}
                      className="dreamer-history-summary-project"
                    >
                      <strong>
                        {project.projectName}
                      </strong>

                      <span>
                        Base: {project.volunteerBase}
                      </span>

                      {item.attendanceEnabled ? (
                        <span>
                          Presença: {project.presentCount} /{' '}
                          {project.volunteerBase}
                          {' · '}
                          {Number(
                            project.attendanceRate || 0
                          ).toFixed(2)}
                          %
                        </span>
                      ) : null}

                      {item.economyEnabled &&
                      project.economyAmount !== null ? (
                        <span>
                          Economia: R${' '}
                          {Number(
                            project.economyAmount
                          ).toLocaleString(
                            'pt-BR',
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                          {' · '}
                          {Number(
                            project.economyPoints || 0
                          ).toFixed(2)}
                          {' pts'}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="dreamer-history-card__pending">
                  Estrutura criada. Falta informar
                  bases e dados históricos.
                </p>
              )}

              {!item.validated ? (
                <button
                  type="button"
                  className="dreamer-history-review-button"
                  onClick={() =>
                    reviewEventId === item.id
                      ? closeReview()
                      : openReview(item)
                  }
                >
                  {reviewEventId === item.id
                    ? 'Fechar revisão'
                    : 'Revisar evento'}
                </button>
              ) : null}

              {reviewEventId === item.id ? (
                <div className="dreamer-history-review">
                  <div className="dreamer-history-review__header">
                    <div>
                      <span>Conferência histórica</span>
                      <h4>
                        Dados oficiais do evento
                      </h4>
                    </div>

                    <span className="dreamer-history-status dreamer-history-status--review">
                      ● Em revisão
                    </span>
                  </div>

                  {item.projectId === null ? (
                    <label className="dreamer-history-field">
                      <span>Projeto</span>

                      <select
                        value={reviewProjectId}
                        onChange={event =>
                          changeReviewProject(
                            event.target.value
                          )
                        }
                      >
                        {projects.map(project => (
                          <option
                            key={project.id}
                            value={project.id}
                          >
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className="dreamer-history-field">
                    <span>
                      Base histórica oficial
                    </span>

                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={
                        reviewForm.volunteerBase
                      }
                      placeholder="Ex.: 48"
                      onChange={event =>
                        updateReviewForm(
                          'volunteerBase',
                          event.target.value
                        )
                      }
                    />
                  </label>

                  {item.attendanceEnabled ? (
                    <div className="dreamer-history-review__section">
                      <div className="dreamer-history-review__section-title">
                        <div>
                          <strong>Frequência</strong>
                          <small>
                            Um voluntário por linha
                          </small>
                        </div>
                      </div>

                      <textarea
                        className="dreamer-history-attendance"
                        value={
                          reviewForm.attendanceNames
                        }
                        rows="8"
                        placeholder={
                          'Ana Silva\nJoão Souza\nMaria Oliveira'
                        }
                        onChange={event =>
                          updateReviewForm(
                            'attendanceNames',
                            event.target.value
                          )
                        }
                      />

                      <div className="dreamer-history-preview">
                        <div>
                          <span>Presentes</span>
                          <strong>
                            {
                              getReviewPreview()
                                .presentCount
                            }
                          </strong>
                        </div>

                        <div>
                          <span>Frequência</span>
                          <strong>
                            {getReviewPreview()
                              .volunteerBase > 0
                              ? `${getReviewPreview().attendanceRate.toFixed(2)}%`
                              : '—'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {item.economyEnabled ? (
                    <div className="dreamer-history-review__section">
                      <div className="dreamer-history-review__section-title">
                        <div>
                          <strong>
                            Fechamento / Economia
                          </strong>
                          <small>
                            Valores do fechamento
                            histórico oficial
                          </small>
                        </div>
                      </div>

                      <div className="dreamer-history-money-grid">
                        <label className="dreamer-history-field">
                          <span>
                            Valor recebido
                          </span>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={
                              reviewForm.collectedAmount
                            }
                            placeholder="0,00"
                            onChange={event =>
                              updateReviewForm(
                                'collectedAmount',
                                event.target.value
                              )
                            }
                          />
                        </label>

                        <label className="dreamer-history-field">
                          <span>Despesas</span>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={
                              reviewForm.expensesAmount
                            }
                            placeholder="0,00"
                            onChange={event =>
                              updateReviewForm(
                                'expensesAmount',
                                event.target.value
                              )
                            }
                          />
                        </label>
                      </div>

                      <div className="dreamer-history-preview">
                        <div>
                          <span>
                            Economia prevista
                          </span>

                          <strong>
                            {getReviewPreview()
                              .economyAmount !== null
                              ? `R$ ${getReviewPreview().economyAmount.toLocaleString(
                                  'pt-BR',
                                  {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  }
                                )}`
                              : '—'}
                          </strong>
                        </div>

                        <div>
                          <span>
                            Pontos previstos
                          </span>

                          <strong>
                            {getReviewPreview()
                              .economyPoints !== null
                              ? getReviewPreview()
                                  .economyPoints
                                  .toFixed(2)
                              : '—'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className="dreamer-history-review__warning">
                    <strong>
                      Ainda não vale pontos
                    </strong>
                    <span>
                      Estes números são apenas uma
                      prévia enquanto o evento estiver
                      em revisão.
                    </span>
                  </div>

                  <div className="dreamer-history-form__actions">
                    <button
                      type="button"
                      onClick={closeReview}
                      disabled={savingReview}
                    >
                      Fechar
                    </button>

                    <button
                      type="button"
                      onClick={saveReview}
                      disabled={savingReview}
                    >
                      {savingReview
                        ? 'Salvando...'
                        : 'Salvar revisão'}
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default DreamerHistoricalEventsAdminPanel

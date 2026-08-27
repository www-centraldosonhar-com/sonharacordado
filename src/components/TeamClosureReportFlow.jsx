import {
  useEffect,
  useMemo,
  useState,
} from 'react'


function TeamClosureReportFlow({
  eventId,
  teamId,
  canEdit = false,
  currentFinancialStatus = 'pending',
}) {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [rating, setRating] = useState(0)
  const [ratingComment, setRatingComment] = useState('')
  const [financialStatus, setFinancialStatus] = useState('pending')
  const [reportStatus, setReportStatus] = useState('pending')
  const [returnReason, setReturnReason] = useState('')
  const [returnedAt, setReturnedAt] = useState(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  // No celular, mantém apenas uma etapa principal
  // expandida por vez para reduzir a densidade visual.
  const [openStep, setOpenStep] = useState('report')


  async function request(
    operation,
    payload = {}
  ) {
    const response = await fetch(
      '/api/admin?action=post-event',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          operation,
          eventId: Number(eventId),
          teamId: Number(teamId),
          ...payload,
        }),
      }
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Não foi possível concluir a operação.'
      )
    }

    return result
  }


  async function loadForm() {
    if (!eventId || !teamId) {
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const result = await request(
        'team-report-form'
      )

      const loadedQuestions =
        result.questions || []

      const loadedAnswers = {}

      loadedQuestions.forEach(
        (question) => {
          loadedAnswers[question.id] =
            question.answer_text || ''
        }
      )

      setQuestions(loadedQuestions)
      setAnswers(loadedAnswers)

      setRating(
        Number(result.report?.rating) || 0
      )

      setRatingComment(
        result.report?.rating_comment || ''
      )

      setFinancialStatus(
        result.report?.financial_status ||
        'pending'
      )

      setReportStatus(
        result.report?.status ||
        'pending'
      )

      setReturnReason(
        result.report?.return_reason ||
        ''
      )

      setReturnedAt(
        result.report?.returned_at ||
        null
      )
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    let active = true

    async function load() {
      if (!eventId || !teamId) {
        return
      }

      try {
        const response = await fetch(
          '/api/admin?action=post-event',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              operation:
                'team-report-form',

              eventId:
                Number(eventId),

              teamId:
                Number(teamId),
            }),
          }
        )

        const result =
          await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível carregar o fechamento.'
          )
        }

        if (!active) {
          return
        }

        const loadedQuestions =
          result.questions || []

        const loadedAnswers = {}

        loadedQuestions.forEach(
          (question) => {
            loadedAnswers[
              question.id
            ] =
              question.answer_text ||
              ''
          }
        )

        setQuestions(
          loadedQuestions
        )

        setAnswers(
          loadedAnswers
        )

        setRating(
          Number(
            result.report?.rating
          ) || 0
        )

        setRatingComment(
          result.report
            ?.rating_comment || ''
        )

        setFinancialStatus(
          result.report
            ?.financial_status ||
            'pending'
        )

        setReportStatus(
          result.report?.status ||
            'pending'
        )

        setReturnReason(
          result.report
            ?.return_reason ||
            ''
        )

        setReturnedAt(
          result.report
            ?.returned_at ||
            null
        )
      } catch (error) {
        if (active) {
          setMessage(
            error.message
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      active = false
    }
  }, [
    eventId,
    teamId,
  ])


  const requiredQuestions =
    useMemo(
      () =>
        questions.filter(
          (question) =>
            question.required
        ),
      [questions]
    )


  const answeredRequiredCount =
    useMemo(
      () =>
        requiredQuestions.filter(
          (question) =>
            String(
              answers[
                question.id
              ] || ''
            ).trim()
        ).length,
      [
        answers,
        requiredQuestions,
      ]
    )


  const reportComplete =
    requiredQuestions.length ===
      answeredRequiredCount


  const ratingComplete =
    rating >= 1 &&
    rating <= 5


  const effectiveFinancialStatus =
    currentFinancialStatus !== 'pending'
      ? currentFinancialStatus
      : financialStatus

  const financialComplete =
    effectiveFinancialStatus !== 'pending'


  function buildAnswersPayload() {
    return questions.map(
      (question) => ({
        questionId:
          question.id,

        answer:
          answers[
            question.id
          ] || '',
      })
    )
  }


  async function saveDraft() {
    setSaving(true)
    setMessage('')

    try {
      await request(
        'save-team-report-draft',
        {
          answers:
            buildAnswersPayload(),

          rating,

          ratingComment,
        }
      )

      setMessage(
        'Rascunho salvo. ✨'
      )

      await loadForm()
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setSaving(false)
    }
  }


  async function submitClosure() {
    setSaving(true)
    setMessage('')

    try {
      // Garante que as respostas e a
      // avaliação mais recentes estejam
      // persistidas antes do envio.
      await request(
        'save-team-report-draft',
        {
          answers:
            buildAnswersPayload(),

          rating,

          ratingComment,
        }
      )

      await request(
        'submit-team-report',
        {
          summary: '',
          whatWorked: '',
          whatToImprove: '',
          nextEventNotes: '',
        }
      )

      setReportStatus(
        'submitted'
      )

      setMessage(
        'Fechamento enviado com sucesso! 🤝'
      )
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setSaving(false)
    }
  }


  if (loading) {
    return (
      <div className="team-closure-flow">
        <p>
          Carregando fechamento...
        </p>
      </div>
    )
  }


  return (
    <div className="team-closure-flow">

      {returnReason && (
        <section className="team-closure-return-notice">
          <div>
            <small>
              DEVOLVIDO PARA AJUSTES
            </small>

            <strong>
              O fechamento precisa de correções
            </strong>

            <p>
              {returnReason}
            </p>

            {returnedAt && (
              <span>
                Devolvido em{' '}
                {new Date(
                  returnedAt
                ).toLocaleString(
                  'pt-BR'
                )}
              </span>
            )}
          </div>
        </section>
      )}

      {/* ===============================================
          ETAPA 2 — RELATÓRIO
          =============================================== */}

      <section
        className={`team-closure-step ${
          openStep === 'report'
            ? 'is-open'
            : 'is-collapsed'
        }`}
      >
        <button
          type="button"
          className="team-closure-step-toggle"
          aria-expanded={
            openStep === 'report'
          }
          onClick={() =>
            setOpenStep(
              openStep === 'report'
                ? null
                : 'report'
            )
          }
        >
          <div className="team-closure-step-head">
            <div>
              <small>
                ETAPA 2
              </small>

              <h4>
                Relatório da Equipe
              </h4>

              <p>
                Responda às perguntas
                preparadas para este
                evento.
              </p>
            </div>

            <div className="team-closure-step-side">
              <span
                className={
                  reportComplete
                    ? 'is-complete'
                    : ''
                }
              >
                {answeredRequiredCount}
                /
                {requiredQuestions.length}
              </span>

              <b className="team-closure-chevron">
                {openStep === 'report'
                  ? '⌃'
                  : '⌄'}
              </b>
            </div>
          </div>
        </button>

        <div className="team-closure-step-body">

        {questions.length === 0 ? (
          <div className="team-closure-empty">
            Nenhuma pergunta foi
            configurada para este evento.
          </div>
        ) : (
          <div className="team-closure-questions">
            {questions.map(
              (
                question,
                index
              ) => (
                <label
                  key={
                    question.id
                  }
                  className="team-closure-question"
                >
                  <span>
                    {index + 1}.
                    {' '}
                    {
                      question
                        .question_text
                    }

                    {question.required && (
                      <b>
                        *
                      </b>
                    )}
                  </span>

                  {canEdit ? (
                    <textarea
                      rows="4"
                      value={
                        answers[
                          question.id
                        ] || ''
                      }
                      placeholder="Escreva sua resposta..."
                      onChange={(
                        event
                      ) =>
                        setAnswers(
                          (
                            current
                          ) => ({
                            ...current,

                            [
                              question.id
                            ]:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                    />
                  ) : (
                    <p>
                      {answers[
                        question.id
                      ] ||
                        'Sem resposta.'}
                    </p>
                  )}
                </label>
              )
            )}
          </div>
        )}

        </div>
      </section>


      {/* ===============================================
          ETAPA 3 — AVALIAÇÃO
          =============================================== */}

      <section
        className={`team-closure-step ${
          openStep === 'rating'
            ? 'is-open'
            : 'is-collapsed'
        }`}
      >
        <button
          type="button"
          className="team-closure-step-toggle"
          aria-expanded={
            openStep === 'rating'
          }
          onClick={() =>
            setOpenStep(
              openStep === 'rating'
                ? null
                : 'rating'
            )
          }
        >
          <div className="team-closure-step-head">
            <div>
              <small>
                ETAPA 3
              </small>

              <h4>
                Avaliação do Evento
              </h4>

              <p>
                Como foi a experiência
                desta equipe?
              </p>
            </div>

            <div className="team-closure-step-side">
              <span
                className={
                  ratingComplete
                    ? 'is-complete'
                    : ''
                }
              >
                {ratingComplete
                  ? `${rating}/5`
                  : 'Pendente'}
              </span>

              <b className="team-closure-chevron">
                {openStep === 'rating'
                  ? '⌃'
                  : '⌄'}
              </b>
            </div>
          </div>
        </button>

        <div className="team-closure-step-body">

        <div className="team-closure-rating">
          {[1, 2, 3, 4, 5].map(
            (star) => (
              <button
                key={star}
                type="button"
                disabled={!canEdit}
                className={
                  star <= rating
                    ? 'is-active'
                    : ''
                }
                aria-label={
                  `${star} estrelas`
                }
                onClick={() =>
                  setRating(star)
                }
              >
                ★
              </button>
            )
          )}
        </div>


        {canEdit ? (
          <label className="team-closure-comment">
            <span>
              Comentário
              <small>
                opcional
              </small>
            </span>

            <textarea
              rows="3"
              value={
                ratingComment
              }
              placeholder="Quer deixar algum comentário sobre o evento?"
              onChange={(
                event
              ) =>
                setRatingComment(
                  event
                    .target
                    .value
                )
              }
            />
          </label>
        ) : (
          ratingComment && (
            <div className="team-closure-readonly-comment">
              <small>
                COMENTÁRIO
              </small>

              <p>
                {ratingComment}
              </p>
            </div>
          )
        )}

        </div>
      </section>


      {/* ===============================================
          ETAPA 4 — ENVIO
          =============================================== */}

      <section className="team-closure-submit">
        <div className="team-closure-progress">
          <span
            className={
              financialComplete
                ? 'is-complete'
                : ''
            }
          >
            {financialComplete
              ? '✓'
              : '1'}
            {' '}
            Financeiro
          </span>

          <span
            className={
              reportComplete
                ? 'is-complete'
                : ''
            }
          >
            {reportComplete
              ? '✓'
              : '2'}
            {' '}
            Relatório
          </span>

          <span
            className={
              ratingComplete
                ? 'is-complete'
                : ''
            }
          >
            {ratingComplete
              ? '✓'
              : '3'}
            {' '}
            Avaliação
          </span>
        </div>


        {canEdit && (
          <div className="team-closure-actions">
            <button
              type="button"
              disabled={saving}
              onClick={
                saveDraft
              }
            >
              💾 Salvar rascunho
            </button>

            <button
              type="button"
              className="is-primary"
              disabled={
                saving ||
                !financialComplete ||
                !reportComplete ||
                !ratingComplete
              }
              onClick={
                submitClosure
              }
            >
              {reportStatus ===
              'submitted'
                ? '📨 Atualizar Fechamento'
                : '📨 Enviar Fechamento'}
            </button>
          </div>
        )}


        {!canEdit &&
          reportStatus ===
            'submitted' && (
          <div className="team-closure-sent">
            ✓ Fechamento enviado
          </div>
        )}


        {message && (
          <p className="admin-action-message">
            {message}
          </p>
        )}
      </section>
    </div>
  )
}


export default TeamClosureReportFlow

import {
  useEffect,
  useState,
} from 'react'


function PostEventQuestionsEditor({
  eventId,
}) {
  const [
    questions,
    setQuestions,
  ] = useState([])

  const [
    questionText,
    setQuestionText,
  ] = useState('')

  const [
    required,
    setRequired,
  ] = useState(true)

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    editingId,
    setEditingId,
  ] = useState(null)

  const [
    editingText,
    setEditingText,
  ] = useState('')

  const [
    message,
    setMessage,
  ] = useState('')


  // =====================================================
  // API
  // =====================================================

  async function request(
    operation,
    payload = {}
  ) {
    const response = await fetch(
      '/api/admin?action=post-event',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          operation,
          eventId:
            Number(eventId),

          ...payload,
        }),
      }
    )

    const result =
      await response.json()

    if (!response.ok) {
      throw new Error(
        result.error ||
        'Não foi possível concluir a operação.'
      )
    }

    return result
  }


  // =====================================================
  // LOAD
  // =====================================================

  async function loadQuestions() {
    if (!eventId) {
      setQuestions([])
      return
    }

    setLoading(true)

    try {
      const result =
        await request(
          'list-report-questions'
        )

      setQuestions(
        result.questions || []
      )
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    let active = true

    async function load() {
      if (!eventId) {
        if (active) {
          setQuestions([])
        }

        return
      }

      setLoading(true)

      try {
        const response =
          await fetch(
            '/api/admin?action=post-event',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  operation:
                    'list-report-questions',

                  eventId:
                    Number(eventId),
                }),
            }
          )

        const result =
          await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível carregar as perguntas.'
          )
        }

        if (active) {
          setQuestions(
            result.questions || []
          )
        }
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
  ])


  // =====================================================
  // CREATE
  // =====================================================

  async function createQuestion(
    event
  ) {
    event.preventDefault()

    const clean =
      questionText.trim()

    if (!clean) {
      setMessage(
        'Digite uma pergunta.'
      )

      return
    }

    setSaving(true)
    setMessage('')

    try {
      await request(
        'create-report-question',
        {
          questionText:
            clean,

          required,
        }
      )

      setQuestionText('')
      setRequired(true)

      await loadQuestions()

      setMessage(
        'Pergunta adicionada. ✨'
      )
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setSaving(false)
    }
  }


  // =====================================================
  // UPDATE
  // =====================================================

  async function updateQuestion(
    question
  ) {
    const clean =
      editingText.trim()

    if (!clean) {
      return
    }

    setSaving(true)
    setMessage('')

    try {
      await request(
        'update-report-question',
        {
          questionId:
            question.id,

          questionText:
            clean,

          required:
            question.required,

          position:
            question.position,
        }
      )

      setEditingId(null)
      setEditingText('')

      await loadQuestions()

      setMessage(
        'Pergunta atualizada.'
      )
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setSaving(false)
    }
  }


  async function toggleRequired(
    question
  ) {
    setSaving(true)
    setMessage('')

    try {
      await request(
        'update-report-question',
        {
          questionId:
            question.id,

          questionText:
            question.question_text,

          required:
            !question.required,

          position:
            question.position,
        }
      )

      await loadQuestions()
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setSaving(false)
    }
  }


  // =====================================================
  // DELETE / SOFT DELETE
  // =====================================================

  async function removeQuestion(
    question
  ) {
    const confirmed =
      window.confirm(
        `Remover esta pergunta?\n\n"${question.question_text}"\n\nAs respostas antigas serão preservadas.`
      )

    if (!confirmed) {
      return
    }

    setSaving(true)
    setMessage('')

    try {
      await request(
        'delete-report-question',
        {
          questionId:
            question.id,
        }
      )

      await loadQuestions()

      setMessage(
        'Pergunta removida da configuração.'
      )
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setSaving(false)
    }
  }


  if (!eventId) {
    return null
  }


  return (
    <section className="post-event-question-editor">
      <div className="post-event-question-editor-head">
        <div>
          <small>
            ETAPA 2
          </small>

          <h3>
            Perguntas do Relatório
          </h3>

          <p>
            Estas perguntas serão
            respondidas por todas as
            equipes no fechamento.
          </p>
        </div>

        <span>
          {questions.length}
          {' '}
          {questions.length === 1
            ? 'pergunta'
            : 'perguntas'}
        </span>
      </div>


      {loading ? (
        <p className="admin-form-help">
          Carregando perguntas...
        </p>
      ) : questions.length === 0 ? (
        <div className="post-event-question-empty">
          <strong>
            Nenhuma pergunta configurada
          </strong>

          <span>
            Adicione as perguntas que
            farão parte do relatório
            deste evento.
          </span>
        </div>
      ) : (
        <div className="post-event-question-list">
          {questions.map(
            (
              question,
              index
            ) => (
              <article
                key={
                  question.id
                }
                className="post-event-question-item"
              >
                <div className="post-event-question-number">
                  {index + 1}
                </div>

                <div className="post-event-question-content">
                  {editingId ===
                  question.id ? (
                    <textarea
                      rows="3"
                      value={
                        editingText
                      }
                      onChange={(
                        event
                      ) =>
                        setEditingText(
                          event
                            .target
                            .value
                        )
                      }
                    />
                  ) : (
                    <strong>
                      {
                        question
                          .question_text
                      }
                    </strong>
                  )}

                  <div className="post-event-question-meta">
                    <button
                      type="button"
                      disabled={
                        saving
                      }
                      onClick={() =>
                        toggleRequired(
                          question
                        )
                      }
                    >
                      {
                        question.required
                          ? 'Obrigatória'
                          : 'Opcional'
                      }
                    </button>
                  </div>
                </div>

                <div className="post-event-question-actions">
                  {editingId ===
                  question.id ? (
                    <>
                      <button
                        type="button"
                        disabled={
                          saving
                        }
                        onClick={() =>
                          updateQuestion(
                            question
                          )
                        }
                      >
                        Salvar
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(
                            null
                          )

                          setEditingText(
                            ''
                          )
                        }}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(
                            question.id
                          )

                          setEditingText(
                            question
                              .question_text
                          )
                        }}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        className="is-danger"
                        onClick={() =>
                          removeQuestion(
                            question
                          )
                        }
                      >
                        Remover
                      </button>
                    </>
                  )}
                </div>
              </article>
            )
          )}
        </div>
      )}


      <form
        className="post-event-question-create"
        onSubmit={
          createQuestion
        }
      >
        <label>
          <span>
            Nova pergunta
          </span>

          <textarea
            rows="3"
            maxLength="500"
            placeholder="Ex.: O que funcionou melhor na atuação da sua equipe?"
            value={
              questionText
            }
            onChange={(
              event
            ) =>
              setQuestionText(
                event
                  .target
                  .value
              )
            }
          />
        </label>

        <div className="post-event-question-create-footer">
          <label className="post-event-question-required">
            <input
              type="checkbox"
              checked={
                required
              }
              onChange={(
                event
              ) =>
                setRequired(
                  event
                    .target
                    .checked
                )
              }
            />

            <span>
              Resposta obrigatória
            </span>
          </label>

          <button
            type="submit"
            disabled={
              saving ||
              !questionText.trim()
            }
          >
            + Adicionar pergunta
          </button>
        </div>
      </form>


      {message && (
        <p className="admin-action-message">
          {message}
        </p>
      )}
    </section>
  )
}


export default PostEventQuestionsEditor

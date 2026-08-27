import {
  useEffect,
  useMemo,
  useState,
} from 'react'


// =========================================================
// COR DO PROJETO
// =========================================================

function getProjectKey(
  project
) {
  const normalized =
    String(project || '')
      .trim()
      .toUpperCase()

  if (
    normalized.includes(
      'APS'
    )
  ) {
    return 'aps'
  }

  if (
    normalized.includes(
      'PPF'
    )
  ) {
    return 'ppf'
  }

  if (
    normalized.includes(
      'SJ'
    )
  ) {
    return 'sj'
  }

  return 'default'
}


// =========================================================
// DATA
// =========================================================

function formatEventDate(
  value
) {
  if (!value) {
    return ''
  }

  const date =
    new Date(
      `${String(value).slice(0, 10)}T12:00:00`
    )

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return ''
  }

  return date.toLocaleDateString(
    'pt-BR',
    {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }
  )
}


// =========================================================
// MODAL
// =========================================================

function PostEventFeedbackModal({
  user,
}) {
  const [
    event,
    setEvent,
  ] = useState(null)

  const [
    rating,
    setRating,
  ] = useState(0)

  const [
    comment,
    setComment,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(true)

  const [
    saving,
    setSaving,
  ] = useState(false)

  const [
    message,
    setMessage,
  ] = useState('')


  const projectKey =
    useMemo(
      () =>
        getProjectKey(
          user?.project
        ),
      [
        user?.project,
      ]
    )


  // =======================================================
  // BUSCA EVENTO PENDENTE
  // =======================================================

  useEffect(() => {
    let active = true

    async function loadPending() {
      try {
        const response =
          await fetch(
            '/api/auth?action=post-event-feedback'
          )

        const result =
          await response.json()

        if (!response.ok) {
          throw new Error(
            result.error ||
            'Não foi possível carregar a avaliação.'
          )
        }

        if (active) {
          setEvent(
            result.event ||
            null
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

    loadPending()

    return () => {
      active = false
    }
  }, [])


  // =======================================================
  // ENVIAR
  // =======================================================

  async function submitFeedback(
    submitEvent
  ) {
    submitEvent.preventDefault()

    if (
      !event ||
      rating < 1 ||
      rating > 5
    ) {
      setMessage(
        'Escolha de 1 a 5 corações para continuar.'
      )

      return
    }

    setSaving(true)
    setMessage('')

    try {
      const response =
        await fetch(
          '/api/auth?action=post-event-feedback',
          {
            method:
              'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                eventId:
                  event.id,

                rating,
                comment,
              }),
          }
        )

      const result =
        await response.json()

      if (!response.ok) {
        throw new Error(
          result.error ||
          'Não foi possível enviar sua avaliação.'
        )
      }

      setRating(0)
      setComment('')

      // Próximo evento pendente.
      // Se for null, o modal desaparece.
      setEvent(
        result.event ||
        null
      )
    } catch (error) {
      setMessage(
        error.message
      )
    } finally {
      setSaving(false)
    }
  }


  if (
    loading ||
    !event
  ) {
    return null
  }


  return (
    <div className="post-feedback-overlay">
      <section
        className={
          `post-feedback-modal project-${projectKey}`
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-feedback-title"
      >

        <div
          className="post-feedback-heart-mark"
          aria-hidden="true"
        >
          ♥
        </div>


        <div className="post-feedback-heading">
          <small>
            PÓS-EVENTO
          </small>

          <h2 id="post-feedback-title">
            Como foi o evento?
          </h2>

          <strong>
            {event.name}
          </strong>

          {event.event_date && (
            <span>
              {formatEventDate(
                event.event_date
              )}
            </span>
          )}

          <p>
            Sua experiência ajuda a
            gente a fazer o próximo
            sonho ainda melhor.
          </p>
        </div>


        <form
          className="post-feedback-form"
          onSubmit={
            submitFeedback
          }
        >

          <fieldset>
            <legend>
              Sua avaliação
            </legend>

            <div className="post-feedback-hearts">
              {[1, 2, 3, 4, 5].map(
                (heart) => (
                  <button
                    key={heart}
                    type="button"
                    className={
                      heart <= rating
                        ? 'is-active'
                        : ''
                    }
                    aria-label={
                      `${heart} ${
                        heart === 1
                          ? 'coração'
                          : 'corações'
                      }`
                    }
                    aria-pressed={
                      heart === rating
                    }
                    onClick={() =>
                      setRating(
                        heart
                      )
                    }
                  >
                    ♥
                  </button>
                )
              )}
            </div>

            <span className="post-feedback-rating-copy">
              {rating > 0
                ? `${rating} de 5 corações`
                : 'Toque nos corações para avaliar'}
            </span>
          </fieldset>


          <label className="post-feedback-comment">
            <span>
              Quer contar mais?

              <small>
                opcional
              </small>
            </span>

            <textarea
              rows="4"
              maxLength="1500"
              value={
                comment
              }
              placeholder="Conte pra gente o que tornou esse evento especial ou o que podemos melhorar..."
              onChange={(
                changeEvent
              ) =>
                setComment(
                  changeEvent
                    .target
                    .value
                )
              }
            />
          </label>


          {message && (
            <p
              className="post-feedback-message"
              role="status"
            >
              {message}
            </p>
          )}


          <button
            type="submit"
            className="post-feedback-submit"
            disabled={
              saving ||
              rating < 1
            }
          >
            {saving
              ? 'Enviando...'
              : 'Enviar avaliação'}
          </button>


          <small className="post-feedback-required-note">
            Escolher uma avaliação é
            necessário para continuar.
            O comentário é opcional.
          </small>

        </form>
      </section>
    </div>
  )
}


export default PostEventFeedbackModal

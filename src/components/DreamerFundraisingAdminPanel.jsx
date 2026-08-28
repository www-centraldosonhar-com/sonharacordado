import {
  useEffect,
  useMemo,
  useState,
} from 'react'

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

function statusLabel(status) {
  return {
    pending: 'Pendente',
    validated: 'Validada',
    rejected: 'Reprovada',
    correction_requested: 'Correção solicitada',
  }[status] || status
}

function DreamerFundraisingAdminPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('pending')
  const [reviewing, setReviewing] = useState(null)

  async function load() {
    setError('')

    try {
      const response = await fetch(
        '/api/dreamer?action=fundraising&scope=admin'
      )
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            'Não foi possível carregar as arrecadações.'
        )
      }

      setData(payload)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    fetch('/api/dreamer?action=fundraising&scope=admin')
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(
            payload?.error ||
              'Não foi possível carregar as arrecadações.'
          )
        }
        return payload
      })
      .then(payload => {
        if (active) setData(payload)
      })
      .catch(fetchError => {
        if (active) setError(fetchError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const entries = useMemo(() => {
    const all = data?.entries || []
    if (filter === 'all') return all
    return all.filter(entry =>
      filter === 'review'
        ? ['pending', 'correction_requested'].includes(
            entry.status
          )
        : entry.status === filter
    )
  }, [data, filter])

  async function openReceipt(receiptId) {
    // Mobile browsers (especially Safari) block window.open() when it runs
    // only after an awaited request. Open the tab synchronously from the tap,
    // then redirect it after the signed URL is returned by the backend.
    const receiptWindow = window.open('', '_blank')

    setError('')

    try {
      const response = await fetch(
        '/api/dreamer?action=fundraising',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: 'receipt-url',
            receiptId,
          }),
        }
      )
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error)
      }

      if (receiptWindow) {
        receiptWindow.opener = null
        receiptWindow.location.href = payload.signedUrl
      } else {
        // Last-resort fallback for browsers that block even the synchronous tab.
        window.location.assign(payload.signedUrl)
      }
    } catch (openError) {
      if (receiptWindow && !receiptWindow.closed) {
        receiptWindow.close()
      }
      setError(
        openError.message ||
          'Não foi possível abrir o comprovante.'
      )
    }
  }

  async function review(entry, decision) {
    const needsReason =
      decision !== 'validated'

    let reviewReason = ''

    if (needsReason) {
      reviewReason = window.prompt(
        decision === 'correction_requested'
          ? 'Qual correção precisa ser feita?'
          : 'Informe o motivo da reprovação:'
      ) || ''

      if (!reviewReason.trim()) return
    }

    const actionLabel = {
      validated: 'validar',
      rejected: 'reprovar',
      correction_requested: 'pedir correção desta',
    }[decision]

    if (
      !window.confirm(
        `Confirma ${actionLabel} arrecadação de ${formatCurrency(entry.net_amount)} para ${entry.project}?`
      )
    ) {
      return
    }

    setReviewing(entry.id)
    setError('')
    setMessage('')

    try {
      const response = await fetch(
        '/api/dreamer?action=fundraising',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: 'review',
            entryId: entry.id,
            decision,
            reviewReason,
          }),
        }
      )
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            'Não foi possível concluir a revisão.'
        )
      }

      setMessage(payload.message)
      await load()
    } catch (reviewError) {
      setError(reviewError.message)
    } finally {
      setReviewing(null)
    }
  }

  if (loading) {
    return (
      <div className="dreamer-admin-fundraising-state">
        Carregando arrecadações…
      </div>
    )
  }

  const summary = data?.summary || {}

  return (
    <div className="dreamer-admin-fundraising">
      <section className="dreamer-admin-fundraising__hero">
        <div>
          <span className="dreamer-eyebrow">
            OLIMPÍADA SONHADORA
          </span>
          <h2>Validação de arrecadações</h2>
          <p>
            Confira origem, valores, custos e comprovantes antes de qualquer valor entrar no placar oficial.
          </p>
        </div>

        <div className="dreamer-admin-fundraising__metrics">
          <span>
            <small>Pendentes</small>
            <strong>{Number(summary.pending_count || 0)}</strong>
          </span>
          <span>
            <small>Duplicidades</small>
            <strong>{Number(summary.duplicate_count || 0)}</strong>
          </span>
          <span>
            <small>Validado</small>
            <strong>{formatCurrency(summary.validated_total)}</strong>
          </span>
        </div>
      </section>

      <div className="dreamer-admin-fundraising__filters">
        {[
          ['review', 'Para revisar'],
          ['validated', 'Validadas'],
          ['rejected', 'Reprovadas'],
          ['all', 'Todas'],
        ].map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={
              filter === value ? 'is-active' : ''
            }
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="dreamer-admin-fundraising__message is-error">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="dreamer-admin-fundraising__message is-success">
          {message}
        </p>
      ) : null}

      <section className="dreamer-admin-fundraising__list">
        {entries.length ? (
          entries.map(entry => (
            <article
              key={entry.id}
              className={
                entry.possible_duplicate
                  ? 'has-duplicate-warning'
                  : ''
              }
            >
              <header>
                <div>
                  <span className="dreamer-admin-fundraising__project">
                    {entry.project}
                  </span>
                  <strong>{entry.title}</strong>
                  <small>
                    por {entry.submitted_by_name}
                  </small>
                </div>
                <span className={`is-${entry.status}`}>
                  {statusLabel(entry.status)}
                </span>
              </header>

              {entry.possible_duplicate ? (
                <div className="dreamer-admin-fundraising__duplicate">
                  ⚠ Possível comprovante duplicado. Confira antes de validar.
                </div>
              ) : null}

              <div className="dreamer-admin-fundraising__values">
                <span>
                  <small>Bruto</small>
                  <strong>{formatCurrency(entry.gross_amount)}</strong>
                </span>
                <span>
                  <small>Custos</small>
                  <strong>{formatCurrency(entry.cost_amount)}</strong>
                </span>
                <span>
                  <small>Líquido</small>
                  <strong>{formatCurrency(entry.net_amount)}</strong>
                </span>
                <span>
                  <small>Data</small>
                  <strong>
                    {entry.received_at
                      ? new Date(
                          `${String(entry.received_at).slice(0, 10)}T12:00:00`
                        ).toLocaleDateString('pt-BR')
                      : '—'}
                  </strong>
                </span>
              </div>

              <div className="dreamer-admin-fundraising__details">
                <p>
                  <b>Iniciativa:</b> {entry.initiative_type}
                </p>
                {entry.notes ? <p>{entry.notes}</p> : null}
                {entry.review_reason ? (
                  <p>
                    <b>Revisão:</b> {entry.review_reason}
                  </p>
                ) : null}
              </div>

              {entry.status === 'correction_requested' ? (
                <p className="dreamer-admin-fundraising__waiting">
                  Aguardando o responsável corrigir e reenviar este registro.
                </p>
              ) : null}

              <footer>
                {entry.receipt_id ? (
                  <button
                    type="button"
                    className="is-secondary"
                    onClick={() =>
                      openReceipt(entry.receipt_id)
                    }
                  >
                    Ver comprovante ↗
                  </button>
                ) : null}

                {entry.status === 'pending' ? (
                  <div>
                    <button
                      type="button"
                      className="is-correction"
                      disabled={reviewing === entry.id}
                      onClick={() =>
                        review(
                          entry,
                          'correction_requested'
                        )
                      }
                    >
                      Pedir correção
                    </button>
                    <button
                      type="button"
                      className="is-reject"
                      disabled={reviewing === entry.id}
                      onClick={() =>
                        review(entry, 'rejected')
                      }
                    >
                      Reprovar
                    </button>
                    <button
                      type="button"
                      className="is-validate"
                      disabled={reviewing === entry.id}
                      onClick={() =>
                        review(entry, 'validated')
                      }
                    >
                      Validar ✓
                    </button>
                  </div>
                ) : null}
              </footer>
            </article>
          ))
        ) : (
          <div className="dreamer-admin-fundraising__empty">
            <span>✓</span>
            <strong>Nada por aqui.</strong>
            <small>
              Não existem arrecadações neste filtro.
            </small>
          </div>
        )}
      </section>
    </div>
  )
}

export default DreamerFundraisingAdminPanel

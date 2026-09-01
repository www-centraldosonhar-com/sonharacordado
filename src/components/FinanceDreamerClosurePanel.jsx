import { useEffect, useState } from 'react'

function currency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

export default function FinanceDreamerClosurePanel() {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(null)

  async function load() {
    try {
      const response = await fetch('/api/finance?operation=dreamer-closures')
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar os fechamentos do Sócio.')
      setRows(payload.closures || [])
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  useEffect(() => {
    let active = true
    fetch('/api/finance?operation=dreamer-closures')
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar os fechamentos do Sócio.')
        return payload
      })
      .then(payload => { if (active) setRows(payload.closures || []) })
      .catch(fetchError => { if (active) setError(fetchError.message) })
    return () => { active = false }
  }, [])

  async function confirmReceived(id) {
    setBusy(id)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/finance?operation=dreamer-closure-received', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closureId: id }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível confirmar o recebimento.')
      setMessage(payload.message)
      await load()
    } catch (confirmError) {
      setError(confirmError.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="finance-dreamer-closures">
      <div className="finance-dreamer-closures__heading">
        <div>
          <span>SÓCIO SONHADOR</span>
          <h3>Fechamentos encaminhados</h3>
          <p>Consolidados oficiais enviados pelo Admin Sócio para conciliação e prestação financeira.</p>
        </div>
      </div>

      {error ? <div className="finance-dreamer-closures__notice is-error">{error}</div> : null}
      {message ? <div className="finance-dreamer-closures__notice is-success">{message}</div> : null}

      {rows.length ? (
        <div className="finance-dreamer-closures__list">
          {rows.map(item => (
            <article key={item.id}>
              <div className="finance-dreamer-closures__title">
                <div>
                  <small>{item.status === 'finance_received' ? 'Recebido ✓' : 'Aguardando recebimento'}</small>
                  <strong>{item.campaign_name}</strong>
                  <span>Enviado por {item.sent_by_name || 'Admin Sócio'} · {item.sent_to_finance_at ? new Date(item.sent_to_finance_at).toLocaleString('pt-BR') : '—'}</span>
                </div>
                {item.status === 'sent_to_finance' ? (
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => confirmReceived(item.id)}
                  >
                    {busy === item.id ? 'Confirmando…' : 'Confirmar recebimento'}
                  </button>
                ) : null}
              </div>
              <div className="finance-dreamer-closures__totals">
                <span><small>Bruto</small><b>{currency(item.gross_total)}</b></span>
                <span><small>Custos</small><b>{currency(item.cost_total)}</b></span>
                <span><small>Líquido</small><b>{currency(item.net_total)}</b></span>
              </div>
              {item.finance_notes ? <p className="finance-dreamer-closures__notes">Admin Sócio: {item.finance_notes}</p> : null}
              {item.closure_notes ? <p className="finance-dreamer-closures__notes">Fechamento: {item.closure_notes}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="finance-dreamer-closures__empty">Nenhum fechamento do Sócio Sonhador foi encaminhado ao Financeiro ainda.</div>
      )}
    </section>
  )
}

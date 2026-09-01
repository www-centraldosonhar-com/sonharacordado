import { useEffect, useState } from 'react'

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function statusLabel(status) {
  return {
    pending: 'Aguardando comprovante',
    pending_payment_review: 'Para revisar',
    correction_requested: 'Correção solicitada',
    confirmed: 'Confirmada',
    rejected: 'Reprovada',
    cancelled: 'Cancelada',
  }[status] || status
}

export default function DreamerContributionsAdminPanel() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reviewingId, setReviewingId] = useState(null)

  useEffect(() => {
    let active = true
    fetch('/api/dreamer?action=contributions')
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar as doações.')
        return payload
      })
      .then(payload => { if (active) setData(payload) })
      .catch(fetchError => { if (active) setError(fetchError.message) })
    return () => { active = false }
  }, [])

  const summary = data?.admin?.summary || {}
  const rows = data?.admin?.contributions || []

  async function openReceipt(id) {
    const receiptWindow = window.open('', '_blank')
    setError('')

    try {
      const response = await fetch('/api/dreamer?action=contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'receipt-url', contributionId: id }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível abrir o comprovante.')

      if (receiptWindow) {
        receiptWindow.opener = null
        receiptWindow.location.href = payload.signedUrl
      } else {
        window.location.assign(payload.signedUrl)
      }
    } catch (openError) {
      if (receiptWindow && !receiptWindow.closed) receiptWindow.close()
      setError(openError.message)
    }
  }

  async function review(item, decision) {
    let reviewReason = ''

    if (decision !== 'confirmed') {
      reviewReason = window.prompt(
        decision === 'correction_requested'
          ? 'O que precisa ser corrigido?'
          : 'Informe o motivo da reprovação:'
      )?.trim() || ''

      if (!reviewReason) return
    }

    setReviewingId(item.id)
    setError('')
    setNotice('')

    try {
      const response = await fetch('/api/dreamer?action=contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'review',
          contributionId: item.id,
          decision,
          reviewReason,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível revisar a contribuição.')

      setData(payload)
      setNotice(payload.message || 'Revisão concluída.')
    } catch (reviewError) {
      setError(reviewError.message)
    } finally {
      setReviewingId(null)
    }
  }

  return (
    <div className="dreamer-contributions-admin">
      <section className="dreamer-community-admin__hero">
        <div>
          <span className="dreamer-eyebrow">DOAÇÕES DIRETAS · PIX</span>
          <h2>Validação de comprovantes</h2>
          <p>Confira o comprovante antes de confirmar. Somente apoios confirmados entram nos totais e, quando vinculados à Olimpíada, no placar oficial.</p>
        </div>

        <div className="dreamer-community-admin__stats">
          <span><strong>{Number(summary.pending_review || 0)}</strong><small>Para revisar</small></span>
          <span><strong>{Number(summary.confirmed || 0)}</strong><small>Confirmadas</small></span>
          <span><strong>{money(summary.confirmed_amount || 0)}</strong><small>Confirmado</small></span>
        </div>
      </section>

      {error ? <div className="dreamer-community-admin__notice is-error">{error}</div> : null}
      {notice ? <div className="dreamer-community-admin__notice is-success">{notice}</div> : null}

      <div className="dreamer-contributions-admin__guard">🔒 Comprovantes privados · PIX por CNPJ · confirmação exclusiva do Admin Sócio.</div>

      <section className="dreamer-community-list">
        {rows.length ? rows.map(item => (
          <article key={item.id}>
            <div>
              <span>{item.project || 'SONHAR SP'} · {statusLabel(item.status)}</span>
              <strong>{item.contributor || 'Apoiador'} · {money(item.amount)}</strong>
              <small>{item.message || 'Sem mensagem'} · {item.payment_reference}</small>
              {item.review_reason ? <small>Revisão: {item.review_reason}</small> : null}
            </div>

            <div className="dreamer-community-list__meta">
              <b>{item.campaign_id ? 'Olimpíada' : 'Doação livre'}</b>

              {item.payment_receipt_path ? (
                <button type="button" onClick={() => openReceipt(item.id)}>
                  Ver comprovante ↗
                </button>
              ) : null}

              {item.status === 'pending_payment_review' ? (
                <>
                  <button
                    type="button"
                    disabled={reviewingId === item.id}
                    onClick={() => review(item, 'correction_requested')}
                  >
                    Pedir correção
                  </button>

                  <button
                    type="button"
                    disabled={reviewingId === item.id}
                    onClick={() => review(item, 'rejected')}
                  >
                    Reprovar
                  </button>

                  <button
                    type="button"
                    disabled={reviewingId === item.id}
                    onClick={() => review(item, 'confirmed')}
                  >
                    Confirmar PIX ✓
                  </button>
                </>
              ) : null}
            </div>
          </article>
        )) : <div className="dreamer-community-list__empty">Nenhuma doação direta registrada ainda.</div>}
      </section>
    </div>
  )
}

import { useEffect, useState } from 'react'

function currency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

function points(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function statusLabel(status) {
  return {
    closed: 'Fechada',
    sent_to_finance: 'Encaminhada ao Financeiro',
    finance_received: 'Recebida pelo Financeiro',
  }[status] || 'Em andamento'
}

export default function DreamerClosureAdminPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [notes, setNotes] = useState('')
  const [financeNotes, setFinanceNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setError('')
    try {
      const response = await fetch('/api/dreamer?action=closure')
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Não foi possível carregar o fechamento.')
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
    fetch('/api/dreamer?action=closure')
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar o fechamento.')
        return payload
      })
      .then(payload => { if (active) setData(payload) })
      .catch(fetchError => { if (active) setError(fetchError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function post(operation, extra = {}) {
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/dreamer?action=closure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, ...extra }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(
          payload?.blockers?.length
            ? `${payload.error} ${payload.blockers.join(' ')}`
            : payload?.error || 'Não foi possível concluir a operação.'
        )
      }
      setMessage(payload.message || 'Operação concluída.')
      await load()
    } catch (postError) {
      setError(postError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="dreamer-closure-state">Carregando fechamento…</div>
  }

  const summary = data?.summary || {}
  const closure = data?.closure
  const ranking = summary?.ranking || []
  const blockers = summary?.blockers || []
  const warnings = summary?.warnings || []
  const isClosed = ['closed', 'sent_to_finance', 'finance_received'].includes(closure?.status)
  const sentToFinance = ['sent_to_finance', 'finance_received'].includes(closure?.status)
  const financeReceived = closure?.status === 'finance_received'

  return (
    <div className="dreamer-closure-admin">
      <section className="dreamer-closure-admin__hero">
        <div>
          <span className="dreamer-eyebrow">OLIMPÍADA SONHADORA</span>
          <h2>Fechamento oficial da campanha</h2>
          <p>
            Revise o placar, resolva pendências e congele o resultado antes de encaminhar o consolidado ao Financeiro.
          </p>
        </div>
        <span className={`dreamer-closure-admin__status ${isClosed ? 'is-closed' : ''}`}>
          {statusLabel(closure?.status)}
        </span>
      </section>

      {error ? <div className="dreamer-closure-notice is-error">{error}</div> : null}
      {message ? <div className="dreamer-closure-notice is-success">{message}</div> : null}

      <section className="dreamer-closure-admin__totals">
        <article><small>Bruto consolidado</small><strong>{currency(summary?.totals?.gross)}</strong></article>
        <article><small>Custos validados</small><strong>{currency(summary?.totals?.costs)}</strong></article>
        <article className="is-highlight"><small>Líquido oficial</small><strong>{currency(summary?.totals?.net)}</strong></article>
      </section>

      <section className="dreamer-closure-admin__section">
        <div className="dreamer-closure-admin__heading">
          <div><span>PLACAR CONSOLIDADO</span><h3>Resultado por projeto</h3></div>
          <small>{summary?.frequency?.eventCount || 0} evento(s) calculado(s) na frequência</small>
        </div>

        <div className="dreamer-closure-ranking">
          {ranking.map(team => (
            <article key={team.projectId} className={`project-${String(team.project || '').toLowerCase()}`}>
              <div className="dreamer-closure-ranking__title">
                <span>#{team.position}</span>
                <strong>{team.project}</strong>
                <b>{points(team.totalPoints)} pts</b>
              </div>
              <div className="dreamer-closure-ranking__money">
                <span><small>Bruto</small><strong>{currency(team.grossTotal)}</strong></span>
                <span><small>Custos</small><strong>{currency(team.costTotal)}</strong></span>
                <span><small>Líquido</small><strong>{currency(team.netTotal)}</strong></span>
              </div>
              <div className="dreamer-closure-ranking__points">
                <span>Arrecadação <b>{points(team.fundraisingPoints)}</b></span>
                <span>Frequência <b>{points(team.frequencyPoints)}</b></span>
                <span>Missões <b>{points(team.missionPoints)}</b></span>
                <span>Indicações <b>{points(team.referralPoints)}</b></span>
                <span>Ajustes <b>{points(team.adjustmentPoints)}</b></span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {!isClosed ? (
        <section className="dreamer-closure-admin__section">
          <div className="dreamer-closure-admin__heading">
            <div><span>CHECKLIST</span><h3>Antes de fechar</h3></div>
          </div>

          {blockers.length ? (
            <div className="dreamer-closure-checklist is-blocked">
              <strong>Existem pendências obrigatórias</strong>
              {blockers.map(item => <p key={item}>● {item}</p>)}
            </div>
          ) : (
            <div className="dreamer-closure-checklist is-ready">
              <strong>Sem pendências obrigatórias 🎉</strong>
              <p>O fechamento já pode ser realizado quando a comissão considerar o placar concluído.</p>
            </div>
          )}

          {warnings.length ? (
            <div className="dreamer-closure-checklist is-warning">
              <strong>Confira também</strong>
              {warnings.map(item => <p key={item}>○ {item}</p>)}
            </div>
          ) : null}

          <div className="dreamer-closure-admin__confirm">
            <label>
              Observação do fechamento
              <textarea
                value={notes}
                onChange={event => setNotes(event.target.value)}
                placeholder="Opcional: registre observações da comissão organizadora."
              />
            </label>
            <label>
              Para confirmar, digite exatamente <b>{data?.campaign?.name}</b>
              <input
                value={confirmation}
                onChange={event => setConfirmation(event.target.value)}
                placeholder={data?.campaign?.name || ''}
              />
            </label>
            <button
              type="button"
              disabled={saving || blockers.length > 0 || confirmation !== data?.campaign?.name}
              onClick={() => {
                if (window.confirm('Fechar a Olimpíada congela o placar oficial. Deseja continuar?')) {
                  post('close', { confirmation, notes })
                }
              }}
            >
              {saving ? 'Fechando…' : 'Fechar e congelar placar'}
            </button>
          </div>
        </section>
      ) : (
        <section className="dreamer-closure-admin__section dreamer-closure-admin__frozen">
          <span>🔒 RESULTADO CONGELADO</span>
          <h3>Esta versão é o fechamento oficial.</h3>
          <p>
            Fechado por {closure?.closed_by_name || 'Admin Sócio'} em {closure?.closed_at ? new Date(closure.closed_at).toLocaleString('pt-BR') : 'data registrada no sistema'}.
          </p>
          {closure?.closure_notes ? <blockquote>{closure.closure_notes}</blockquote> : null}
        </section>
      )}

      {isClosed ? (
        <section className="dreamer-closure-admin__section">
          <div className="dreamer-closure-admin__heading">
            <div><span>FINANCEIRO</span><h3>Encaminhamento do consolidado</h3></div>
          </div>

          {sentToFinance ? (
            <div className="dreamer-closure-checklist is-ready">
              <strong>{financeReceived ? 'Recebido pelo Financeiro ✓' : 'Encaminhado ao Financeiro ✓'}</strong>
              <p>
                Marcado por {closure?.sent_to_finance_by_name || 'Admin Sócio'} em {closure?.sent_to_finance_at ? new Date(closure.sent_to_finance_at).toLocaleString('pt-BR') : 'data registrada no sistema'}.
              </p>
              {financeReceived ? (
                <p>
                  Recebimento confirmado por {closure?.finance_received_by_name || 'Financeiro'} em {closure?.finance_received_at ? new Date(closure.finance_received_at).toLocaleString('pt-BR') : 'data registrada no sistema'}.
                </p>
              ) : null}
              {closure?.finance_notes ? <p>{closure.finance_notes}</p> : null}
            </div>
          ) : (
            <div className="dreamer-closure-admin__confirm">
              <label>
                Observação para o Financeiro
                <textarea
                  value={financeNotes}
                  onChange={event => setFinanceNotes(event.target.value)}
                  placeholder="Opcional: informe detalhes úteis para conciliação e prestação."
                />
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (window.confirm('Marcar este fechamento como encaminhado ao Financeiro?')) {
                    post('send_to_finance', { financeNotes })
                  }
                }}
              >
                {saving ? 'Enviando…' : 'Encaminhar ao Financeiro'}
              </button>
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}

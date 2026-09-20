import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import './GeneralEventPostEventPanel.css'

function formatMoney(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

export default function GeneralEventPostEventPanel({
  eventId,
  expensesClosed = false,
  onChanged,
  onFinancialStateChange,
}) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [openingExpenseId, setOpeningExpenseId] = useState(null)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [message, setMessage] = useState('')

  const financial = summary?.generalFinancial || {}

  const expenses =
    Array.isArray(summary?.expenses)
      ? summary.expenses
      : []

  const activeExpenses =
    expenses.filter(
      (item) =>
        Number(item.active ?? 1) === 1
    )

  const totalExpenses =
    activeExpenses.reduce(
      (total, item) =>
        total + Number(item.amount || 0),
      0
    )
  const isLocked = expensesClosed || Boolean(summary?.expensesClosed)
  const reviewStatus = String(financial.review_status || 'pending')
  const financialComplete = reviewStatus === 'submitted' || reviewStatus === 'approved'

  const emitFinancialState = useCallback((nextSummary) => {
    const nextStatus = String(nextSummary?.generalFinancial?.review_status || 'pending')
    onFinancialStateChange?.(nextStatus === 'submitted' || nextStatus === 'approved')
  }, [onFinancialStateChange])

  const loadSummary = useCallback(async ({ silent = false } = {}) => {
    if (!eventId) return
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams({
        action: 'post-event',
        operation: 'general-financial-summary',
        eventId: String(eventId),
      })
      const response = await fetch(`/api/admin?${params}`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Não foi possível carregar a prestação financeira.')
      setSummary(result)
      emitFinancialState(result)
    } catch (error) {
      setMessage(error.message || 'Não foi possível carregar a prestação financeira.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [emitFinancialState, eventId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSummary()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadSummary])

  async function postOperation(payload) {
    const response = await fetch('/api/admin?action=post-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, eventId: Number(eventId) }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.')
    return result
  }

  async function uploadReceipt(file) {
    const prepareResult = await postOperation({
      operation: 'prepare-general-receipt',
      contentType: file.type,
    })
    const formData = new FormData()
    formData.append('file', file)
    const uploadResponse = await fetch(prepareResult.signedUrl, {
      method: 'PUT',
      body: formData,
    })
    if (!uploadResponse.ok) throw new Error('Não foi possível enviar o comprovante.')
    return prepareResult.storagePath
  }

  async function handleAddExpense(event) {
    event.preventDefault()
    if (isLocked) return
    setMessage('')
    const numericAmount = Number(String(amount).replace(',', '.'))
    if (!description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0 || !receipt) {
      setMessage('Preencha a descrição, o valor e anexe o comprovante.')
      return
    }
    setSaving(true)
    try {
      const receiptPath = await uploadReceipt(receipt)
      await postOperation({
        operation: 'add-general-expense',
        description: description.trim(),
        amount: numericAmount,
        receiptPath,
      })
      setDescription('')
      setAmount('')
      setReceipt(null)
      setMessage('Gasto adicionado com sucesso.')
      await loadSummary({ silent: true })
      await onChanged?.()
    } catch (error) {
      setMessage(error.message || 'Não foi possível adicionar o gasto.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelExpense(expense) {
    if (isLocked) return
    const reason = window.prompt('Informe o motivo do cancelamento deste gasto:')
    if (!reason?.trim()) return
    setSaving(true)
    setMessage('')
    try {
      await postOperation({
        operation: 'cancel-general-expense',
        expenseId: Number(expense.id),
        reason: reason.trim(),
      })
      setMessage('Gasto cancelado.')
      await loadSummary({ silent: true })
      await onChanged?.()
    } catch (error) {
      setMessage(error.message || 'Não foi possível cancelar o gasto.')
    } finally {
      setSaving(false)
    }
  }

  async function handleOpenReceipt(expense) {
    setMessage('')
    setOpeningExpenseId(Number(expense.id))
    try {
      const result = await postOperation({
        operation: 'general-receipt-url',
        expenseId: Number(expense.id),
      })
      window.open(result.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setMessage(error.message || 'Não foi possível abrir o comprovante.')
    } finally {
      setOpeningExpenseId(null)
    }
  }

  async function completeFinancial(financialStatus) {
    if (isLocked || saving) return
    if (financialStatus === 'expenses' && activeExpenses.length === 0) {
      setMessage('Adicione pelo menos um gasto antes de enviar a prestação.')
      return
    }
    if ((financialStatus === 'no_expenses' || financialStatus === 'donation') && activeExpenses.length > 0) {
      setMessage('Cancele os gastos lançados antes de concluir como Sem gastos ou Doação.')
      return
    }
    const labels = {
      expenses: 'Com gastos',
      no_expenses: 'Sem gastos',
      donation: 'Doação',
    }
    if (!window.confirm(`Concluir a prestação financeira como "${labels[financialStatus]}"?`)) return
    setSaving(true)
    setMessage('')
    try {
      await postOperation({
        operation: 'complete-general-financial',
        financialStatus,
      })
      setMessage('Prestação financeira concluída.')
      await loadSummary({ silent: true })
      await onChanged?.()
    } catch (error) {
      setMessage(error.message || 'Não foi possível concluir a prestação financeira.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="general-post-event-card"><div className="general-post-event-loading">Carregando prestação financeira…</div></div>
  }

  return (
    <section className="general-post-event-card">
      <div className="general-post-event-header">
        <div>
          <span className="general-post-event-eyebrow">Evento Geral</span>
          <h3>Prestação financeira</h3>
          <p>Um único fechamento para todo o evento, sem divisão por equipes.</p>
        </div>
        <div className={`general-post-event-status ${financialComplete ? 'is-complete' : ''}`}>
          {financialComplete ? '✓ Concluída' : 'Pendente'}
        </div>
      </div>

      {reviewStatus === 'returned' && (
        <div className="general-post-event-alert is-warning">
          <strong>Prestação devolvida</strong>
          <span>{financial.return_reason || 'Revise as informações e envie novamente.'}</span>
        </div>
      )}

      {isLocked && (
        <div className="general-post-event-alert is-locked">
          <strong>Gastos finalizados</strong>
          <span>Este fechamento financeiro já foi encerrado e não pode mais ser alterado.</span>
        </div>
      )}

      <div className="general-post-event-summary">
        <div><span>Lançamentos ativos</span><strong>{activeExpenses.length}</strong></div>
        <div><span>Total informado</span><strong>{formatMoney(totalExpenses)}</strong></div>
      </div>

      {!isLocked && !financialComplete && (
        <form className="general-post-event-form" onSubmit={handleAddExpense}>
          <div className="general-post-event-form-title">
            <strong>Adicionar gasto</strong>
            <span>Use esta área somente quando o evento tiver despesas.</span>
          </div>
          <label>Descrição<input type="text" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: materiais do evento" disabled={saving} /></label>
          <label>Valor<input type="text" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" disabled={saving} /></label>
          <label className="general-post-event-file">Comprovante<input type="file" accept="image/*,application/pdf" onChange={(event) => setReceipt(event.target.files?.[0] || null)} disabled={saving} /><span>{receipt ? receipt.name : 'Selecione uma imagem ou PDF'}</span></label>
          <button type="submit" className="general-post-event-primary" disabled={saving}>{saving ? 'Salvando…' : '+ Adicionar gasto'}</button>
        </form>
      )}

      {activeExpenses.length > 0 && (
        <div className="general-post-event-expenses">
          <div className="general-post-event-section-title"><strong>Gastos lançados</strong><span>{activeExpenses.length}</span></div>
          {activeExpenses.map((expense) => (
            <article key={expense.id} className="general-post-event-expense">
              <div className="general-post-event-expense-main"><strong>{expense.description}</strong><span>{formatMoney(expense.amount)}</span></div>
              <div className="general-post-event-expense-actions">
                {expense.receipt_path && <button type="button" onClick={() => handleOpenReceipt(expense)} disabled={openingExpenseId === Number(expense.id)}>{openingExpenseId === Number(expense.id) ? 'Abrindo…' : 'Ver comprovante'}</button>}
                {!isLocked && !financialComplete && <button type="button" className="is-danger" onClick={() => handleCancelExpense(expense)} disabled={saving}>Cancelar</button>}
              </div>
            </article>
          ))}
        </div>
      )}

      {!isLocked && !financialComplete && (
        <div className="general-post-event-decisions">
          <div className="general-post-event-form-title"><strong>Como foi o financeiro do evento?</strong><span>Escolha a opção que representa o fechamento.</span></div>
          <div className="general-post-event-decision-grid">
            <button type="button" onClick={() => completeFinancial('expenses')} disabled={saving || activeExpenses.length === 0}><span>💳</span><strong>Com gastos</strong><small>Enviar lançamentos para revisão.</small></button>
            <button type="button" onClick={() => completeFinancial('no_expenses')} disabled={saving || activeExpenses.length > 0}><span>✓</span><strong>Sem gastos</strong><small>Nada foi desembolsado.</small></button>
            <button type="button" onClick={() => completeFinancial('donation')} disabled={saving || activeExpenses.length > 0}><span>♡</span><strong>Doação</strong><small>Os custos foram doados.</small></button>
          </div>
        </div>
      )}

      {financialComplete && (
        <div className="general-post-event-complete">
          <strong>Prestação financeira registrada</strong>
          <span>
            {financial.financial_status === 'expenses' && 'Com gastos — enviada para revisão financeira.'}
            {financial.financial_status === 'no_expenses' && 'Sem gastos — concluída.'}
            {financial.financial_status === 'donation' && 'Doação — concluída.'}
          </span>
        </div>
      )}

      {message && <div className="general-post-event-message">{message}</div>}
    </section>
  )
}

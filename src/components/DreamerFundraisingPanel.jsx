import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const INITIATIVES = [
  ['sale', 'Venda'],
  ['raffle', 'Rifa'],
  ['donation', 'Doação recebida'],
  ['campaign', 'Campanha / ação'],
  ['other', 'Outra iniciativa'],
]

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

function statusLabel(status) {
  return {
    pending: 'Aguardando validação',
    validated: 'Validada',
    rejected: 'Reprovada',
    correction_requested: 'Correção solicitada',
  }[status] || status
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function DreamerFundraisingPanel({
  preferredProject,
}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [editingEntryId, setEditingEntryId] = useState(null)
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    projectId: '',
    initiativeType: 'sale',
    title: '',
    grossAmount: '',
    costAmount: '0',
    receivedAt: todayInputValue(),
    notes: '',
  })
  const [receipt, setReceipt] = useState(null)

  function resetForm(projectId = form.projectId) {
    setEditingEntryId(null)
    setForm({
      projectId: String(projectId || ''),
      initiativeType: 'sale',
      title: '',
      grossAmount: '',
      costAmount: '0',
      receivedAt: todayInputValue(),
      notes: '',
    })
    setReceipt(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function load() {
    try {
      const response = await fetch(
        '/api/dreamer?action=fundraising'
      )
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            'Não foi possível carregar suas arrecadações.'
        )
      }

      setData(payload)

      setForm(current => {
        if (current.projectId) return current

        const preferred = payload.teams?.find(
          team =>
            String(team.project).toUpperCase() ===
            String(preferredProject || '').toUpperCase()
        )

        return {
          ...current,
          projectId: String(
            preferred?.project_id ||
              payload.teams?.[0]?.project_id ||
              ''
          ),
        }
      })
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    fetch('/api/dreamer?action=fundraising')
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(
            payload?.error ||
              'Não foi possível carregar suas arrecadações.'
          )
        }
        return payload
      })
      .then(payload => {
        if (!active) return
        setData(payload)
        setForm(current => {
          if (current.projectId) return current
          const preferred = payload.teams?.find(
            team =>
              String(team.project).toUpperCase() ===
              String(preferredProject || '').toUpperCase()
          )
          return {
            ...current,
            projectId: String(
              preferred?.project_id ||
                payload.teams?.[0]?.project_id ||
                ''
            ),
          }
        })
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
  }, [preferredProject])

  const netAmount = useMemo(() => {
    const gross = Number(form.grossAmount || 0)
    const cost = Number(form.costAmount || 0)
    return Math.max(0, gross - cost)
  }, [form.grossAmount, form.costAmount])

  async function uploadReceipt(file) {
    if (file.size > 8 * 1024 * 1024) {
      throw new Error(
        'O comprovante deve ter no máximo 8 MB.'
      )
    }

    const prepareResponse = await fetch(
      '/api/dreamer?action=fundraising',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'prepare-receipt',
          projectId: Number(form.projectId),
          contentType: file.type,
        }),
      }
    )

    const preparePayload = await prepareResponse.json()

    if (!prepareResponse.ok) {
      throw new Error(
        preparePayload?.error ||
          'Não foi possível preparar o comprovante.'
      )
    }

    const uploadData = new FormData()
    uploadData.append('cacheControl', '3600')
    uploadData.append('', file)

    const uploadResponse = await fetch(
      preparePayload.signedUrl,
      {
        method: 'PUT',
        body: uploadData,
      }
    )

    if (!uploadResponse.ok) {
      throw new Error(
        'Não foi possível enviar o comprovante.'
      )
    }

    return preparePayload.storagePath
  }

  async function submit(event) {
    event.preventDefault()
    if (saving) return

    setError('')
    setMessage('')

    if (!receipt) {
      setError(
        editingEntryId
          ? 'Anexe um novo comprovante para reenviar a correção.'
          : 'Anexe o comprovante da arrecadação.'
      )
      return
    }

    setSaving(true)

    try {
      const storagePath =
        await uploadReceipt(receipt)

      const response = await fetch(
        '/api/dreamer?action=fundraising',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            operation: editingEntryId
              ? 'resubmit'
              : 'create',
            entryId: editingEntryId || undefined,
            ...form,
            projectId: Number(form.projectId),
            storagePath,
          }),
        }
      )

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            'Não foi possível registrar a arrecadação.'
        )
      }

      setMessage(payload.message)
      resetForm(form.projectId)
      await load()
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  function startCorrection(entry) {
    setEditingEntryId(Number(entry.id))
    setForm({
      projectId: String(entry.project_id),
      initiativeType: entry.initiative_type || 'other',
      title: entry.title || '',
      grossAmount: String(entry.gross_amount || ''),
      costAmount: String(entry.cost_amount || 0),
      receivedAt: String(entry.received_at || '')
        .slice(0, 10),
      notes: entry.notes || '',
    })
    setReceipt(null)
    setError('')
    setMessage(
      'Faça os ajustes solicitados e anexe um novo comprovante antes de reenviar.'
    )
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    window.requestAnimationFrame(() => {
      document
        .querySelector('.dreamer-fundraising-form')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
    })
  }

  async function openReceipt(receiptId) {
    // Mobile browsers (especially Safari) block window.open() when it runs
    // only after an awaited request. Open the tab synchronously from the tap,
    // then redirect it after the signed URL is returned by the backend.
    const receiptWindow = window.open('', '_blank')

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

  if (loading) {
    return (
      <section className="dreamer-fundraising-state">
        Carregando arrecadações…
      </section>
    )
  }

  return (
    <section
      className="dreamer-fundraising"
      id="dreamer-fundraising"
    >
      <div className="dreamer-fundraising__heading">
        <div>
          <span className="dreamer-section-label">
            ARRECADAÇÃO EXTERNA
          </span>
          <h2>Transformou uma ideia em ajuda?</h2>
          <p>
            Registre vendas, rifas, campanhas ou doações recebidas fora do app. O valor só entra no placar depois da validação do Admin Sócio.
          </p>
        </div>
        <span className="dreamer-fundraising__seal">↗</span>
      </div>

      <div className="dreamer-fundraising__layout">
        <form
          className={`dreamer-fundraising-form${
            editingEntryId ? ' is-correcting' : ''
          }`}
          onSubmit={submit}
        >
          {editingEntryId ? (
            <div className="dreamer-fundraising-form__correction">
              <div>
                <strong>Correção em andamento</strong>
                <span>
                  Ajuste o registro e envie um novo comprovante.
                </span>
              </div>
              <button
                type="button"
                onClick={() => resetForm(form.projectId)}
              >
                Cancelar
              </button>
            </div>
          ) : null}

          <label>
            <span>Equipe que recebe o crédito</span>
            <select
              value={form.projectId}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  projectId: event.target.value,
                }))
              }
              required
            >
              {(data?.teams || []).map(team => (
                <option
                  key={team.project_id}
                  value={team.project_id}
                >
                  {team.project}
                </option>
              ))}
            </select>
          </label>

          <div className="dreamer-fundraising-form__row">
            <label>
              <span>Tipo de iniciativa</span>
              <select
                value={form.initiativeType}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    initiativeType: event.target.value,
                  }))
                }
              >
                {INITIATIVES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Data recebida</span>
              <input
                type="date"
                max={todayInputValue()}
                value={form.receivedAt}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    receivedAt: event.target.value,
                  }))
                }
                required
              />
            </label>
          </div>

          <label>
            <span>Nome da iniciativa</span>
            <input
              value={form.title}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="Ex.: Venda de brownies"
              maxLength={120}
              required
            />
          </label>

          <div className="dreamer-fundraising-form__money">
            <label>
              <span>Valor bruto</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.grossAmount}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    grossAmount: event.target.value,
                  }))
                }
                placeholder="0,00"
                required
              />
            </label>
            <label>
              <span>Custos</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.costAmount}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    costAmount: event.target.value,
                  }))
                }
              />
            </label>
            <div className="dreamer-fundraising-form__net">
              <span>Líquido</span>
              <strong>{formatCurrency(netAmount)}</strong>
            </div>
          </div>

          <label>
            <span>Observação</span>
            <textarea
              value={form.notes}
              onChange={event =>
                setForm(current => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              placeholder="Conte rapidamente como a arrecadação aconteceu."
              rows={3}
              maxLength={500}
            />
          </label>

          <label className="dreamer-fundraising-form__receipt">
            <span>
              {editingEntryId
                ? 'Novo comprovante'
                : 'Comprovante'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={event =>
                setReceipt(
                  event.target.files?.[0] || null
                )
              }
              required
            />
            <small>
              JPG, PNG, WebP ou PDF · até 8 MB
            </small>
          </label>

          {error ? (
            <p className="dreamer-fundraising__message is-error">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="dreamer-fundraising__message is-success">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            className="dreamer-fundraising-form__submit"
            disabled={saving}
          >
            {saving
              ? 'Enviando…'
              : editingEntryId
                ? 'Reenviar correção →'
                : 'Enviar para validação →'}
          </button>
        </form>

        <aside className="dreamer-fundraising-history">
          <div className="dreamer-fundraising-history__head">
            <div>
              <span>SEUS REGISTROS</span>
              <small>
                Acompanhe a revisão de cada iniciativa.
              </small>
            </div>
            <strong>{(data?.entries || []).length}</strong>
          </div>

          {(data?.entries || []).length ? (
            <div className="dreamer-fundraising-history__list">
              {data.entries.map(entry => (
                <article
                  key={entry.id}
                  className={`is-${entry.status}`}
                >
                  <header>
                    <div>
                      <strong>{entry.title}</strong>
                      <small>{entry.project}</small>
                    </div>
                    <span className={`is-${entry.status}`}>
                      {statusLabel(entry.status)}
                    </span>
                  </header>
                  <div className="dreamer-fundraising-history__numbers">
                    <span>
                      <small>Líquido</small>
                      <b>{formatCurrency(entry.net_amount)}</b>
                    </span>
                    <span>
                      <small>Bruto</small>
                      <b>{formatCurrency(entry.gross_amount)}</b>
                    </span>
                  </div>
                  {entry.possible_duplicate ? (
                    <p className="is-warning">
                      ⚠ Comprovante em conferência de possível duplicidade.
                    </p>
                  ) : null}
                  {entry.review_reason ? (
                    <p className="is-review">
                      <b>Retorno do Admin:</b>{' '}
                      {entry.review_reason}
                    </p>
                  ) : null}
                  <div className="dreamer-fundraising-history__actions">
                    {entry.receipt_id ? (
                      <button
                        type="button"
                        onClick={() =>
                          openReceipt(entry.receipt_id)
                        }
                      >
                        Ver comprovante ↗
                      </button>
                    ) : null}
                    {entry.status === 'correction_requested' ? (
                      <button
                        type="button"
                        className="is-correction"
                        onClick={() => startCorrection(entry)}
                      >
                        Corrigir e reenviar
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="dreamer-fundraising-history__empty">
              Nenhuma arrecadação registrada ainda.
            </p>
          )}
        </aside>
      </div>
    </section>
  )
}

export default DreamerFundraisingPanel

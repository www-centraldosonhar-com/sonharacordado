import { useEffect, useMemo, useRef, useState } from 'react'

const MAX_RECEIPT_BYTES = 8 * 1024 * 1024

const RECEIPT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function money(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(Number(value || 0))
}

function statusLabel(status) {
  return {
    pending: 'Aguardando comprovante',
    pending_payment_review: 'Comprovante em análise',
    correction_requested: 'Correção solicitada',
    confirmed: 'Confirmada',
    rejected: 'Reprovada',
    cancelled: 'Cancelada',
  }[status] || status
}

export default function DreamerContributionsPanel({ mode = 'general', preferredProject = '' }) {
  const [data, setData] = useState(null)
  const [amount, setAmount] = useState('10')
  const [projectId, setProjectId] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const fileInputs = useRef({})

  useEffect(() => {
    let active = true
    fetch('/api/dreamer?action=contributions')
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar os apoios.')
        return payload
      })
      .then(payload => {
        if (!active) return
        setData(payload)
        if (mode === 'olympiad') {
          const preferred = payload.teams?.find(
            team => String(team.project).toUpperCase() === String(preferredProject).toUpperCase()
          )
          setProjectId(String(preferred?.project_id || payload.teams?.[0]?.project_id || ''))
        }
      })
      .catch(fetchError => { if (active) setError(fetchError.message) })
    return () => { active = false }
  }, [mode, preferredProject])

  const relevantHistory = useMemo(() => {
    const rows = data?.contributions || []
    return rows.filter(item => mode === 'olympiad' ? Boolean(item.campaign_id) : !item.campaign_id)
  }, [data, mode])

  async function createIntent(event) {
    event.preventDefault()
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/dreamer?action=contributions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'create_intent',
          destination: mode === 'olympiad' ? 'olympiad' : 'general',
          amount: Number(amount),
          projectId: mode === 'olympiad' ? Number(projectId) : undefined,
          message,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível preparar o apoio.')
      setData(payload)
      setNotice(payload.message || 'Apoio preparado. Faça o PIX e envie o comprovante abaixo.')
      setMessage('')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setSaving(false)
    }
  }

  async function copyPix() {
    const key = data?.pix?.key || '04507472000196'

    try {
      await navigator.clipboard.writeText(key)
      setError('')
      setNotice('CNPJ PIX copiado. ❤️')
    } catch {
      setError('Não foi possível copiar automaticamente. Use o CNPJ exibido na tela.')
    }
  }

  async function uploadReceipt(id, file) {
    if (!file) return

    if (!RECEIPT_TYPES.has(file.type)) {
      setError('Envie um comprovante JPG, PNG, WebP ou PDF.')
      return
    }

    if (file.size > MAX_RECEIPT_BYTES) {
      setError('O comprovante deve ter no máximo 8 MB.')
      return
    }

    setUploadingId(id)
    setError('')
    setNotice('')

    try {
      const prepareResponse = await fetch('/api/dreamer?action=contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'prepare-receipt',
          contributionId: id,
          contentType: file.type,
        }),
      })

      const prepared = await prepareResponse.json()

      if (!prepareResponse.ok) {
        throw new Error(
          prepared?.error || 'Não foi possível preparar o envio do comprovante.'
        )
      }

      const uploadData = new FormData()
      uploadData.append('cacheControl', '3600')
      uploadData.append('', file)

      const uploadResponse = await fetch(prepared.signedUrl, {
        method: 'PUT',
        body: uploadData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Não foi possível enviar o comprovante.')
      }

      const submitResponse = await fetch('/api/dreamer?action=contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'submit-receipt',
          contributionId: id,
          storagePath: prepared.storagePath,
        }),
      })

      const payload = await submitResponse.json()

      if (!submitResponse.ok) {
        throw new Error(
          payload?.error || 'Não foi possível registrar o comprovante.'
        )
      }

      setData(payload)
      setNotice(payload.message || 'Comprovante enviado para análise. ❤️')
    } catch (uploadError) {
      setError(uploadError.message)
    } finally {
      setUploadingId(null)
      if (fileInputs.current[id]) {
        fileInputs.current[id].value = ''
      }
    }
  }

  async function openReceipt(id) {
    const receiptWindow = window.open('', '_blank')
    setError('')

    try {
      const response = await fetch('/api/dreamer?action=contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'receipt-url',
          contributionId: id,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload?.error || 'Não foi possível abrir o comprovante.'
        )
      }

      if (receiptWindow) {
        receiptWindow.opener = null
        receiptWindow.location.href = payload.signedUrl
      } else {
        window.location.assign(payload.signedUrl)
      }
    } catch (openError) {
      if (receiptWindow && !receiptWindow.closed) {
        receiptWindow.close()
      }
      setError(openError.message)
    }
  }

  async function cancelIntent(id) {
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/dreamer?action=contributions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'cancel_intent', contributionId: id }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível cancelar o apoio.')
      setData(payload)
      setNotice('Apoio pendente cancelado.')
    } catch (cancelError) {
      setError(cancelError.message)
    } finally {
      setSaving(false)
    }
  }

  const pix = data?.pix || {}

  return (
    <section id={mode === 'olympiad' ? 'dreamer-direct-support-olympiad' : 'dreamer-direct-support'} className="dreamer-direct-support">
      <div className="dreamer-direct-support__intro">
        <span className="dreamer-section-label">APOIO DIRETO · PIX</span>
        <h2>{mode === 'olympiad' ? 'Apoie um time da Olimpíada.' : 'Doe quando o coração pedir.'}</h2>
        <p>
          {mode === 'olympiad'
            ? 'Escolha APS, PPF ou SJ, faça o PIX e envie o comprovante. O valor entra no placar somente depois da confirmação.'
            : 'Faça uma contribuição livre ao Sonhar Acordado São Paulo por PIX e envie o comprovante pela própria Central.'}
        </p>

        <div className="dreamer-direct-support__safety">
          <strong>PIX — {pix.beneficiary || 'Associação Sonhos de Criança'}</strong>
          <br />
          CNPJ: {pix.display || '04.507.472/0001-96'} ·{' '}
          <button type="button" onClick={copyPix}>Copiar CNPJ PIX</button>
        </div>
      </div>

      <form className="dreamer-direct-support__form" onSubmit={createIntent}>
        <div className="dreamer-direct-support__amounts">
          {[5, 10, 20, 50].map(value => (
            <button type="button" key={value} className={Number(amount) === value ? 'is-active' : ''} onClick={() => setAmount(String(value))}>
              R$ {value}
            </button>
          ))}
        </div>
        <label>
          <span>Outro valor</span>
          <input type="number" min="1" max="100000" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} required />
        </label>
        {mode === 'olympiad' ? (
          <label>
            <span>Time apoiado</span>
            <select value={projectId} onChange={event => setProjectId(event.target.value)} required>
              {(data?.teams || []).map(team => <option key={team.project_id} value={team.project_id}>{team.project}</option>)}
            </select>
          </label>
        ) : null}
        <label className="is-wide">
          <span>Mensagem (opcional)</span>
          <textarea maxLength="500" value={message} onChange={event => setMessage(event.target.value)} placeholder="Uma mensagem de carinho, homenagem ou incentivo…" />
        </label>
        {error ? <div className="dreamer-direct-support__notice is-error">{error}</div> : null}
        {notice ? <div className="dreamer-direct-support__notice is-success">{notice}</div> : null}
        <button className="dreamer-direct-support__submit" type="submit" disabled={saving}>
          {saving ? 'Preparando…' : 'Preparar apoio por PIX →'}
        </button>
        <small>Depois de preparar o apoio, faça o PIX e envie o comprovante em “Seus apoios”. Somente valores confirmados entram nos totais oficiais.</small>
      </form>

      {relevantHistory.length ? (
        <div className="dreamer-direct-support__history">
          <span className="dreamer-section-label">SEUS APOIOS</span>

          {relevantHistory.slice(0, 8).map(item => {
            const canUpload =
              item.status === 'pending' ||
              item.status === 'correction_requested'

            return (
              <article key={item.id}>
                <div>
                  <strong>{money(item.amount)}</strong>
                  <small>{item.project || 'Sonhar Acordado SP'} · {statusLabel(item.status)}</small>
                  {item.review_reason ? <small>Motivo: {item.review_reason}</small> : null}
                </div>

                <code>{item.payment_reference}</code>

                {item.payment_receipt_path ? (
                  <button type="button" onClick={() => openReceipt(item.id)}>
                    Ver comprovante ↗
                  </button>
                ) : null}

                {canUpload ? (
                  <>
                    <input
                      ref={node => { fileInputs.current[item.id] = node }}
                      type="file"
                      hidden
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={event => uploadReceipt(item.id, event.target.files?.[0])}
                    />
                    <button
                      type="button"
                      disabled={uploadingId === item.id}
                      onClick={() => fileInputs.current[item.id]?.click()}
                    >
                      {uploadingId === item.id
                        ? 'Enviando…'
                        : item.status === 'correction_requested'
                          ? 'Reenviar comprovante'
                          : 'Enviar comprovante'}
                    </button>
                  </>
                ) : null}

                {item.status === 'pending' ? (
                  <button
                    type="button"
                    disabled={saving || uploadingId === item.id}
                    onClick={() => cancelIntent(item.id)}
                  >
                    Cancelar
                  </button>
                ) : null}
              </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

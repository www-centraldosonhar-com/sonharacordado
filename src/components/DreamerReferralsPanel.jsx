import { useEffect, useMemo, useState } from 'react'

function DreamerReferralsPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [manualCode, setManualCode] = useState('')

  const incomingCode = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('ref') || ''
  }, [])

  useEffect(() => {
    let active = true

    fetch('/api/dreamer?action=referrals', {
      credentials: 'include',
    })
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(
            payload.error ||
              'Não foi possível carregar as indicações.'
          )
        }
        return payload
      })
      .then(payload => {
        if (active) setData(payload)
      })
      .catch(err => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  async function post(operation, code) {
    setBusy(true); setError(''); setMessage('')
    try {
      const response = await fetch('/api/dreamer?action=referrals', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, code }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a ação.')
      setData(payload)
      setMessage(operation === 'create_invite' ? 'Convite criado com sucesso. ❤️' : 'Convite registrado com sucesso. ❤️')
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const inviteUrl = data?.inviteCode && typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?ref=${encodeURIComponent(data.inviteCode)}`
    : ''

  async function copyInvite() {
    if (!inviteUrl) return
    await navigator.clipboard?.writeText(inviteUrl)
    setMessage('Link copiado!')
  }

  async function shareInvite() {
    if (!inviteUrl) return
    if (navigator.share) {
      await navigator.share({ title: 'Sócio Sonhador', text: 'Vem apoiar meu time na Olimpíada Sonhadora! ❤️', url: inviteUrl })
      return
    }
    await copyInvite()
  }

  if (loading) return <section id="dreamer-referrals" className="dreamer-referrals dreamer-referrals--state">Carregando indicações…</section>
  if (!data) return <section id="dreamer-referrals" className="dreamer-referrals dreamer-referrals--state">{error || 'Indicações indisponíveis.'}</section>

  const target = data.nextTier?.target || data.qualifiedCount || 45
  const progress = Math.min(100, target ? (data.qualifiedCount / target) * 100 : 100)

  return (
    <section id="dreamer-referrals" className="dreamer-referrals">
      <div className="dreamer-section-heading">
        <div><span>INDICAÇÕES QUALIFICADAS</span><h2>Convide gente para sonhar junto.</h2></div>
        <p>A indicação vale para pessoas novas no Sócio Sonhador. Voluntários contínuos já cadastrados na Central não geram crédito. A pontuação só nasce quando o convidado apoia o mesmo time com mais de R$ 3.</p>
      </div>

      {error ? <div className="dreamer-referrals__alert is-error">{error}</div> : null}
      {message ? <div className="dreamer-referrals__alert is-success">{message}</div> : null}

      {incomingCode ? (
        <div className="dreamer-referrals__incoming">
          <div><span>Convite detectado</span><strong>{incomingCode}</strong><small>Registre este convite na sua conta.</small></div>
          <button type="button" disabled={busy} onClick={() => post('accept_invite', incomingCode)}>Aceitar convite</button>
        </div>
      ) : null}

      <div className="dreamer-referrals__grid">
        <article className="dreamer-referrals__invite-card">
          <span>MEU CONVITE</span><h3>Compartilhe o seu time.</h3>
          <p>O primeiro convite válido do mesmo time é o que recebe o crédito.</p>
          {data.inviteCode ? (
            <><div className="dreamer-referrals__code"><strong>{data.inviteCode}</strong></div>
            <div className="dreamer-referrals__invite-actions"><button type="button" onClick={shareInvite}>Compartilhar</button><button type="button" onClick={copyInvite}>Copiar link</button></div></>
          ) : <button className="dreamer-referrals__create" type="button" disabled={busy} onClick={() => post('create_invite')}>Criar meu convite</button>}
        </article>

        <article className="dreamer-referrals__progress-card">
          <span>MEU PROGRESSO</span>
          <div className="dreamer-referrals__big-number"><strong>{data.qualifiedCount}</strong><small>qualificadas</small></div>
          <div className="dreamer-referrals__progress-track"><span style={{ width: `${progress}%` }} /></div>
          <div className="dreamer-referrals__progress-meta"><span><small>Pontos atuais</small><strong>{data.points}</strong></span><span><small>Próxima faixa</small><strong>{data.nextTier ? `${data.nextTier.target} → ${data.nextTier.points} pts` : 'Faixa máxima'}</strong></span></div>
        </article>
      </div>

      <div className="dreamer-referrals__accept-manual">
        <div><strong>Recebeu um código?</strong><small>Você pode registrar manualmente aqui.</small></div>
        <div><input value={manualCode} onChange={event => setManualCode(event.target.value.toUpperCase())} placeholder="SONHAR-..." /><button type="button" disabled={busy || !manualCode.trim()} onClick={() => post('accept_invite', manualCode)}>Registrar</button></div>
      </div>

      <div className="dreamer-referrals__people">
        <div className="dreamer-referrals__people-heading"><strong>Meus convidados</strong><small>{data.registeredCount} registrados • {data.qualifiedCount} qualificados</small></div>
        {data.referrals?.length ? <div className="dreamer-referrals__people-list">{data.referrals.map(item => <span key={item.id}><strong>{item.full_name || item.name}</strong><small className={item.status === 'qualified' ? 'is-qualified' : ''}>{item.status === 'qualified' ? 'Qualificado ✓' : 'Aguardando apoio'}</small></span>)}</div> : <small>Ainda não há convidados registrados.</small>}
      </div>
    </section>
  )
}

export default DreamerReferralsPanel

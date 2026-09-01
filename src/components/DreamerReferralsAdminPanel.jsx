import { useEffect, useState } from 'react'

function projectClass(project = '') {
  return `is-${String(project).toLowerCase()}`
}

function DreamerReferralsAdminPanel() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/dreamer?action=referrals', { credentials: 'include' })
      .then(async response => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar as indicações.')
        if (active) setData(payload)
      })
      .catch(err => active && setError(err.message))
    return () => { active = false }
  }, [])

  if (error) return <div className="dreamer-admin-referrals-state is-error">{error}</div>
  if (!data) return <div className="dreamer-admin-referrals-state">Carregando indicações…</div>
  if (!data.isDreamerAdmin || !data.admin) return <div className="dreamer-admin-referrals-state is-error">Acesso restrito ao Admin Sócio.</div>

  const teams = data.admin.teams || []
  const ranking = data.admin.ranking || []
  const registered = teams.reduce((sum, item) => sum + Number(item.registered || 0), 0)
  const qualified = teams.reduce((sum, item) => sum + Number(item.qualified || 0), 0)
  const points = teams.reduce((sum, item) => sum + Number(item.points || 0), 0)

  return (
    <section className="dreamer-admin-referrals">
      <div className="dreamer-admin-referrals__hero">
        <div><span>INDICAÇÕES QUALIFICADAS</span><h2>Convites que viram pertencimento.</h2><p>O cadastro sozinho não pontua. O convite só qualifica quando o indicado apoia o mesmo time com valor acima de R$ 3.</p></div>
        <div className="dreamer-admin-referrals__totals"><span><small>Registradas</small><strong>{registered}</strong></span><span><small>Qualificadas</small><strong>{qualified}</strong></span><span><small>Pontos</small><strong>{points}</strong></span></div>
      </div>

      <div className="dreamer-admin-referrals__teams">{teams.map(team => <article key={team.project_id} className={projectClass(team.project)}><small>{team.project}</small><strong>{team.qualified}</strong><span>qualificadas de {team.registered} registradas</span><small>{team.points} pts no placar</small></article>)}</div>

      <div className="dreamer-admin-referrals__rules"><h3>Faixas oficiais</h3><p>As faixas não são acumuláveis. Cada indicador recebe apenas a maior faixa alcançada e os pontos de todos os indicadores válidos são somados ao time.</p><div><span><b>5</b><small>1 ponto</small></span><span><b>20</b><small>5 pontos</small></span><span><b>45</b><small>10 pontos</small></span></div></div>

      <div className="dreamer-admin-referrals__ranking">
        <div className="dreamer-admin-referrals__ranking-heading"><div><span>RANKING DOS INDICADORES</span><h3>Quem está trazendo mais gente.</h3></div><small>Somente contribuições confirmadas acima de R$ 3 qualificam o convite.</small></div>
        {ranking.length ? <div className="dreamer-admin-referrals__table">{ranking.map((item, index) => <div key={`${item.project_id}-${item.referrer_user_id}`}><span>#{index + 1}</span><strong>{item.referrer}</strong><b className={projectClass(item.project)}>{item.project}</b><small>{item.qualified} qualificadas • {item.registered} registradas</small><em>{item.points} pts</em></div>)}</div> : <div className="dreamer-admin-referrals__empty">Ainda não há indicações registradas.</div>}
      </div>
    </section>
  )
}

export default DreamerReferralsAdminPanel

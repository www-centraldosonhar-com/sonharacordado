import { useCallback, useEffect, useMemo, useState } from 'react'
import '../styles/dreamer-community-admin-v2.css'

const EMPTY_ACTION = {
  id: 0,
  projectId: '',
  title: '',
  summary: '',
  description: '',
  supportKind: 'mixed',
  needLabel: '',
  contactUrl: '',
  startsAt: '',
  endsAt: '',
  status: 'draft',
  featured: false,
}

const PARTNER_TYPE_META = {
  partner: {
    label: 'Parceiro',
    icon: '♥',
    className: 'is-partner',
  },
  sponsor: {
    label: 'Patrocinador',
    icon: '★',
    className: 'is-sponsor',
  },
  supporter: {
    label: 'Apoiador',
    icon: '✦',
    className: 'is-supporter',
  },
}

const EMPTY_PARTNER = {
  id: 0,
  name: '',
  partnerType: 'partner',
  description: '',
  supportSummary: '',
  logoUrl: '',
  websiteUrl: '',
  active: true,
  featured: false,
  sortOrder: 0,
}

function getPartnerTypeMeta(type) {
  return (
    PARTNER_TYPE_META[String(type || '').toLowerCase()] ||
    PARTNER_TYPE_META.partner
  )
}

function toInputDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function DreamerCommunityAdminPanel() {
  const [tab, setTab] = useState('actions')
  const [data, setData] = useState({ projects: [], actions: [], partners: [] })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [actionForm, setActionForm] = useState(EMPTY_ACTION)
  const [partnerForm, setPartnerForm] = useState(EMPTY_PARTNER)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/dreamer?action=community&scope=admin')
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível carregar ações e parceiros.')
      setData(payload)
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const openActions = useMemo(
    () => data.actions.filter(item => item.status === 'published').length,
    [data.actions]
  )

  const partnerStats = useMemo(
    () => data.partners.reduce(
      (stats, item) => {
        const type = String(item.partner_type || 'partner').toLowerCase()

        if (item.active) stats.active += 1
        if (item.featured) stats.featured += 1

        if (type === 'sponsor') stats.sponsors += 1
        else if (type === 'supporter') stats.supporters += 1
        else stats.partners += 1

        return stats
      },
      {
        active: 0,
        featured: 0,
        sponsors: 0,
        partners: 0,
        supporters: 0,
      }
    ),
    [data.partners]
  )

  const orderedPartners = useMemo(
    () => [...data.partners].sort((a, b) => {
      if (Boolean(a.featured) !== Boolean(b.featured)) {
        return a.featured ? -1 : 1
      }

      if (Boolean(a.active) !== Boolean(b.active)) {
        return a.active ? -1 : 1
      }

      const orderDifference =
        Number(a.sort_order || 0) -
        Number(b.sort_order || 0)

      if (orderDifference !== 0) return orderDifference

      return String(a.name || '').localeCompare(
        String(b.name || ''),
        'pt-BR'
      )
    }),
    [data.partners]
  )

  async function post(body) {
    setBusy(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch('/api/dreamer?action=community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível salvar.')
      setMessage(payload.message || 'Salvo.')
      await load()
      return true
    } catch (postError) {
      setError(postError.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function saveAction(event) {
    event.preventDefault()
    const ok = await post({ operation: 'saveAction', ...actionForm })
    if (ok) setActionForm(EMPTY_ACTION)
  }

  async function savePartner(event) {
    event.preventDefault()
    const ok = await post({ operation: 'savePartner', ...partnerForm })
    if (ok) setPartnerForm(EMPTY_PARTNER)
  }

  function editAction(item) {
    setActionForm({
      id: item.id,
      projectId: item.project_id || '',
      title: item.title || '',
      summary: item.summary || '',
      description: item.description || '',
      supportKind: item.support_kind || 'mixed',
      needLabel: item.need_label || '',
      contactUrl: item.contact_url || '',
      startsAt: toInputDate(item.starts_at),
      endsAt: toInputDate(item.ends_at),
      status: item.status || 'draft',
      featured: Boolean(item.featured),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function editPartner(item) {
    setPartnerForm({
      id: item.id,
      name: item.name || '',
      partnerType: item.partner_type || 'partner',
      description: item.description || '',
      supportSummary: item.support_summary || '',
      logoUrl: item.logo_url || '',
      websiteUrl: item.website_url || '',
      active: Boolean(item.active),
      featured: Boolean(item.featured),
      sortOrder: Number(item.sort_order || 0),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) {
    return <section className="dreamer-admin-placeholder"><strong>Carregando comunidade…</strong></section>
  }

  return (
    <div className="dreamer-community-admin">
      <section className="dreamer-community-admin__hero">
        <div>
          <span className="dreamer-eyebrow">COMUNIDADE E APOIO</span>
          <h2>Ações, parceiros e patrocinadores.</h2>
          <p>Publique necessidades reais da ONG e dê visibilidade a quem ajuda a torná-las possíveis.</p>
        </div>
        <div className="dreamer-community-admin__stats">
          <span><strong>{openActions}</strong><small>ações publicadas</small></span>
          <span><strong>{data.partners.filter(item => item.active).length}</strong><small>parceiros ativos</small></span>
        </div>
      </section>

      <div className="dreamer-community-admin__tabs">
        <button type="button" className={tab === 'actions' ? 'is-active' : ''} onClick={() => setTab('actions')}>Ações</button>
        <button type="button" className={tab === 'partners' ? 'is-active' : ''} onClick={() => setTab('partners')}>Parceiros</button>
      </div>

      {message ? <div className="dreamer-community-admin__notice is-success">{message}</div> : null}
      {error ? <div className="dreamer-community-admin__notice is-error">{error}</div> : null}

      {tab === 'actions' ? (
        <>
          <form className="dreamer-community-form" onSubmit={saveAction}>
            <div className="dreamer-community-form__heading">
              <div><span>{actionForm.id ? 'EDITANDO AÇÃO' : 'NOVA AÇÃO'}</span><h3>{actionForm.id ? actionForm.title : 'O que precisa de apoio agora?'}</h3></div>
              {actionForm.id ? <button type="button" onClick={() => setActionForm(EMPTY_ACTION)}>Cancelar edição</button> : null}
            </div>

            <div className="dreamer-community-form__grid">
              <label className="is-wide">Título<input value={actionForm.title} onChange={event => setActionForm(current => ({ ...current, title: event.target.value }))} placeholder="Ex.: Transporte para a Festa de Natal" required /></label>
              <label>Projeto<select value={actionForm.projectId} onChange={event => setActionForm(current => ({ ...current, projectId: event.target.value }))}><option value="">Todos / Geral</option>{data.projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
              <label>Tipo de apoio<select value={actionForm.supportKind} onChange={event => setActionForm(current => ({ ...current, supportKind: event.target.value }))}><option value="mixed">Várias formas</option><option value="money">Financeiro</option><option value="product">Produtos</option><option value="service">Serviços</option></select></label>
              <label className="is-wide">Resumo<input value={actionForm.summary} onChange={event => setActionForm(current => ({ ...current, summary: event.target.value }))} placeholder="Uma frase curta para a Home" /></label>
              <label className="is-wide">Descrição<textarea value={actionForm.description} onChange={event => setActionForm(current => ({ ...current, description: event.target.value }))} placeholder="Explique a necessidade e como essa ajuda será usada." /></label>
              <label>Necessidade / chamada<input value={actionForm.needLabel} onChange={event => setActionForm(current => ({ ...current, needLabel: event.target.value }))} placeholder="Ex.: Precisamos de 2 vans" /></label>
              <label>Link para ajudar<input value={actionForm.contactUrl} onChange={event => setActionForm(current => ({ ...current, contactUrl: event.target.value }))} placeholder="https://..." /></label>
              <label>Início<input type="datetime-local" value={actionForm.startsAt} onChange={event => setActionForm(current => ({ ...current, startsAt: event.target.value }))} /></label>
              <label>Encerramento<input type="datetime-local" value={actionForm.endsAt} onChange={event => setActionForm(current => ({ ...current, endsAt: event.target.value }))} /></label>
              <label>Status<select value={actionForm.status} onChange={event => setActionForm(current => ({ ...current, status: event.target.value }))}><option value="draft">Rascunho</option><option value="published">Publicada</option><option value="closed">Encerrada</option></select></label>
              <label className="dreamer-community-form__check"><input type="checkbox" checked={actionForm.featured} onChange={event => setActionForm(current => ({ ...current, featured: event.target.checked }))} /> Destacar na Home</label>
            </div>

            <button className="dreamer-community-form__submit" type="submit" disabled={busy}>{busy ? 'Salvando…' : actionForm.id ? 'Salvar alterações' : 'Criar ação'}</button>
          </form>

          <section className="dreamer-community-list">
            {data.actions.length ? data.actions.map(item => (
              <article key={item.id}>
                <div><span>{item.project || 'GERAL'} · {item.status}</span><strong>{item.title}</strong><small>{item.summary || item.need_label || 'Sem resumo'}</small></div>
                <div className="dreamer-community-list__meta"><b>{item.featured ? '★ Destaque' : item.support_kind}</b><button type="button" onClick={() => editAction(item)}>Editar</button></div>
              </article>
            )) : <div className="dreamer-community-list__empty">Nenhuma ação cadastrada ainda.</div>}
          </section>
        </>
      ) : (
        <div className="dreamer-partner-admin-v2">
          <section className="dreamer-partner-admin-v2__summary">
            <div>
              <span className="dreamer-eyebrow">REDE DE APOIO</span>
              <h3>Parceiros, patrocinadores e apoiadores.</h3>
              <p>Organize quem caminha com o Sonhar e controle exatamente como cada apoio aparece para a comunidade.</p>
            </div>

            <div className="dreamer-partner-admin-v2__metrics">
              <span><strong>{partnerStats.sponsors}</strong><small>Patrocinadores</small></span>
              <span><strong>{partnerStats.partners}</strong><small>Parceiros</small></span>
              <span><strong>{partnerStats.supporters}</strong><small>Apoiadores</small></span>
              <span><strong>{partnerStats.featured}</strong><small>Destaques</small></span>
            </div>
          </section>

          <div className="dreamer-partner-admin-v2__workspace">
            <form className="dreamer-community-form dreamer-partner-admin-v2__form" onSubmit={savePartner}>
              <div className="dreamer-community-form__heading">
                <div>
                  <span>{partnerForm.id ? 'EDITANDO PARCEIRO' : 'NOVO PARCEIRO'}</span>
                  <h3>{partnerForm.id ? partnerForm.name : 'Quem está ajudando o Sonhar?'}</h3>
                </div>
                {partnerForm.id ? <button type="button" onClick={() => setPartnerForm(EMPTY_PARTNER)}>Cancelar edição</button> : null}
              </div>

              <div className="dreamer-partner-admin-v2__preview">
                <div className="dreamer-partner-admin-v2__preview-logo">
                  {partnerForm.logoUrl ? (
                    <img src={partnerForm.logoUrl} alt="" />
                  ) : (
                    <span>{(partnerForm.name || 'S').slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <small className={getPartnerTypeMeta(partnerForm.partnerType).className}>
                    {getPartnerTypeMeta(partnerForm.partnerType).icon} {getPartnerTypeMeta(partnerForm.partnerType).label}
                  </small>
                  <strong>{partnerForm.name || 'Nome do parceiro'}</strong>
                  <p>{partnerForm.supportSummary || 'O resumo do apoio aparecerá aqui.'}</p>
                </div>
              </div>

              <div className="dreamer-community-form__grid">
                <label>Nome<input value={partnerForm.name} onChange={event => setPartnerForm(current => ({ ...current, name: event.target.value }))} placeholder="Empresa, marca ou profissional" required /></label>
                <label>Categoria<select value={partnerForm.partnerType} onChange={event => setPartnerForm(current => ({ ...current, partnerType: event.target.value }))}><option value="partner">Parceiro</option><option value="sponsor">Patrocinador</option><option value="supporter">Apoiador</option></select></label>
                <label className="is-wide">Resumo do apoio<input value={partnerForm.supportSummary} onChange={event => setPartnerForm(current => ({ ...current, supportSummary: event.target.value }))} placeholder="Ex.: Apoio com alimentação dos eventos" /></label>
                <label className="is-wide">Descrição<textarea value={partnerForm.description} onChange={event => setPartnerForm(current => ({ ...current, description: event.target.value }))} placeholder="Conte brevemente como essa parceria contribui." /></label>
                <label>URL do logo<input value={partnerForm.logoUrl} onChange={event => setPartnerForm(current => ({ ...current, logoUrl: event.target.value }))} placeholder="https://..." /></label>
                <label>Site / Instagram<input value={partnerForm.websiteUrl} onChange={event => setPartnerForm(current => ({ ...current, websiteUrl: event.target.value }))} placeholder="https://..." /></label>
                <label>Ordem de exibição<input type="number" value={partnerForm.sortOrder} onChange={event => setPartnerForm(current => ({ ...current, sortOrder: Number(event.target.value) }))} /></label>
                <label className="dreamer-community-form__check"><input type="checkbox" checked={partnerForm.active} onChange={event => setPartnerForm(current => ({ ...current, active: event.target.checked }))} /> Publicado na Home</label>
                <label className="dreamer-community-form__check"><input type="checkbox" checked={partnerForm.featured} onChange={event => setPartnerForm(current => ({ ...current, featured: event.target.checked }))} /> Parceiro em destaque</label>
              </div>

              <div className="dreamer-partner-admin-v2__form-note">
                <span>💡</span>
                <p>Use <strong>Destaque</strong> para dar evidência especial na Home. A ordem menor aparece primeiro entre parceiros do mesmo nível.</p>
              </div>

              <button className="dreamer-community-form__submit" type="submit" disabled={busy}>{busy ? 'Salvando…' : partnerForm.id ? 'Salvar alterações' : 'Cadastrar parceiro'}</button>
            </form>

            <aside className="dreamer-partner-admin-v2__guide">
              <span className="dreamer-eyebrow">COMO USAR</span>
              <h3>Uma categoria para cada relação.</h3>

              <article className="is-sponsor">
                <b>★ Patrocinador</b>
                <p>Apoio de maior destaque, normalmente financeiro ou estrutural.</p>
              </article>
              <article className="is-partner">
                <b>♥ Parceiro</b>
                <p>Empresa ou profissional que contribui com produtos, serviços ou colaboração recorrente.</p>
              </article>
              <article className="is-supporter">
                <b>✦ Apoiador</b>
                <p>Apoio pontual ou institucional que também merece reconhecimento.</p>
              </article>

              <small>{partnerStats.active} de {data.partners.length} cadastros estão publicados na Home.</small>
            </aside>
          </div>

          <section className="dreamer-partner-admin-v2__directory">
            <div className="dreamer-partner-admin-v2__directory-heading">
              <div>
                <span className="dreamer-eyebrow">CADASTRADOS</span>
                <h3>Rede atual</h3>
              </div>
              <small>Destaques e ativos aparecem primeiro.</small>
            </div>

            <div className="dreamer-partner-admin-v2__cards">
              {orderedPartners.length ? orderedPartners.map(item => {
                const meta = getPartnerTypeMeta(item.partner_type)

                return (
                  <article key={item.id} className={`${meta.className} ${item.active ? '' : 'is-hidden'}`}>
                    <div className="dreamer-partner-admin-v2__card-top">
                      <span className="dreamer-community-list__logo">
                        {item.logo_url ? <img src={item.logo_url} alt="" /> : item.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <small className="dreamer-partner-admin-v2__type">{meta.icon} {meta.label}</small>
                        <strong>{item.name}</strong>
                      </div>
                      {item.featured ? <b className="dreamer-partner-admin-v2__featured">★ Destaque</b> : null}
                    </div>

                    <p>{item.support_summary || 'Apoio ao Sonhar Acordado'}</p>

                    <div className="dreamer-partner-admin-v2__badges">
                      <span className={item.active ? 'is-active' : 'is-hidden'}>
                        {item.active ? '● Publicado' : '○ Oculto'}
                      </span>
                      <span>Ordem {Number(item.sort_order || 0)}</span>
                      {item.website_url ? <a href={item.website_url} target="_blank" rel="noreferrer">Abrir link ↗</a> : null}
                    </div>

                    <button type="button" onClick={() => editPartner(item)}>Editar parceiro</button>
                  </article>
                )
              }) : <div className="dreamer-community-list__empty">Nenhum parceiro cadastrado ainda.</div>}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default DreamerCommunityAdminPanel

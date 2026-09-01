import {
  useState,
} from 'react'

import DreamerAttendanceAdminPanel from '../components/DreamerAttendanceAdminPanel'
import DreamerFundraisingAdminPanel from '../components/DreamerFundraisingAdminPanel'
import DreamerMissionsAdminPanel from '../components/DreamerMissionsAdminPanel'
import DreamerReferralsAdminPanel from '../components/DreamerReferralsAdminPanel'
import DreamerCommunityAdminPanel from '../components/DreamerCommunityAdminPanel'
import DreamerContributionsAdminPanel from '../components/DreamerContributionsAdminPanel'
import DreamerClosureAdminPanel from '../components/DreamerClosureAdminPanel'
import '../styles/dreamer.css'

const ADMIN_SECTIONS = [
  {
    id: 'overview',
    label: 'Visão geral',
    icon: '✦',
  },
  {
    id: 'frequency',
    label: 'Frequência',
    icon: '✓',
  },
  {
    id: 'fundraising',
    label: 'Arrecadações',
    icon: '↗',
  },
  {
    id: 'missions',
    label: 'Missões',
    icon: '◆',
  },
  {
    id: 'referrals',
    label: 'Indicações',
    icon: '◎',
  },
  {
    id: 'contributions',
    label: 'Doações',
    icon: '♡',
  },
  {
    id: 'community',
    label: 'Ações & parceiros',
    icon: '♥',
  },
  {
    id: 'closure',
    label: 'Fechamento',
    icon: '▣',
  },
]

function DreamerAdminPage({
  user,
  onBack,
  onLogout,
}) {
  const [section, setSection] =
    useState('overview')

  const firstName = String(
    user?.name || ''
  )
    .trim()
    .split(/\s+/)[0]

  function renderOverview() {
    return (
      <div className="dreamer-admin-dashboard">
        <section className="dreamer-admin-dashboard__welcome">
          <div>
            <span className="dreamer-eyebrow">
              ADMIN SÓCIO SONHADOR
            </span>
            <h2>
              Boa tarde, {firstName || 'Admin'}.
            </h2>
            <p>
              Este é o painel de gestão do Sócio Sonhador. A administração da Central continua separada daqui.
            </p>
          </div>

          <button
            type="button"
            className="dreamer-admin-dashboard__primary"
            onClick={() =>
              setSection('frequency')
            }
          >
            Abrir frequência →
          </button>
        </section>

        <section className="dreamer-admin-dashboard__cards">
          <button
            type="button"
            onClick={() =>
              setSection('frequency')
            }
          >
            <span>01</span>
            <strong>Frequência da Olimpíada</strong>
            <small>
              Escolha os eventos oficiais e acompanhe a média de APS, PPF e SJ.
            </small>
            <b>Disponível agora →</b>
          </button>

          <button
            type="button"
            onClick={() => setSection('fundraising')}
          >
            <span>02</span>
            <strong>Arrecadações</strong>
            <small>
              Validação de comprovantes, custos, duplicidades e valores líquidos.
            </small>
            <b>Disponível agora →</b>
          </button>

          <button
            type="button"
            onClick={() => setSection('missions')}
          >
            <span>03</span>
            <strong>Missões especiais</strong>
            <small>
              Crie desafios, configure critérios e lance os pontos de APS, PPF e SJ.
            </small>
            <b>Disponível agora →</b>
          </button>

          <button
            type="button"
            onClick={() => setSection('referrals')}
          >
            <span>04</span>
            <strong>Indicações qualificadas</strong>
            <small>
              Acompanhe convites, qualificações e a pontuação automática por equipe.
            </small>
            <b>Disponível agora →</b>
          </button>

          <button
            type="button"
            onClick={() => setSection('contributions')}
          >
            <span>05</span>
            <strong>Doações diretas</strong>
            <small>
              Acompanhe intenções de apoio e prepare a futura confirmação via gateway.
            </small>
            <b>Disponível agora →</b>
          </button>

          <button
            type="button"
            onClick={() => setSection('community')}
          >
            <span>06</span>
            <strong>Ações & parceiros</strong>
            <small>
              Publique necessidades reais e dê visibilidade a parceiros, patrocinadores e apoiadores.
            </small>
            <b>Disponível agora →</b>
          </button>

          <button
            type="button"
            onClick={() => setSection('closure')}
          >
            <span>07</span>
            <strong>Fechamento</strong>
            <small>
              Consolidação oficial da campanha para encaminhamento ao Financeiro.
            </small>
            <b>Disponível agora →</b>
          </button>
        </section>
      </div>
    )
  }

  return (
    <main className="dreamer-admin-page">
      <aside className="dreamer-admin-sidebar">
        <div className="dreamer-admin-sidebar__brand">
          <span className="dreamer-admin-sidebar__mark">
            ♥
          </span>
          <div>
            <strong>Sócio Sonhador</strong>
            <small>Admin</small>
          </div>
        </div>

        <nav
          className="dreamer-admin-sidebar__nav"
          aria-label="Admin Sócio Sonhador"
        >
          {ADMIN_SECTIONS.map(item => (
            <button
              type="button"
              key={item.id}
              className={
                section === item.id
                  ? 'is-active'
                  : ''
              }
              onClick={() => {
                if (!item.future) {
                  setSection(item.id)
                }
              }}
              disabled={item.future}
            >
              <span>{item.icon}</span>
              <strong>{item.label}</strong>
              {item.future ? (
                <small>em breve</small>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="dreamer-admin-sidebar__footer">
          <button
            type="button"
            onClick={onBack}
          >
            ← Voltar ao Sócio
          </button>
          <button
            type="button"
            onClick={onLogout}
          >
            Sair
          </button>
        </div>
      </aside>

      <section className="dreamer-admin-workspace">
        <header className="dreamer-admin-topbar">
          <div>
            <button
              type="button"
              className="dreamer-admin-topbar__back"
              onClick={onBack}
            >
              ← Sócio Sonhador
            </button>
            <span>PAINEL ADMINISTRATIVO</span>
            <h1>
              {ADMIN_SECTIONS.find(
                item => item.id === section
              )?.label || 'Sócio Sonhador'}
            </h1>
          </div>

          <div className="dreamer-admin-topbar__user">
            <span>
              {firstName?.slice(0, 1).toUpperCase() || 'A'}
            </span>
            <div>
              <strong>{user?.name}</strong>
              <small>dreamer_admin</small>
            </div>
          </div>
        </header>

        <div className="dreamer-admin-workspace__content">
          {section === 'overview'
            ? renderOverview()
            : null}

          {section === 'frequency' ? (
            <DreamerAttendanceAdminPanel />
          ) : null}

          {section === 'fundraising' ? (
            <DreamerFundraisingAdminPanel />
          ) : null}

          {section === 'missions' ? (
            <DreamerMissionsAdminPanel />
          ) : null}

          {section === 'referrals' ? (
            <DreamerReferralsAdminPanel />
          ) : null}

          {section === 'contributions' ? (
            <DreamerContributionsAdminPanel />
          ) : null}

          {section === 'community' ? (
            <DreamerCommunityAdminPanel />
          ) : null}

          {section === 'closure' ? (
            <DreamerClosureAdminPanel />
          ) : null}
        </div>
      </section>
    </main>
  )
}

export default DreamerAdminPage

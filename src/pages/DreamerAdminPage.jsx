import {
  useState,
} from 'react'

import DreamerAttendanceAdminPanel from '../components/DreamerAttendanceAdminPanel'
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
    future: true,
  },
  {
    id: 'missions',
    label: 'Missões',
    icon: '◆',
    future: true,
  },
  {
    id: 'referrals',
    label: 'Indicações',
    icon: '◎',
    future: true,
  },
  {
    id: 'closure',
    label: 'Fechamento',
    icon: '▣',
    future: true,
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

          <article>
            <span>02</span>
            <strong>Arrecadações</strong>
            <small>
              Validação de comprovantes, custos, duplicidades e valores líquidos.
            </small>
            <b>Próxima etapa</b>
          </article>

          <article>
            <span>03</span>
            <strong>Missões e indicações</strong>
            <small>
              Pontuação configurável, desafios especiais e indicações qualificadas.
            </small>
            <b>Em breve</b>
          </article>

          <article>
            <span>04</span>
            <strong>Fechamento</strong>
            <small>
              Consolidação oficial da campanha para encaminhamento ao Financeiro.
            </small>
            <b>Em breve</b>
          </article>
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
        </div>
      </section>
    </main>
  )
}

export default DreamerAdminPage

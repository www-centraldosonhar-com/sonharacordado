function AppHeader({
  user,
  onLogout,
  onOpenAdmin,
}) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand-block">
          {user.avatar_path ? (
            <img
              className="header-avatar"
              src={user.avatar_path}
              alt={`Avatar de ${user.name}`}
            />
          ) : (
            <div className="header-avatar avatar-fallback">
              {user.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}

          <div>
            <div
              className="brand-hearts"
              aria-hidden="true"
            >
              <span className="heart-red">
                ♥
              </span>

              <span className="heart-orange">
                ♥
              </span>

              <span className="heart-blue">
                ♥
              </span>
            </div>

            <p className="brand-kicker">
              CENTRAL DO SONHAR
            </p>

            <h1>
              Oi, {user.name}! 👋
            </h1>

            <span className="project-badge">
              {user.project}
            </span>
          </div>
        </div>

        <div className="header-account-actions">
          {user.user_type === 'admin' ||
          user.userType === 'admin' ? (
            <button
              className="icon-button"
              type="button"
              onClick={onOpenAdmin}
              title="Painel administrativo"
              aria-label="Painel administrativo"
            >
              ⚙️
            </button>
          ) : null}

          <button
            className="icon-button"
            type="button"
            onClick={onLogout}
            title="Sair"
            aria-label="Sair da Central"
          >
            🚪
          </button>
        </div>
      </div>
    </header>
  )
}

export default AppHeader

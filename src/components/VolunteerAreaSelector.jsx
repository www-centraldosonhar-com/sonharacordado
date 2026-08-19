const TEAM_ICONS = {
  activities: '🎨',
  volunteers: '🙋',
  assisted: '🧒',
  food: '🍽️',
  media: '📸',
}

function VolunteerAreaSelector({
  access,
  selectedArea,
  onSelect,
}) {
  if (!access) {
    return null
  }

  const availableTeams =
    access.availableTeams || []

  if (availableTeams.length === 0) {
    return null
  }

  function getScopeLabel(team) {
    if (team.code === 'media') {
      if (
        access.adminScope === 'global'
      ) {
        return 'APS • PPF • SJ'
      }

      if (
        access.adminScope === 'project'
      ) {
        return access.project?.name
      }

      return 'APS • PPF • SJ • aberta para todos'
    }

    if (
      access.adminScope === 'global'
    ) {
      return 'Todos os projetos'
    }

    return (
      access.project?.name ||
      'Meu projeto'
    )
  }

  return (
    <section className="volunteer-area-shell">
      <div className="volunteer-area-heading">
        <div>
          <p className="eyebrow eyebrow-blue">
            MINHA CENTRAL
          </p>

          <h2>
            Onde vamos fazer acontecer hoje? 🫶
          </h2>
        </div>
      </div>

      <div className="volunteer-area-options">
        {availableTeams.map(
          (team) => (
            <button
              key={team.id}
              type="button"
              className={
                selectedArea === team.code
                  ? 'volunteer-area-card active'
                  : 'volunteer-area-card'
              }
              onClick={() =>
                onSelect(team.code)
              }
            >
              <span className="volunteer-area-icon">
                {TEAM_ICONS[
                  team.code
                ] || '🫶'}
              </span>

              <span>
                <strong>
                  {team.name}
                </strong>

                <small>
                  {getScopeLabel(team)}
                </small>
              </span>
            </button>
          )
        )}
      </div>
    </section>
  )
}

export default VolunteerAreaSelector

function VolunteerAreaSelector({
  access,
  selectedArea,
  onSelect,
}) {
  if (!access) {
    return null
  }

  const primaryTeam =
    access.primaryTeam ||
    access.availableTeams?.find(
      (team) =>
        team.code !== 'media'
    ) ||
    null

  return (
    <section className="volunteer-area-shell">
      <div className="volunteer-area-heading">
        <div>
          <p className="eyebrow eyebrow-blue">
            MINHA CENTRAL
          </p>

          <h2>
            Onde você quer navegar? 🫶
          </h2>
        </div>
      </div>

      <div className="volunteer-area-options">
        <button
          type="button"
          className={
            selectedArea === 'general'
              ? 'volunteer-area-card active'
              : 'volunteer-area-card'
          }
          onClick={() =>
            onSelect('general')
          }
        >
          <span className="volunteer-area-icon">
            🌎
          </span>

          <span>
            <strong>
              Próximos Eventos e Mídia
            </strong>

            <small>
              Eventos, Mídias e novidades gerais
            </small>
          </span>
        </button>

        {primaryTeam && (
          <button
            type="button"
            className={
              selectedArea === 'team'
                ? 'volunteer-area-card active'
                : 'volunteer-area-card'
            }
            onClick={() =>
              onSelect('team')
            }
          >
            <span className="volunteer-area-icon">
              🏠
            </span>

            <span>
              <strong>
                Minha Equipe
              </strong>

              <small>
                {access.project?.name}
                {' • '}
                {primaryTeam.name}
              </small>
            </span>
          </button>
        )}
      </div>
    </section>
  )
}

export default VolunteerAreaSelector

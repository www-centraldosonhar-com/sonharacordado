// =========================================================
// VOLUNTEER AREA SELECTOR
// =========================================================
// Mostra somente as áreas que o usuário realmente possui.
//
// Equipe principal:
//   limitada ao projeto do usuário.
//
// Mídias:
//   transversal para APS, PPF e SJ.
// =========================================================

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

  const primary =
    access.primaryTeam

  // Mídias é uma área transversal e aberta
  // para todos os voluntários da ONG.
  const hasMedia = true

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
        {primary && (
          <button
            type="button"
            className={
              selectedArea ===
              primary.code
                ? 'volunteer-area-card active'
                : 'volunteer-area-card'
            }
            onClick={() =>
              onSelect(
                primary.code
              )
            }
          >
            <span className="volunteer-area-icon">
              {TEAM_ICONS[
                primary.code
              ] || '🫶'}
            </span>

            <span>
              <strong>
                {primary.name}
              </strong>

              <small>
                {access.project.name}
              </small>
            </span>
          </button>
        )}

        {hasMedia && (
          <button
            type="button"
            className={
              selectedArea === 'media'
                ? 'volunteer-area-card active'
                : 'volunteer-area-card'
            }
            onClick={() =>
              onSelect('media')
            }
          >
            <span className="volunteer-area-icon">
              📸
            </span>

            <span>
              <strong>
                Equipe de Mídias
              </strong>

              <small>
                APS • PPF • SJ • aberta para todos
              </small>
            </span>
          </button>
        )}
      </div>
    </section>
  )
}

export default VolunteerAreaSelector

import { formatDateBr } from '../utils/formatters'

function PastEventCard({ event }) {
  return (
    <article className="memory-card">
      {event.event_image_path ? (
        <img
          className="memory-card-image"
          src={event.event_image_path}
          alt={`Capa de ${event.name}`}
        />
      ) : (
        <div className="memory-card-placeholder">
          📸
        </div>
      )}

      <div className="memory-card-content">
        <div>
          {event.project && (
            <span className="soft-tag">
              {event.project}
            </span>
          )}

          <h3>{event.name}</h3>

          <p>
            📅 {formatDateBr(event.event_date)}
          </p>

          {event.location && (
            <p>
              📍 {event.location}
            </p>
          )}

          {(event.activity_names || event.helper_names) && (
            <details className="memory-details">
              <summary>
                ✨ Relembrar esse encontro
              </summary>

              {event.activity_names && (
                <div className="memory-detail-block">
                  <strong>
                    🙋 Atividades
                  </strong>

                  <p>
                    {event.activity_names}
                  </p>
                </div>
              )}

              {event.helper_names && (
                <div className="memory-detail-block">
                  <strong>
                    🤝 Quem ajudou nas atividades
                  </strong>

                  <p>
                    {event.helper_names}
                  </p>
                </div>
              )}

              <p className="memory-after-message">
                ❤️ Mais um encontro que virou memória.
              </p>
            </details>
          )}
        </div>

        <a
          className="memory-button"
          href={event.drive_link}
          target="_blank"
          rel="noopener noreferrer"
        >
          📸 Ver álbum completo
        </a>
      </div>
    </article>
  )
}

export default PastEventCard

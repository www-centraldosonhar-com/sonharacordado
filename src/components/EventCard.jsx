import {
  formatDateBr,
  formatTimeBr,
} from '../utils/formatters'

function EventCard({ event }) {
  if (!event) {
    return (
      <div className="empty-state">
        <span className="empty-icon">
          🌤️
        </span>

        <p>
          Nenhum encontro programado por enquanto.
        </p>
      </div>
    )
  }

  return (
    <article className="event-card featured-card">
      <div className="event-accent" />

      {event.event_image_path ? (
        <div className="event-cover-wrap">
          <img
            className="event-cover-image"
            src={event.event_image_path}
            alt={`Capa de ${event.name}`}
          />

          <div className="event-cover-overlay" />
        </div>
      ) : (
        <div className="event-cover-placeholder">
          <div className="cover-hearts">
            <span className="heart-red">♥</span>
            <span className="heart-orange">♥</span>
            <span className="heart-blue">♥</span>
          </div>

          <span>
            Um novo encontro está chegando ✨
          </span>
        </div>
      )}

      <div className="event-content">
        {event.project && (
          <span className="soft-tag">
            {event.project}
          </span>
        )}

        <h3>{event.name}</h3>

        <div className="event-meta-grid">
          <div className="meta-item">
            <span>📅</span>

            <span>
              {formatDateBr(event.event_date)}
            </span>
          </div>

          <div className="meta-item">
            <span>🕗</span>

            <span>
              {formatTimeBr(event.event_time)}
            </span>
          </div>

          <div className="meta-item full-row">
            <span>📍</span>

            <span>
              {event.location}
            </span>
          </div>
        </div>

        {event.sympla_link && (
          <a
            className="text-link"
            href={event.sympla_link}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir informações do evento →
          </a>
        )}
      </div>
    </article>
  )
}

export default EventCard

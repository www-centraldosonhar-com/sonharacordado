import {
  formatDateBr,
  formatTimeBr,
} from '../utils/formatters'

function EventCard({ event }) {
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

            <span>{event.location}</span>
          </div>
        </div>

        {event.location && (
          <div className="event-map-actions">
            <a
              className="event-map-link"
              href={
                `https://www.google.com/maps/search/?api=1&query=${
                  encodeURIComponent(
                    event.location
                  )
                }`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              🗺️ Google Maps
            </a>

            <a
              className="event-map-link"
              href={
                `https://www.waze.com/ul?q=${
                  encodeURIComponent(
                    event.location
                  )
                }&navigate=yes`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              🚙 Waze
            </a>
          </div>
        )}
      </div>
    </article>
  )
}

export default EventCard

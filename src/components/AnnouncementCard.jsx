function AnnouncementCard({ announcement }) {
  const priorityLabel = {
    urgent: '🚨 Urgente',
    important: '⚠️ Importante',
    normal: '📢 Recado',
  }

  return (
    <article
      className={`modern-card interactive-card announcement-${announcement.priority}`}
    >
      <div className="card-topline">
        <span
          className={`status-pill status-${announcement.priority}`}
        >
          {priorityLabel[announcement.priority] || '📢 Recado'}
        </span>
      </div>

      <h3>{announcement.title}</h3>

      <p className="body-copy">
        {announcement.message}
      </p>

      <p className="card-footer-text">
        Por {announcement.created_by_name}
      </p>
    </article>
  )
}

export default AnnouncementCard

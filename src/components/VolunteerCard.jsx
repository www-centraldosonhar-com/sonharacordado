function VolunteerCard({ volunteer }) {
  return (
    <article className="person-row">
      <div className="avatar-shell">

        {volunteer.avatar_path ? (
          <img
            className="people-avatar"
            src={volunteer.avatar_path}
            alt={`Avatar de ${volunteer.name}`}
          />
        ) : (
          <div className="avatar-circle avatar-fallback">
            {volunteer.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}

      </div>

      <div className="person-info">
        <strong>
          {volunteer.name}
        </strong>

        <span>
          {volunteer.role}
          {' • '}
          {volunteer.project}
        </span>

        <small>
          {volunteer.event_name}
        </small>
      </div>
    </article>
  )
}

export default VolunteerCard

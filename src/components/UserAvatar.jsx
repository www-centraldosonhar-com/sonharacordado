function UserAvatar({
  user,
  name,
  src,
  className = '',
  alt = '',
}) {
  const resolvedName =
    name ||
    user?.name ||
    user?.full_name ||
    user?.fullName ||
    user?.display_name ||
    user?.displayName ||
    user?.username ||
    'Sonhador'

  const resolvedSrc =
    src ||
    user?.avatar_path ||
    user?.avatarPath ||
    user?.avatar_url ||
    user?.avatarUrl ||
    user?.photo_url ||
    user?.photoUrl ||
    null

  const initial =
    String(resolvedName)
      .trim()
      .charAt(0)
      .toUpperCase() || '?'

  return (
    <div
      className={`user-avatar ${className}`.trim()}
      title={resolvedName}
    >
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={alt || resolvedName}
          loading="lazy"
        />
      ) : (
        <span aria-hidden="true">
          {initial}
        </span>
      )}
    </div>
  )
}

export default UserAvatar

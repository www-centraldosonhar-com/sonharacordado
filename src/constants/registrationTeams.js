export const REGISTRATION_TEAMS = [
  {
    value: 'activities',
    label: 'Equipe de Atividades',
  },
  {
    value: 'assisted',
    label: 'Equipe de Assistidos',
  },
  {
    value: 'media',
    label: 'Equipe de Mídias',
  },
  {
    value: 'kitchen',
    label: 'Equipe de Cozinha',
  },
]

export function getTeamLabel(value) {
  return (
    REGISTRATION_TEAMS.find(
      (team) => team.value === value
    )?.label || value
  )
}

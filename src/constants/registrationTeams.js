export const REGISTRATION_TEAMS = [
  {
    value: 'activities',
    label: '🎨 Equipe de Atividades',
  },
  {
    value: 'assisted',
    label: '🧒 Equipe de Assistidos',
  },
  {
    value: 'volunteers',
    label: '🫶 Equipe de Voluntários',
  },
  {
    value: 'food',
    label: '🍎 Equipe de Alimentação',
  },
  {
    value: 'media',
    label: '📸 Equipe de Mídias',
  },
]

export function getTeamLabel(value) {
  return (
    REGISTRATION_TEAMS.find(
      (team) =>
        team.value === value
    )?.label || value
  )
}

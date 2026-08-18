export const REGISTRATION_TEAMS = [
  {
    value: 'participant',
    label: '🤝 Sem equipe específica',
  },
  {
    value: 'activities',
    label: '🎨 Equipe de Atividades',
  },
  {
    value: 'volunteers',
    label: '🙋 Equipe de Voluntárias',
  },
  {
    value: 'assisted',
    label: '🧒 Equipe de Assistidos',
  },
  {
    value: 'food',
    label: '🍽️ Equipe de Alimentação',
  },
  {
    value: 'media',
    label: '📸 Equipe de Mídias',
  },
]

export function getTeamLabel(value) {
  return (
    REGISTRATION_TEAMS.find(
      (team) => team.value === value
    )?.label || value
  )
}

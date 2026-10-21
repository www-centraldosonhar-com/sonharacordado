const MISSION_SALES_BY_PROJECT = new Map([
  [1, 4530],
  [2, 3330],
  [3, 610],
])

export function missionSalesAmount(projectId) {
  return Number(
    MISSION_SALES_BY_PROJECT.get(Number(projectId)) || 0
  )
}

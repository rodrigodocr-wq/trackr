/**
 * Gera um Tracking ID único no formato TRK######UK
 * Exemplo: TRK938475UK
 */
export function generateTrackingId(): string {
  const digits = Math.floor(100000 + Math.random() * 900000).toString()
  return `TRK${digits}UK`
}

/**
 * Calcula o dia atual do pedido (dias desde a criação)
 */
export function getOrderDay(createdAt: string): number {
  const created = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Retorna os milestones que já devem ter sido disparados
 */
export function getTriggeredMilestones(
  milestones: Array<{ day: number; title: string; description: string }>,
  currentDay: number
) {
  return milestones.filter((m) => m.day <= currentDay)
}

/**
 * Calcula a data de expiração do tracking (120 dias por padrão)
 */
export function getExpiresAt(createdAt: string, days = 120): string {
  const date = new Date(createdAt)
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

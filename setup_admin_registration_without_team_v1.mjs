import process from 'node:process'
import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada.')
}

const sql = neon(process.env.DATABASE_URL)

await sql`
  ALTER TABLE event_registrations
  DROP CONSTRAINT IF EXISTS event_registrations_team_check
`

await sql`
  ALTER TABLE event_registrations
  ADD CONSTRAINT event_registrations_team_check
  CHECK (
    team IN (
      'activities',
      'assisted',
      'media',
      'food',
      'volunteers',
      'administration'
    )
  )
`

console.log('✅ Inscrição sem equipe habilitada para Admin Geral/Projeto.')
console.log('• valor interno: administration')
console.log('• voluntários e Admins de Equipe continuam exigindo equipe real')

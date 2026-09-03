import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

console.log('\n===== EVENTOS =====')

const events = await sql`
  SELECT
    id,
    name,
    event_date,
    project_id,
    event_status,
    active
  FROM events
  ORDER BY id
`

console.table(events)
console.log(`TOTAL EVENTOS: ${events.length}`)


console.log('\n===== USUÁRIOS INATIVOS =====')

const inactiveUsers = await sql`
  SELECT
    id,
    name,
    full_name,
    username,
    project_id,
    user_type,
    active
  FROM users
  WHERE active = 0
  ORDER BY id
`

console.table(inactiveUsers)
console.log(
  `TOTAL USUÁRIOS INATIVOS: ${inactiveUsers.length}`
)


console.log('\n===== TABELAS COM FK PARA EVENTS =====')

const eventDependencies = await sql`
  SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS referenced_table,
    ccu.column_name AS referenced_column,
    rc.delete_rule
  FROM information_schema.table_constraints tc

  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.constraint_schema = kcu.constraint_schema

  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.constraint_schema = tc.constraint_schema

  JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.constraint_schema

  WHERE
    tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'events'

  ORDER BY
    tc.table_name,
    kcu.column_name
`

console.table(eventDependencies)


console.log('\n===== TABELAS RELACIONADAS A GASTOS / FINANCEIRO / AVALIAÇÃO =====')

const candidateTables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE
    table_schema = 'public'
    AND (
      table_name ILIKE '%expense%'
      OR table_name ILIKE '%financial%'
      OR table_name ILIKE '%feedback%'
      OR table_name ILIKE '%evaluation%'
      OR table_name ILIKE '%post_event%'
      OR table_name ILIKE '%review%'
      OR table_name ILIKE '%cost%'
    )
  ORDER BY table_name
`

console.table(candidateTables)


console.log('\n===== FKs PARA USERS =====')

const userDependencies = await sql`
  SELECT
    tc.table_name,
    kcu.column_name,
    rc.delete_rule
  FROM information_schema.table_constraints tc

  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.constraint_schema = kcu.constraint_schema

  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.constraint_schema = tc.constraint_schema

  JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.constraint_schema

  WHERE
    tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'users'

  ORDER BY
    tc.table_name,
    kcu.column_name
`

console.table(userDependencies)


console.log('\n===== DREAMER — NÃO APAGAR =====')

const dreamerTables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE
    table_schema = 'public'
    AND table_name LIKE 'dreamer_%'
  ORDER BY table_name
`

console.table(dreamerTables)

console.log('\n✅ Diagnóstico concluído. Nenhum dado foi apagado.')

process.exit(0)

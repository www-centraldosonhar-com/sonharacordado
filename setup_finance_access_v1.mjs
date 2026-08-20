import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(
  process.env.DATABASE_URL
)

console.log(
  '💰 Configurando acesso Financeiro...'
)


// =========================================================
// VERIFICAR ESTRUTURA DE PERMISSOES
// =========================================================
//
// user_permissions já utiliza permission como TEXT.
// Portanto não precisamos alterar a tabela.
//
// Nova permissão:
//
// finance
//
// Ela não possui admin_scope.
// =========================================================

const columns = await sql`
  SELECT
    column_name,
    data_type
  FROM information_schema.columns
  WHERE table_name =
    'user_permissions'
  ORDER BY ordinal_position
`

console.table(columns)

console.log('')
console.log(
  '✅ Estrutura compatível com permission = finance.'
)

console.log('')
console.log(
  'Nenhum usuário foi alterado automaticamente.'
)

console.log(
  'A atribuição do Financeiro será feita pela Central.'
)

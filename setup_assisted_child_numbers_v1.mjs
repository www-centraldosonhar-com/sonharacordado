import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não configurada.')
}

const sql = neon(process.env.DATABASE_URL)

const children = [
  [1, 'Agatha Gabrielly Aguiar de Souza', '2021-01-02'],
  [2, 'Alice cristal de Sousa barbosa', '2019-10-09'],
  [3, 'Alice Souza da Silva lopes', '2019-12-08'],
  [4, 'Angelica Soraya', '2016-10-22'],
  [5, 'Arthur fucitalo ribeiro', '2017-06-18'],
  [6, 'Benjamin Estevão dos santos', '2021-08-17'],
  [7, 'Bernardo da Silva lopes', '2014-10-29'],
  [8, 'Carlos Henrique Estevão dos santos', '2016-06-07'],
  [9, 'Carolina Mamani chavez', '2015-06-13'],
  [10, 'Christian Levy dos Santos Moreira', '2018-10-15'],
  [11, 'Danilo Barbosa da Silva Sousa Junior', '2014-02-10'],
  [12, 'Elif Yasmin Choquehuanca Quispe', '2020-02-27'],
  [13, 'Emanuelly Oliveira Santos', '2018-01-27'],
  [14, 'Enzo Gabriel Bezerra Da Silva', '2016-02-19'],
  [15, 'Enzo Gabriel Lima da Silva', '2019-09-16'],
  [16, 'Estephani ribeiro da rocha', '2014-04-09'],
  [17, 'Heloisa Pereira Alves', '2014-11-28'],
  [18, 'Heloísa Santos e Souza', '2016-03-23'],
  [19, 'Heloysa Manuelle Gomes da Silva', '2020-04-05'],
  [20, 'Hillary Rayanara Bezerra Fiuza da Silva', '2019-09-22'],
  [21, 'Iago Mauro da Costa Valeriano', '2017-03-28'],
  [22, 'Isabella Moreira dos Santos', '2017-03-31'],
  [23, 'Isis Gabrelly Gracia Dos Reis', '2018-01-01'],
  [24, 'Itzel Gabriela Mamani Ortiz', '2019-10-18'],
  [25, 'Jasmin Nicol Huanca Cachi', '2019-09-29'],
  [26, 'Jean carlos da silva bastos', '2014-05-16'],
  [27, 'Jenifer joelma Uchacondori puna', '2020-12-26'],
  [28, 'Jhon Thiago Huanca Cachi', '2017-05-19'],
  [29, 'Kamilly Helloá Santos Sousa', '2017-01-22'],
  [30, 'Kyara manuelly moraes da silva', '2019-01-07'],
  [31, 'Livia Rodrigues Sampaio', '2018-04-02'],
  [32, 'Lorena Santos de Sousa', '2014-12-21'],
  [33, 'Lorena Valentina Mamani Ortiz', '2018-05-14'],
  [34, 'Lucas Gabriel Lopez Cruz', '2017-02-20'],
  [35, 'Luis Andres Choquehuanca Quispe', '2017-10-31'],
  [36, 'Luis Daniel pinto montea', '2016-11-17'],
  [37, 'Luiz Sérgio Barbosa Do Amaral', '2016-08-28'],
  [38, 'Nicolas Gabriel da Silva Lopes', '2014-03-25'],
  [39, 'Pedro Alexandre Souza da Silva', '2016-03-15'],
  [40, 'Pietro Henrique Silva Santos', '2019-01-29'],
  [41, 'Piettro Arthur Guimarães dos Santos', '2014-04-03'],
  [42, 'Rafael Mamani chavez', '2017-08-10'],
  [43, 'Raphael Enrico vitalino da silva', '2018-08-31'],
  [44, 'Rayane de Paula Costa', '2019-02-25'],
  [45, 'Renan Cardoso fiuza Silva', '2014-08-21'],
  [46, 'Reyli Santino Mamani Ortiz', '2014-10-23'],
  [47, 'Romeu Barbosa da silva', '2021-01-26'],
  [48, 'Ryann Ricardo Gomes da Silva', '2014-07-12'],
  [49, 'Sara Cardoso fiuza Silva', '2015-11-28'],
  [50, 'Sofia Boldo', '2015-03-23'],
  [51, 'Yasmin Hellena Santos Sousa', '2015-05-30'],
  [52, 'Yohana Cristina Gracia Dos Reis', '2015-09-13'],
]

console.log('🔧 Criando coluna child_number...')

await sql`
  ALTER TABLE assisted_people
  ADD COLUMN IF NOT EXISTS child_number INTEGER
`

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS
    assisted_people_project_child_number_uidx
  ON assisted_people (project_id, child_number)
  WHERE child_number IS NOT NULL
`

const apsRows = await sql`
  SELECT id
  FROM projects
  WHERE UPPER(name) = 'APS'
  LIMIT 1
`

if (!apsRows.length) {
  throw new Error('Projeto APS não encontrado.')
}

const apsId = apsRows[0].id
let updated = 0

for (const [number, name, birthDate] of children) {
  const matches = await sql`
    SELECT id, full_name, birth_date
    FROM assisted_people
    WHERE project_id = ${apsId}
      AND active = 1
      AND LOWER(TRIM(full_name)) = LOWER(TRIM(${name}))
      AND birth_date = ${birthDate}
  `

  if (matches.length !== 1) {
    throw new Error(
      `#${number} ${name}: esperado 1 cadastro APS, encontrado ${matches.length}.`
    )
  }

  await sql`
    UPDATE assisted_people
    SET
      child_number = ${number},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${matches[0].id}
  `
  updated += 1
}

const verification = await sql`
  SELECT
    COUNT(*)::int AS total,
    MIN(child_number)::int AS min_number,
    MAX(child_number)::int AS max_number,
    COUNT(DISTINCT child_number)::int AS unique_numbers
  FROM assisted_people
  WHERE project_id = ${apsId}
    AND active = 1
    AND child_number IS NOT NULL
`

console.log('✅ Numeração APS aplicada:', verification[0])

if (
  verification[0].total !== 52 ||
  verification[0].unique_numbers !== 52 ||
  verification[0].min_number !== 1 ||
  verification[0].max_number !== 52
) {
  throw new Error('Validação final da numeração APS falhou.')
}

console.log(`🎉 ${updated} assistidos APS numerados de #01 a #52.`)

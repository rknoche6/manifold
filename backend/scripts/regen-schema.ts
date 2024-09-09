import * as fs from 'fs/promises'
import * as fsBase from 'fs'
import * as readline from 'readline'
import { execSync } from 'child_process'
import { type SupabaseDirectClient } from 'shared/supabase/init'
import { runScript } from 'run-script'
import { isProd } from 'shared/utils'

const outputDir = `../supabase/`

runScript(async ({ pg }) => {
  // make the output directory if it doesn't exist
  execSync(`mkdir -p ${outputDir}`)
  // delete all sql files except seed.sql
  execSync(`cd ${outputDir} && find *.sql -type f ! -name seed.sql -delete`)
  await dump()
  await generateSQLFiles(pg)
})

async function getTableInfo(pg: SupabaseDirectClient, tableName: string) {
  const foreignKeys = await pg.manyOrNone<{
    constraint_name: string
    definition: string
  }>(
    `SELECT
      conname AS constraint_name,
      pg_get_constraintdef(c.oid) AS definition
    FROM
      pg_constraint c
    JOIN
      pg_namespace n ON n.oid = c.connamespace
    WHERE
      contype = 'f'
      AND conrelid = $1::regclass`,
    [tableName]
  )

  const triggers = await pg.manyOrNone<{
    trigger_name: string
    definition: string
  }>(
    `SELECT
      tgname AS trigger_name,
      pg_get_triggerdef(t.oid) AS definition
    FROM
      pg_trigger t
    WHERE
      tgrelid = $1::regclass
      AND NOT tgisinternal`,
    [tableName]
  )
  const rlsEnabled = await pg.one(
    `SELECT relrowsecurity
    FROM pg_class
    WHERE oid = $1::regclass`,
    [tableName]
  )
  const rls = !!rlsEnabled.relrowsecurity

  const policies = await pg.any(
    `SELECT
      polname AS policy_name,
      pg_get_expr(polqual, polrelid) AS expression,
      pg_get_expr(polwithcheck, polrelid) AS with_check,
      (select r.rolname from unnest(polroles) u join pg_roles r on r.oid = u.u) AS role,
      CASE
        WHEN polcmd = '*' THEN 'ALL'
        WHEN polcmd = 'r' THEN 'SELECT'
        WHEN polcmd = 'a' THEN 'INSERT'
        WHEN polcmd = 'w' THEN 'UPDATE'
        WHEN polcmd = 'd' THEN 'DELETE'
        ELSE polcmd::text
      END AS command
    FROM
      pg_policy
    WHERE
      polrelid = $1::regclass`,
    [tableName]
  )

  const indexes = await pg.manyOrNone<{
    index_name: string
    definition: string
  }>(
    `SELECT
      indexname AS index_name,
      indexdef AS definition
    FROM
      pg_indexes
    WHERE
      tablename = $1`,
    [tableName]
  )

  return {
    tableName,
    foreignKeys,
    triggers,
    rls,
    policies,
    indexes,
  }
}

async function getFunctions(pg: SupabaseDirectClient) {
  console.log('Getting functions')
  const rows = await pg.many<{
    function_name: string
    definition: string
  }>(
    `SELECT
      proname AS function_name,
      pg_get_functiondef(oid) AS definition
    FROM pg_proc
    WHERE
      pronamespace = 'public'::regnamespace
      and prokind = 'f'
    ORDER BY proname asc, pronargs asc, oid desc`
  )
  return rows.filter((f) => !f.definition.includes(`'$libdir/`))
}

async function getViews(pg: SupabaseDirectClient) {
  console.log('Getting views')
  return pg.many<{ view_name: string; definition: string }>(
    `SELECT
      table_name AS view_name,
      view_definition AS definition
    FROM information_schema.views
      where table_schema = 'public'
    ORDER BY table_name asc`
  )
}

async function dump() {
  console.log('DAMPU')
  const supabaseProject = isProd()
    ? 'pxidrgkatumlvfqaxcll'
    : 'mfodonznyfxllcezufgr'
  execSync(
    `supabase link -p $SUPABASE_PASSWORD --project-ref ${supabaseProject}`
  )
  execSync(`supabase db dump --linked -s 'public'  -f ./supabase/dump.sql`)
}

async function extractTableDefinitions() {
  console.log('Extracting table definitions')

  const filename = `${outputDir}/dump.sql`
  const fileStream = fsBase.createReadStream(filename)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  })

  let currentTable = ''
  let inTableDefinition = false
  const tableDefs = {} as Record<string, string>

  for await (const line of rl) {
    if (line.startsWith('CREATE TABLE')) {
      inTableDefinition = true
      currentTable = line.match(/"public"."(\w+)"/)![1]
      tableDefs[currentTable] = line + '\n'
    } else if (inTableDefinition) {
      tableDefs[currentTable] += line + '\n'
      if (line.trim() === ');') {
        // strip out the cruft
        tableDefs[currentTable] = tableDefs[currentTable]
          .replaceAll(`"`, ``)
          .replaceAll(`public.`, ``)
        inTableDefinition = false
      }
    }
  }

  return tableDefs
}

async function generateSQLFiles(pg: SupabaseDirectClient) {
  const definitions = await extractTableDefinitions()

  const tables = await pg.map(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    [],
    (row) => row.tablename as string
  )

  console.log(`Getting info for ${tables.length} tables`)
  const tableInfos = await Promise.all(
    tables.map((table) => getTableInfo(pg, table))
  )
  const functions = await getFunctions(pg)
  const views = await getViews(pg)

  for (const tableInfo of tableInfos) {
    let content = `-- This file is autogenerated from regen-schema.ts\n\n`

    content += `${definitions[tableInfo.tableName]}\n`

    if (tableInfo.foreignKeys.length > 0) content += `-- Foreign Keys\n`
    for (const fk of tableInfo.foreignKeys) {
      content += `ALTER TABLE ${tableInfo.tableName} ADD CONSTRAINT ${fk.constraint_name} ${fk.definition};\n`
    }
    content += '\n'

    const tableFunctions = []

    if (tableInfo.triggers.length > 0) content += `-- Triggers\n`
    for (const trigger of tableInfo.triggers) {
      content += `${trigger.definition};\n`

      const funcName = trigger.definition.match(/execute function (\w+)/i)?.[1]
      if (funcName) tableFunctions.push(funcName)
    }
    content += '\n'

    if (tableFunctions.length > 0) content += `-- Functions\n`
    for (const func of tableFunctions) {
      const i = functions.findIndex((f) => f.function_name === func)
      if (i >= 0) {
        content += `${functions[i].definition};\n\n`
        functions.splice(i, 1) // remove from list so we don't duplicate
      }
    }
    if (tableInfo.rls) {
      content += `-- Row Level Security\n`
      content += `ALTER TABLE ${tableInfo.tableName} ENABLE ROW LEVEL SECURITY;\n`
    }

    if (tableInfo.policies.length > 0) {
      content += `-- Policies\n`
    }
    for (const policy of tableInfo.policies) {
      content += `DROP POLICY IF EXISTS "${policy.policy_name}" ON ${tableInfo.tableName};\n`
      content += `CREATE POLICY "${policy.policy_name}" ON ${tableInfo.tableName} `
      if (policy.command) content += `FOR ${policy.command} `
      if (policy.role) content += `TO ${policy.role} `
      if (policy.expression) content += `USING (${policy.expression}) `
      if (policy.with_check) content += `WITH CHECK (${policy.with_check})`
      content += ';\n\n'
    }

    if (tableInfo.indexes.length > 0) content += `-- Indexes\n`
    for (const index of tableInfo.indexes) {
      content += `DROP INDEX IF EXISTS ${index.index_name};\n`
      content += `${index.definition};\n`
    }
    content += '\n'

    await fs.writeFile(`${outputDir}/${tableInfo.tableName}.sql`, content)
  }

  console.log('Writing remaining functions to functions.sql')
  let functionsContent = `-- This file is autogenerated from regen-schema.ts\n\n`

  for (const func of functions) {
    functionsContent += `${func.definition};\n\n`
  }

  await fs.writeFile(`${outputDir}/functions.sql`, functionsContent)

  console.log('Writing views to views.sql')
  let viewsContent = `-- This file is autogenerated from regen-schema.ts\n\n`

  for (const view of views) {
    viewsContent += `CREATE OR REPLACE VIEW ${view.view_name} AS\n`
    viewsContent += `${view.definition}\n\n`
  }

  await fs.writeFile(`${outputDir}/views.sql`, viewsContent)

  console.log('Prettifying SQL files...')
  execSync(
    `prettier --write ${outputDir}/*.sql --ignore-path ../supabase/.gitignore`
  )
}

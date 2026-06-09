import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function pgTypeToTs(dataType: string, udtName: string, isArray: boolean): string {
  let typeStr = 'any';
  
  if (dataType === 'ARRAY' || dataType.startsWith('_') || udtName.startsWith('_')) {
    const elementUdt = udtName.startsWith('_') ? udtName.substring(1) : udtName;
    const elementType = pgTypeToTs(dataType === 'ARRAY' ? 'ELEMENT' : dataType, elementUdt, false);
    return `${elementType}[]`;
  }

  const cleanType = dataType.toLowerCase();
  const cleanUdt = udtName.toLowerCase();
  
  if (['uuid', 'text', 'varchar', 'character varying', 'character', 'date', 'timestamp', 'timestamp with time zone', 'timestamp without time zone', 'time', 'time without time zone', 'interval'].some(t => cleanType.includes(t) || cleanUdt.includes(t))) {
    typeStr = 'string';
  } else if (['integer', 'int', 'bigint', 'smallint', 'numeric', 'real', 'double precision', 'decimal'].some(t => cleanType.includes(t) || cleanUdt.includes(t))) {
    typeStr = 'number';
  } else if (cleanType.includes('boolean') || cleanUdt.includes('bool')) {
    typeStr = 'boolean';
  } else if (cleanType.includes('json') || cleanUdt.includes('json')) {
    typeStr = 'Json';
  } else {
    // Custom enum or type
    typeStr = `Database['public']['Enums']['${udtName}']`;
  }
  
  return typeStr;
}

async function main() {
  console.log('═══ Generating TypeScript Types from Database Schema ═══\n');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is missing in .env.local');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // 1. Fetch Enums
    const enumsRes = await client.query(`
      SELECT t.typname AS enum_name, e.enumlabel AS enum_value
      FROM pg_type t 
      JOIN pg_enum e ON t.oid = e.enumtypid 
      JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY enum_name, e.enumsortorder;
    `);
    
    const enums: Record<string, string[]> = {};
    for (const row of enumsRes.rows) {
      if (!enums[row.enum_name]) {
        enums[row.enum_name] = [];
      }
      enums[row.enum_name].push(row.enum_value);
    }

    // 2. Fetch Tables & Columns
    const colsRes = await client.query(`
      SELECT 
        c.table_name, 
        c.column_name, 
        c.data_type, 
        c.is_nullable, 
        c.column_default,
        udt.typname AS udt_name
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      LEFT JOIN pg_catalog.pg_type udt ON udt.typname = c.udt_name
      WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      ORDER BY c.table_name, c.ordinal_position;
    `);

    const tables: Record<string, any[]> = {};
    for (const row of colsRes.rows) {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push(row);
    }

    // 3. Fetch Views
    const viewsRes = await client.query(`
      SELECT 
        c.table_name AS view_name, 
        c.column_name, 
        c.data_type, 
        c.is_nullable,
        udt.typname AS udt_name
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
      LEFT JOIN pg_catalog.pg_type udt ON udt.typname = c.udt_name
      WHERE c.table_schema = 'public' AND t.table_type = 'VIEW'
      ORDER BY c.table_name, c.ordinal_position;
    `);

    const views: Record<string, any[]> = {};
    for (const row of viewsRes.rows) {
      if (!views[row.view_name]) {
        views[row.view_name] = [];
      }
      views[row.view_name].push(row);
    }

    // 4. Fetch Materialized Views
    const matViewsRes = await client.query(`
      SELECT 
        mat.matviewname AS view_name,
        att.attname AS column_name,
        pg_catalog.format_type(att.atttypid, att.atttypmod) AS data_type,
        NOT att.attnotnull AS is_nullable,
        typ.typname AS udt_name
      FROM pg_catalog.pg_matviews mat
      JOIN pg_catalog.pg_class c ON c.relname = mat.matviewname
      JOIN pg_catalog.pg_attribute att ON att.attrelid = c.oid
      JOIN pg_catalog.pg_type typ ON typ.oid = att.atttypid
      WHERE mat.schemaname = 'public' AND att.attnum > 0 AND NOT att.attisdropped
      ORDER BY mat.matviewname, att.attnum;
    `);

    for (const row of matViewsRes.rows) {
      if (!views[row.view_name]) {
        views[row.view_name] = [];
      }
      views[row.view_name].push({
        column_name: row.column_name,
        data_type: row.data_type,
        is_nullable: row.is_nullable ? 'YES' : 'NO',
        udt_name: row.udt_name
      });
    }

    // Generate output string
    let out = `// ============================================================
// ENERMASS — DATABASE TYPES (auto-generated from schema)
// DO NOT EDIT MANUALLY — regenerate when schema changes.
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
`;

    // Process Tables
    for (const [tableName, cols] of Object.entries(tables)) {
      out += `      ${tableName}: {\n        Row: {\n`;
      for (const col of cols) {
        const isNull = col.is_nullable === 'YES';
        const typeStr = pgTypeToTs(col.data_type, col.udt_name, false);
        out += `          ${col.column_name}: ${typeStr}${isNull ? ' | null' : ''}\n`;
      }
      out += `        }\n        Insert: {\n`;
      for (const col of cols) {
        const isNull = col.is_nullable === 'YES';
        const hasDefault = col.column_default !== null;
        const isOptional = isNull || hasDefault;
        const typeStr = pgTypeToTs(col.data_type, col.udt_name, false);
        out += `          ${col.column_name}${isOptional ? '?' : ''}: ${typeStr}${isNull ? ' | null' : ''}\n`;
      }
      out += `        }\n        Update: {\n`;
      for (const col of cols) {
        const isNull = col.is_nullable === 'YES';
        const typeStr = pgTypeToTs(col.data_type, col.udt_name, false);
        out += `          ${col.column_name}?: ${typeStr}${isNull ? ' | null' : ''}\n`;
      }
      out += `        }\n        Relationships: []\n      }\n`;
    }

    out += `    }\n    Views: {\n`;

    // Process Views
    for (const [viewName, cols] of Object.entries(views)) {
      out += `      ${viewName}: {\n        Row: {\n`;
      for (const col of cols) {
        const isNull = col.is_nullable === 'YES' || col.is_nullable === true;
        const typeStr = pgTypeToTs(col.data_type, col.udt_name || '', false);
        out += `          ${col.column_name}: ${typeStr}${isNull ? ' | null' : ''}\n`;
      }
      out += `        }\n        Relationships: []\n      }\n`;
    }

    out += `    }\n    Functions: {}\n    Enums: {\n`;

    // Process Enums
    for (const [enumName, values] of Object.entries(enums)) {
      const unionVals = values.map(v => `'${v}'`).join(' | ');
      out += `      ${enumName}: ${unionVals}\n`;
    }

    out += `    }\n    CompositeTypes: {}\n  }\n}\n`;

    // Write to files
    const targetFileLocal = path.resolve(process.cwd(), 'src/lib/types/schema.types.ts');
    const targetFileRoot = path.resolve(process.cwd(), 'schema.types.ts');
    
    fs.writeFileSync(targetFileLocal, out, 'utf8');
    fs.writeFileSync(targetFileRoot, out, 'utf8');
    
    console.log(`✅ Types successfully generated at: \n - ${targetFileLocal}\n - ${targetFileRoot}`);

  } catch (err) {
    console.error('❌ Failed to generate types:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

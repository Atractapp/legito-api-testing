---
description: Run Supabase queries using MCP plugin
allowed-tools: mcp__plugin_supabase_supabase__execute_sql, mcp__plugin_supabase_supabase__list_tables, mcp__plugin_supabase_supabase__list_projects
argument-hint: [query-description]
---

## Query Request
$ARGUMENTS

## Available Supabase MCP Tools

1. **List tables:** `mcp__plugin_supabase_supabase__list_tables`
2. **Execute SQL:** `mcp__plugin_supabase_supabase__execute_sql`
3. **List projects:** `mcp__plugin_supabase_supabase__list_projects`

## Steps

1. **Identify the project:**
   - List available projects if needed
   - Use the correct project_id

2. **Explore schema if needed:**
   - List tables to understand structure
   - Check column names and types

3. **Build and execute query:**
   - Write safe, read-only queries when possible
   - Use parameterized queries for safety
   - Limit results appropriately

4. **Format and explain results:**
   - Present data in a readable format
   - Explain what the results mean
   - Suggest follow-up queries if relevant

## Safety Rules
- Prefer SELECT queries
- Always use LIMIT for large tables
- Never DELETE or DROP without explicit user confirmation
- Be careful with UPDATE statements

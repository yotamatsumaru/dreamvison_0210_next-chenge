import { Pool, QueryResult } from 'pg'

// PostgreSQL connection pool
let pool: Pool | null = null

/**
 * Initialize PostgreSQL connection pool
 */
export function initializeDatabase(databaseUrl: string): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      max: 20, // Maximum pool size
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    pool.on('error', (err) => {
      console.error('Unexpected database error:', err)
    })
  }

  return pool
}

/**
 * Get database connection pool
 */
export function getDatabase(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return pool
}

/**
 * Close database connection pool
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end()
    pool = null
  }
}

/**
 * Execute a query with parameters
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const db = getDatabase()
  return db.query<T>(text, params)
}

/**
 * Database helper class (compatible with Cloudflare D1 API)
 */
export class Database {
  private pool: Pool

  constructor(pool: Pool) {
    this.pool = pool
  }

  /**
   * Prepare a SQL statement
   */
  prepare(sql: string) {
    return new PreparedStatement(this.pool, sql)
  }

  /**
   * Execute a batch of SQL statements
   */
  async batch(statements: PreparedStatement[]): Promise<any[]> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      const results = []
      
      for (const stmt of statements) {
        const result = await client.query(stmt.sql, stmt.params)
        results.push({
          success: true,
          results: result.rows,
          meta: {
            rows_read: result.rowCount || 0,
            rows_written: result.rowCount || 0,
          },
        })
      }
      
      await client.query('COMMIT')
      return results
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Execute raw SQL
   */
  async exec(sql: string): Promise<any> {
    const result = await this.pool.query(sql)
    return {
      success: true,
      results: result.rows,
      meta: {
        rows_read: result.rowCount || 0,
        rows_written: result.rowCount || 0,
      },
    }
  }
}

/**
 * Prepared statement class (compatible with Cloudflare D1 API)
 */
export class PreparedStatement {
  public sql: string
  public params: any[]
  private pool: Pool

  constructor(pool: Pool, sql: string) {
    this.pool = pool
    this.sql = sql
    this.params = []
  }

  /**
   * Bind parameters to the statement
   */
  bind(...values: any[]): PreparedStatement {
    this.params = values
    return this
  }

  /**
   * Execute and return first result
   */
  async first<T = any>(colName?: string): Promise<T | null> {
    const result = await this.pool.query(this.sql, this.params)
    if (result.rows.length === 0) {
      return null
    }
    if (colName) {
      return result.rows[0][colName] as T
    }
    return result.rows[0] as T
  }

  /**
   * Execute and return all results
   */
  async all<T = any>(): Promise<{ results: T[]; success: boolean; meta: any }> {
    const result = await this.pool.query(this.sql, this.params)
    return {
      success: true,
      results: result.rows as T[],
      meta: {
        rows_read: result.rowCount || 0,
        rows_written: result.rowCount || 0,
      },
    }
  }

  /**
   * Execute statement (for INSERT, UPDATE, DELETE)
   */
  async run(): Promise<{ success: boolean; meta: any }> {
    const result = await this.pool.query(this.sql, this.params)
    return {
      success: true,
      meta: {
        rows_read: result.rowCount || 0,
        rows_written: result.rowCount || 0,
        last_row_id: (result.rows[0] && result.rows[0].id) || null,
      },
    }
  }

  /**
   * Execute and return raw results
   */
  async raw<T = any>(): Promise<T[]> {
    const result = await this.pool.query(this.sql, this.params)
    return result.rows.map((row) => Object.values(row) as any) as T[]
  }
}

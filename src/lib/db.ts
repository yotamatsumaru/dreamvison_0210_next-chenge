import type { D1Database } from '@cloudflare/workers-types';
import type { Artist, Event, Ticket, Purchase } from '../types';

export class Database {
  constructor(private db: D1Database) {}

  // Artists
  async getArtists(): Promise<Artist[]> {
    const result = await this.db.prepare('SELECT * FROM artists ORDER BY name').all();
    return result.results as Artist[];
  }

  async getArtistBySlug(slug: string): Promise<Artist | null> {
    const result = await this.db.prepare('SELECT * FROM artists WHERE slug = ?').bind(slug).first();
    return result as Artist | null;
  }

  async createArtist(data: Omit<Artist, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const result = await this.db.prepare(
      'INSERT INTO artists (name, slug, description, image_url) VALUES (?, ?, ?, ?)'
    ).bind(data.name, data.slug, data.description, data.image_url).run();
    return result.meta.last_row_id || 0;
  }

  async updateArtist(id: number, data: Partial<Artist>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.image_url !== undefined) {
      fields.push('image_url = ?');
      values.push(data.image_url);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE artists SET ${fields.join(', ')} WHERE id = ?`;
    await this.db.prepare(query).bind(...values).run();
  }

  async deleteArtist(id: number): Promise<void> {
    // Delete related tickets first
    await this.db.prepare(
      'DELETE FROM tickets WHERE event_id IN (SELECT id FROM events WHERE artist_id = ?)'
    ).bind(id).run();
    
    // Delete related events
    await this.db.prepare('DELETE FROM events WHERE artist_id = ?').bind(id).run();
    
    // Delete artist
    await this.db.prepare('DELETE FROM artists WHERE id = ?').bind(id).run();
  }

  // Events
  async getEvents(filters?: { artistId?: number; status?: string }): Promise<Event[]> {
    let query = 'SELECT * FROM events WHERE 1=1';
    const bindings: any[] = [];

    if (filters?.artistId) {
      query += ' AND artist_id = ?';
      bindings.push(filters.artistId);
    }

    if (filters?.status) {
      query += ' AND status = ?';
      bindings.push(filters.status);
    }

    query += ' ORDER BY start_time DESC';

    const result = await this.db.prepare(query).bind(...bindings).all();
    return result.results as Event[];
  }

  async getEventBySlug(slug: string): Promise<Event | null> {
    const result = await this.db.prepare('SELECT * FROM events WHERE slug = ?').bind(slug).first();
    return result as Event | null;
  }

  async getEventById(id: number): Promise<Event | null> {
    const result = await this.db.prepare('SELECT * FROM events WHERE id = ?').bind(id).first();
    return result as Event | null;
  }

  async createEvent(data: Omit<Event, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const result = await this.db.prepare(
      `INSERT INTO events (artist_id, title, slug, description, thumbnail_url, event_type, 
       stream_url, archive_url, cloudfront_key_pair_id, start_time, end_time, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.artist_id,
      data.title,
      data.slug,
      data.description,
      data.thumbnail_url,
      data.event_type,
      data.stream_url,
      data.archive_url,
      data.cloudfront_key_pair_id,
      data.start_time,
      data.end_time,
      data.status
    ).run();
    return result.meta.last_row_id || 0;
  }

  async updateEventStatus(id: number, status: string): Promise<void> {
    await this.db.prepare('UPDATE events SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(status, id).run();
  }

  async updateEvent(id: number, data: Partial<Event>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.stream_url !== undefined) {
      fields.push('stream_url = ?');
      values.push(data.stream_url);
    }
    if (data.archive_url !== undefined) {
      fields.push('archive_url = ?');
      values.push(data.archive_url);
    }
    if (data.thumbnail_url !== undefined) {
      fields.push('thumbnail_url = ?');
      values.push(data.thumbnail_url);
    }
    if (data.cloudfront_key_pair_id !== undefined) {
      fields.push('cloudfront_key_pair_id = ?');
      values.push(data.cloudfront_key_pair_id);
    }
    if (data.start_time !== undefined) {
      fields.push('start_time = ?');
      values.push(data.start_time);
    }
    if (data.end_time !== undefined) {
      fields.push('end_time = ?');
      values.push(data.end_time);
    }

    if (fields.length === 0) {
      return;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE events SET ${fields.join(', ')} WHERE id = ?`;
    await this.db.prepare(query).bind(...values).run();
  }

  // Tickets
  async getTicketsByEventId(eventId: number): Promise<Ticket[]> {
    const result = await this.db.prepare(
      'SELECT * FROM tickets WHERE event_id = ? AND is_active = 1 ORDER BY price'
    ).bind(eventId).all();
    return result.results as Ticket[];
  }

  async getTicketById(id: number): Promise<Ticket | null> {
    const result = await this.db.prepare('SELECT * FROM tickets WHERE id = ?').bind(id).first();
    return result as Ticket | null;
  }

  async createTicket(data: Omit<Ticket, 'id' | 'sold_count' | 'created_at' | 'updated_at'>): Promise<number> {
    const result = await this.db.prepare(
      `INSERT INTO tickets (event_id, name, description, price, currency, stripe_product_id, 
       stripe_price_id, stock, sale_start, sale_end, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.event_id,
      data.name,
      data.description,
      data.price,
      data.currency,
      data.stripe_product_id,
      data.stripe_price_id,
      data.stock,
      data.sale_start,
      data.sale_end,
      data.is_active
    ).run();
    return result.meta.last_row_id || 0;
  }

  async incrementTicketSoldCount(ticketId: number): Promise<void> {
    await this.db.prepare('UPDATE tickets SET sold_count = sold_count + 1 WHERE id = ?')
      .bind(ticketId).run();
  }

  // Purchases
  async createPurchase(data: Omit<Purchase, 'id' | 'purchased_at'>): Promise<number> {
    const result = await this.db.prepare(
      `INSERT INTO purchases (event_id, ticket_id, stripe_customer_id, stripe_checkout_session_id, 
       stripe_payment_intent_id, customer_email, customer_name, amount, currency, status, 
       access_token, access_expires_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.event_id,
      data.ticket_id,
      data.stripe_customer_id,
      data.stripe_checkout_session_id,
      data.stripe_payment_intent_id,
      data.customer_email,
      data.customer_name,
      data.amount,
      data.currency,
      data.status,
      data.access_token,
      data.access_expires_at
    ).run();
    return result.meta.last_row_id || 0;
  }

  async getPurchaseByCheckoutSession(sessionId: string): Promise<Purchase | null> {
    const result = await this.db.prepare(
      'SELECT * FROM purchases WHERE stripe_checkout_session_id = ?'
    ).bind(sessionId).first();
    return result as Purchase | null;
  }

  async getPurchaseByAccessToken(token: string): Promise<Purchase | null> {
    const result = await this.db.prepare(
      'SELECT * FROM purchases WHERE access_token = ? AND status = ?'
    ).bind(token, 'completed').first();
    return result as Purchase | null;
  }

  async getPurchasesByCustomer(customerId: string): Promise<Purchase[]> {
    const result = await this.db.prepare(
      'SELECT * FROM purchases WHERE stripe_customer_id = ? ORDER BY purchased_at DESC'
    ).bind(customerId).all();
    return result.results as Purchase[];
  }

  async updatePurchaseStatus(sessionId: string, status: string): Promise<void> {
    await this.db.prepare(
      'UPDATE purchases SET status = ? WHERE stripe_checkout_session_id = ?'
    ).bind(status, sessionId).run();
  }

  async updatePurchaseAccessToken(sessionId: string, accessToken: string, expiresAt: string): Promise<void> {
    await this.db.prepare(
      'UPDATE purchases SET access_token = ?, access_expires_at = ? WHERE stripe_checkout_session_id = ?'
    ).bind(accessToken, expiresAt, sessionId).run();
  }
}

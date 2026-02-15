import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Bindings } from '../types';
import { Database } from '../lib/db';

const admin = new Hono<{ Bindings: Bindings }>();

// Simple admin authentication middleware
const adminAuth = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const credentials = atob(authHeader.substring(6));
  const [username, password] = credentials.split(':');

  // For now, use environment variables for admin credentials
  // In production, this should check against the admins table with hashed passwords
  const validUsername = c.env.ADMIN_USERNAME || 'admin';
  const validPassword = c.env.ADMIN_PASSWORD || 'admin123';

  if (username !== validUsername || password !== validPassword) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  await next();
};

// Apply auth middleware to all admin routes
admin.use('/*', adminAuth);

// Get all events (admin view)
admin.get('/events', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const events = await db.getEvents();
    
    return c.json(events);
  } catch (error: any) {
    console.error('Admin get events error:', error);
    return c.json({ error: 'Failed to get events', details: error.message }, 500);
  }
});

// Create event
const createEventSchema = z.object({
  artist_id: z.number(),
  title: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  thumbnail_url: z.string().optional(),
  event_type: z.enum(['live', 'archive']),
  stream_url: z.string().optional(),
  archive_url: z.string().optional(),
  cloudfront_key_pair_id: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  status: z.enum(['upcoming', 'live', 'ended', 'archived']).default('upcoming'),
});

admin.post('/events', zValidator('json', createEventSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const db = new Database(c.env.DB);

    const eventId = await db.createEvent(data);

    return c.json({ id: eventId, message: 'Event created successfully' }, 201);
  } catch (error: any) {
    console.error('Admin create event error:', error);
    return c.json({ error: 'Failed to create event', details: error.message }, 500);
  }
});

// Update event status
const updateStatusSchema = z.object({
  status: z.enum(['upcoming', 'live', 'ended', 'archived']),
});

admin.patch('/events/:id/status', zValidator('json', updateStatusSchema), async (c) => {
  try {
    const eventId = parseInt(c.req.param('id'));
    const { status } = c.req.valid('json');
    const db = new Database(c.env.DB);

    await db.updateEventStatus(eventId, status);

    return c.json({ message: 'Event status updated successfully' });
  } catch (error: any) {
    console.error('Admin update event status error:', error);
    return c.json({ error: 'Failed to update event status', details: error.message }, 500);
  }
});

// Update event details
const updateEventSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  stream_url: z.string().optional(),
  archive_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  cloudfront_key_pair_id: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
});

admin.patch('/events/:id', zValidator('json', updateEventSchema), async (c) => {
  try {
    const eventId = parseInt(c.req.param('id'));
    const data = c.req.valid('json');
    const db = new Database(c.env.DB);

    await db.updateEvent(eventId, data);

    return c.json({ message: 'Event updated successfully' });
  } catch (error: any) {
    console.error('Admin update event error:', error);
    return c.json({ error: 'Failed to update event', details: error.message }, 500);
  }
});

// Get all artists
admin.get('/artists', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const artists = await db.getArtists();
    
    return c.json(artists);
  } catch (error: any) {
    console.error('Admin get artists error:', error);
    return c.json({ error: 'Failed to get artists', details: error.message }, 500);
  }
});

// Create artist
const createArtistSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  image_url: z.string().optional(),
});

admin.post('/artists', zValidator('json', createArtistSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const db = new Database(c.env.DB);

    const artistId = await db.createArtist(data);

    return c.json({ id: artistId, message: 'Artist created successfully' }, 201);
  } catch (error: any) {
    console.error('Admin create artist error:', error);
    return c.json({ error: 'Failed to create artist', details: error.message }, 500);
  }
});

// Update artist
const updateArtistSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  image_url: z.string().optional(),
});

admin.patch('/artists/:id', zValidator('json', updateArtistSchema), async (c) => {
  try {
    const artistId = parseInt(c.req.param('id'));
    const data = c.req.valid('json');
    const db = new Database(c.env.DB);

    await db.updateArtist(artistId, data);

    return c.json({ message: 'Artist updated successfully' });
  } catch (error: any) {
    console.error('Admin update artist error:', error);
    return c.json({ error: 'Failed to update artist', details: error.message }, 500);
  }
});

// Delete artist
admin.delete('/artists/:id', async (c) => {
  try {
    const artistId = parseInt(c.req.param('id'));
    const db = new Database(c.env.DB);

    await db.deleteArtist(artistId);

    return c.json({ message: 'Artist deleted successfully' });
  } catch (error: any) {
    console.error('Admin delete artist error:', error);
    return c.json({ error: 'Failed to delete artist', details: error.message }, 500);
  }
});

// Create ticket
const createTicketSchema = z.object({
  event_id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  price: z.number(),
  currency: z.string().default('jpy'),
  stripe_product_id: z.string().optional(),
  stripe_price_id: z.string().optional(),
  stock: z.number().optional(),
  sale_start: z.string().optional(),
  sale_end: z.string().optional(),
  is_active: z.number().default(1),
});

admin.post('/tickets', zValidator('json', createTicketSchema), async (c) => {
  try {
    const data = c.req.valid('json');
    const db = new Database(c.env.DB);

    const ticketId = await db.createTicket(data);

    return c.json({ id: ticketId, message: 'Ticket created successfully' }, 201);
  } catch (error: any) {
    console.error('Admin create ticket error:', error);
    return c.json({ error: 'Failed to create ticket', details: error.message }, 500);
  }
});

// Get all purchases
admin.get('/purchases', async (c) => {
  try {
    const db = new Database(c.env.DB);
    
    // Get recent purchases (you might want to add pagination)
    const result = await c.env.DB.prepare(
      'SELECT p.*, e.title as event_title, t.name as ticket_name FROM purchases p ' +
      'LEFT JOIN events e ON p.event_id = e.id ' +
      'LEFT JOIN tickets t ON p.ticket_id = t.id ' +
      'ORDER BY p.purchased_at DESC LIMIT 100'
    ).all();

    return c.json(result.results);
  } catch (error: any) {
    console.error('Admin get purchases error:', error);
    return c.json({ error: 'Failed to get purchases', details: error.message }, 500);
  }
});

// Get purchase statistics
admin.get('/stats', async (c) => {
  try {
    const db = c.env.DB;
    
    // Total revenue
    const revenueResult = await db.prepare(
      'SELECT SUM(amount) as total_revenue, COUNT(*) as total_purchases FROM purchases WHERE status = ?'
    ).bind('completed').first();

    // Purchases by event
    const eventStatsResult = await db.prepare(
      'SELECT e.title, e.id, COUNT(p.id) as purchase_count, SUM(p.amount) as revenue ' +
      'FROM events e ' +
      'LEFT JOIN purchases p ON e.id = p.event_id AND p.status = ? ' +
      'GROUP BY e.id ORDER BY revenue DESC'
    ).bind('completed').all();

    return c.json({
      total_revenue: revenueResult?.total_revenue || 0,
      total_purchases: revenueResult?.total_purchases || 0,
      events: eventStatsResult.results,
    });
  } catch (error: any) {
    console.error('Admin get stats error:', error);
    return c.json({ error: 'Failed to get stats', details: error.message }, 500);
  }
});

export default admin;

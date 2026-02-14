import { Hono } from 'hono';
import type { Bindings } from '../types';
import { Database } from '../lib/db';
import { verifyAccessToken } from '../lib/auth';
import { generateSignedUrl, generateSignedCookies } from '../lib/cloudfront';

const watch = new Hono<{ Bindings: Bindings }>();

// Verify access token and get viewing permission
watch.post('/verify', async (c) => {
  try {
    const { token } = await c.req.json();
    
    if (!token) {
      return c.json({ error: 'Token required' }, 400);
    }

    const db = new Database(c.env.DB);
    const purchase = await db.getPurchaseByAccessToken(token);

    if (!purchase) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Verify JWT token
    const payload = await verifyAccessToken(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    // Check if token is expired
    if (purchase.access_expires_at) {
      const expiresAt = new Date(purchase.access_expires_at);
      if (expiresAt < new Date()) {
        return c.json({ error: 'Token expired' }, 401);
      }
    }

    // Get event info
    const event = await db.getEventById(purchase.event_id);
    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }

    return c.json({
      valid: true,
      purchase: {
        id: purchase.id,
        eventId: purchase.event_id,
        customerEmail: purchase.customer_email,
      },
      event: {
        id: event.id,
        title: event.title,
        slug: event.slug,
        description: event.description,
        eventType: event.event_type,
        status: event.status,
      },
    });
  } catch (error: any) {
    console.error('Token verification error:', error);
    return c.json({ error: 'Verification failed', details: error.message }, 500);
  }
});

// Get signed streaming URL
watch.post('/stream-url', async (c) => {
  try {
    const { token, eventId } = await c.req.json();
    
    if (!token || !eventId) {
      return c.json({ error: 'Token and eventId required' }, 400);
    }

    const db = new Database(c.env.DB);
    
    // Verify access token
    const purchase = await db.getPurchaseByAccessToken(token);
    if (!purchase || purchase.event_id !== eventId) {
      return c.json({ error: 'Invalid access' }, 401);
    }

    // Get event
    const event = await db.getEventById(eventId);
    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }

    // Get stream URL based on event type
    const streamUrl = event.event_type === 'archive' ? event.archive_url : event.stream_url;
    if (!streamUrl) {
      return c.json({ error: 'Stream URL not available' }, 404);
    }

    // Generate signed URL if CloudFront keys are configured
    if (c.env.CLOUDFRONT_PRIVATE_KEY && c.env.CLOUDFRONT_KEY_PAIR_ID) {
      const signedUrl = await generateSignedUrl(
        streamUrl,
        c.env.CLOUDFRONT_KEY_PAIR_ID,
        c.env.CLOUDFRONT_PRIVATE_KEY,
        3600 // 1 hour expiry
      );

      return c.json({
        streamUrl: signedUrl,
        expiresIn: 3600,
        useSigned: true,
      });
    }

    // If no CloudFront keys, return unsigned URL (for development)
    return c.json({
      streamUrl: streamUrl,
      expiresIn: 0,
      useSigned: false,
    });
  } catch (error: any) {
    console.error('Stream URL generation error:', error);
    return c.json({ error: 'Failed to generate stream URL', details: error.message }, 500);
  }
});

// Get signed cookies for CloudFront
watch.post('/stream-cookies', async (c) => {
  try {
    const { token, eventId } = await c.req.json();
    
    if (!token || !eventId) {
      return c.json({ error: 'Token and eventId required' }, 400);
    }

    const db = new Database(c.env.DB);
    
    // Verify access token
    const purchase = await db.getPurchaseByAccessToken(token);
    if (!purchase || purchase.event_id !== eventId) {
      return c.json({ error: 'Invalid access' }, 401);
    }

    // Get event
    const event = await db.getEventById(eventId);
    if (!event) {
      return c.json({ error: 'Event not found' }, 404);
    }

    // Get stream URL
    const streamUrl = event.event_type === 'archive' ? event.archive_url : event.stream_url;
    if (!streamUrl) {
      return c.json({ error: 'Stream URL not available' }, 404);
    }

    // Generate signed cookies if CloudFront keys are configured
    if (c.env.CLOUDFRONT_PRIVATE_KEY && c.env.CLOUDFRONT_KEY_PAIR_ID) {
      // Extract resource path (e.g., https://example.cloudfront.net/path/* -> /path/*)
      const url = new URL(streamUrl);
      const resourcePath = `${url.origin}${url.pathname.split('/').slice(0, -1).join('/')}/*`;

      const cookies = await generateSignedCookies(
        resourcePath,
        c.env.CLOUDFRONT_KEY_PAIR_ID,
        c.env.CLOUDFRONT_PRIVATE_KEY,
        3600 // 1 hour expiry
      );

      return c.json({
        cookies: cookies,
        domain: url.hostname,
        path: '/',
        expiresIn: 3600,
      });
    }

    return c.json({ error: 'CloudFront signing not configured' }, 500);
  } catch (error: any) {
    console.error('Stream cookies generation error:', error);
    return c.json({ error: 'Failed to generate stream cookies', details: error.message }, 500);
  }
});

export default watch;

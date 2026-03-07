import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { db } from './src/db.js';
import { Resend } from 'resend';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';

// Initialize Resend lazily to avoid crash if key is missing
let resendClient: Resend | null = null;
function getResend() {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security Middlewares
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled for Vite development and inline scripts
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors());
  app.use(express.json());

  // Rate Limiting
  const spinLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    limit: 5, // Limit each IP to 5 spins per windowMs (single-spin app, so 5 is plenty for testing/retries)
    message: { error: 'Zu viele Drehs von dieser IP, bitte warte eine Stunde.' },
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req, res) => process.env.NODE_ENV !== 'production' // Skip rate limiting in DEV mode
  });

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10, // Limit each IP to 10 login requests per window
    message: { error: 'Too many login attempts, please try again after 15 minutes' },
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  const JWT_SECRET = process.env.JWT_SECRET || 'skate-wheel-super-secret-key-change-me-in-production';

  // Simple admin auth middleware using JWT
  const checkAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    let isValidToken = false;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        jwt.verify(token, JWT_SECRET);
        isValidToken = true;
      } catch (e) {
        // Token exists but is invalid/expired
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
    }

    if (isValidToken) {
      return next();
    }

    // Fallback for transition period if frontend still uses x-admin-password
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
    const providedPassword = req.headers['x-admin-password'];

    if (providedPassword === adminPassword) {
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized' });
  };

  // API Routes
  app.post('/api/admin/login', loginLimiter, (req, res) => {
    const { password } = req.body;
    const expectedPassword = process.env.ADMIN_PASSWORD || 'admin';
    if (password === expectedPassword) {
      const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
      res.json({ success: true, token });
    } else {
      res.status(401).json({ error: 'Invalid password' });
    }
  });
  app.get('/api/settings', (req, res) => {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
    try {
      settings.active_slots = JSON.parse(settings.active_slots || '[]');
    } catch (e) {
      settings.active_slots = [];
    }
    res.json(settings);
  });

  app.put('/api/settings', checkAdminAuth, (req, res) => {
    const { active_slots, voucher_bg_url } = req.body;
    db.prepare('UPDATE settings SET active_slots = ?, voucher_bg_url = ? WHERE id = 1')
      .run(JSON.stringify(active_slots || []), voucher_bg_url);
    res.json({ success: true });
  });

  app.get('/api/prizes', (req, res) => {
    let isAdmin = false;

    // Check header
    const authHeader = req.headers['authorization'];
    const passHeader = req.headers['x-admin-password'];

    if (passHeader === (process.env.ADMIN_PASSWORD || 'admin')) {
      isAdmin = true;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        jwt.verify(token, JWT_SECRET);
        isAdmin = true;
      } catch (err) {
        // Invalid token
      }
    }

    const prizes = db.prepare('SELECT * FROM prizes').all() as any[];

    // Attach available codes count
    for (const p of prizes) {
      const codeCount = db.prepare('SELECT COUNT(*) as count FROM prize_codes WHERE prize_id = ? AND is_used = 0').get(p.id) as { count: number };
      p.remaining_quantity = codeCount.count;

      if (isAdmin) {
        const totalCount = db.prepare('SELECT COUNT(*) as count FROM prize_codes WHERE prize_id = ?').get(p.id) as { count: number };
        p.initial_quantity = totalCount.count;

        // fetch list of codes for admin
        const codeRows = db.prepare('SELECT code, is_used FROM prize_codes WHERE prize_id = ?').all(p.id) as any[];
        p.codes_list = codeRows;
      }
    }

    if (!isAdmin) {
      res.json(prizes.filter(p => p.remaining_quantity > 0));
    } else {
      res.json(prizes);
    }
  });

  // Helper function to generate a random 6-character alphanumeric code
  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  app.post('/api/prizes', checkAdminAuth, (req, res) => {
    const { name, color, description, quantity, prefix, custom_codes, value, weight, is_jackpot } = req.body;

    let insertId;
    try {
      db.transaction(() => {
        // 1. Insert Prize
        const result = db.prepare('INSERT INTO prizes (name, color, description, value, weight, is_jackpot) VALUES (?, ?, ?, ?, ?, ?)').run(name, color || '#EF4444', description || '', value || '', weight || 1, is_jackpot ? 1 : 0);
        insertId = result.lastInsertRowid;

        // 2. Insert custom codes if provided
        if (custom_codes && Array.isArray(custom_codes) && custom_codes.some(c => c.trim() !== '')) {
          const insertCode = db.prepare('INSERT INTO prize_codes (prize_id, code, value) VALUES (?, ?, ?)');
          for (const codeStr of custom_codes) {
            if (typeof codeStr === 'string' && codeStr.trim() !== '') {
              insertCode.run(insertId, codeStr.trim(), null);
            }
          }
        }
      })();

      res.json({ id: insertId });
    } catch (e: any) {
      console.error('Save prize error:', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.put('/api/prizes/:id', checkAdminAuth, (req, res) => {
    const { name, color, description, add_quantity, prefix, custom_codes, value, weight, is_jackpot } = req.body;
    const prizeId = req.params.id;

    try {
      db.transaction(() => {
        // 1. Update Prize name, color & desc
        db.prepare('UPDATE prizes SET name = ?, color = ?, description = ?, value = ?, weight = ?, is_jackpot = ? WHERE id = ?').run(name, color || '#EF4444', description || '', value || '', weight || 1, is_jackpot ? 1 : 0, prizeId);

        // 2. Add custom codes if provided
        if (custom_codes && Array.isArray(custom_codes) && custom_codes.length > 0) {
          const insertCode = db.prepare('INSERT INTO prize_codes (prize_id, code, value) VALUES (?, ?, ?)');
          for (const codeStr of custom_codes) {
            if (typeof codeStr === 'string' && codeStr.trim() !== '') {
              insertCode.run(prizeId, codeStr.trim(), null);
            }
          }
        }
      })();
      res.json({ success: true });
    } catch (e: any) {
      console.error('Update prize error:', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.delete('/api/prizes/:id', checkAdminAuth, (req, res) => {
    try {
      db.transaction(() => {
        db.prepare('DELETE FROM prize_codes WHERE prize_id = ?').run(req.params.id);
        db.prepare('DELETE FROM prizes WHERE id = ?').run(req.params.id);
      })();
      res.json({ success: true });
    } catch (e: any) {
      console.error('Delete prize error:', e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });

  app.post('/api/admin/import', checkAdminAuth, (req, res) => {
    const { prizes } = req.body;
    if (!prizes || !Array.isArray(prizes)) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    try {
      db.transaction(() => {
        for (const p of prizes) {
          if (!p.name) continue;

          // Check if prize exists by name
          let prizeRow = db.prepare('SELECT id FROM prizes WHERE name = ?').get(p.name) as { id: number };
          let prizeId;

          if (prizeRow) {
            prizeId = prizeRow.id;
            // Optionally update color and description if provided
            if (p.color || p.description || p.value !== undefined || p.weight !== undefined || p.is_jackpot !== undefined) {
              db.prepare('UPDATE prizes SET color = coalesce(?, color), description = coalesce(?, description), value = coalesce(?, value), weight = coalesce(?, weight), is_jackpot = coalesce(?, is_jackpot) WHERE id = ?')
                .run(p.color || null, p.description || null, p.value || null, p.weight || null, p.is_jackpot !== undefined ? (p.is_jackpot ? 1 : 0) : null, prizeId);
            }
          } else {
            const insertResult = db.prepare('INSERT INTO prizes (name, color, description, value, weight, is_jackpot) VALUES (?, ?, ?, ?, ?, ?)')
              .run(p.name, p.color || '#EF4444', p.description || '', p.value || '', p.weight || 1, p.is_jackpot ? 1 : 0);
            prizeId = insertResult.lastInsertRowid;
          }

          // Insert codes
          if (p.codes && Array.isArray(p.codes)) {
            const insertCode = db.prepare('INSERT OR IGNORE INTO prize_codes (prize_id, code, value) VALUES (?, ?, ?)');
            for (const code of p.codes) {
              if (code && typeof code === 'string' && code.trim() !== '') {
                insertCode.run(prizeId, code.trim(), null);
              }
            }
          }
        }
      })();
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Import failed' });
    }
  });

  app.post('/api/spin', spinLimiter, (req, res) => {
    // Check if active in any slot
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
    let isActive = false;
    const now = new Date().getTime();
    try {
      const slots = JSON.parse(settings.active_slots || '[]');
      isActive = slots.some((s: any) => {
        const from = new Date(s.from).getTime();
        const to = new Date(s.to).getTime();
        return now >= from && now <= to;
      });
    } catch (e) { }

    if (!isActive) {
      return res.status(400).json({ error: 'Wheel is currently inactive.' });
    }

    // Get available prizes (has unused codes)
    const availablePrizes = [];
    const allPrizes = db.prepare('SELECT * FROM prizes').all() as any[];

    // Optimize: prepare statement outside the loop
    const checkCodeCount = db.prepare('SELECT COUNT(*) as count FROM prize_codes WHERE prize_id = ? AND is_used = 0');

    for (const p of allPrizes) {
      const codeCount = checkCodeCount.get(p.id) as { count: number };
      if (codeCount.count > 0) {
        availablePrizes.push({ ...p, remaining_quantity: codeCount.count });
      }
    }

    if (availablePrizes.length === 0) {
      return res.status(400).json({ error: 'No prizes left!' });
    }

    // Calculate total weight to use for weighted random selection
    const totalWeight = availablePrizes.reduce((sum, p) => sum + (p.weight || 1), 0);

    // Pick a random number based on weights
    let random = Math.floor(Math.random() * totalWeight);
    let winningPrize = availablePrizes[0];

    for (const prize of availablePrizes) {
      if (random < (prize.weight || 1)) {
        winningPrize = prize;
        break;
      }
      random -= (prize.weight || 1);
    }

    let insertId;

    try {
      db.transaction(() => {
        const codeRow = db.prepare('SELECT id, code FROM prize_codes WHERE prize_id = ? AND is_used = 0 LIMIT 1').get(winningPrize.id) as { id: number, code: string };
        if (!codeRow) throw new Error('Race condition');

        db.prepare('UPDATE prize_codes SET is_used = 1 WHERE id = ?').run(codeRow.id);

        const insertResult = db.prepare('INSERT INTO winners (prize_id, code, won_at) VALUES (?, ?, ?)')
          .run(winningPrize.id, codeRow.code, new Date().toISOString());
        insertId = insertResult.lastInsertRowid;
      })();
    } catch (e) {
      return res.status(500).json({ error: 'Server error assigning code. Try again.' });
    }

    // Hide the actual code string from the frontend
    res.json({ id: insertId, prize: winningPrize });
  });

  app.put('/api/winners/:id', async (req, res) => {
    const { user_name, user_email } = req.body;
    db.prepare('UPDATE winners SET user_name = ?, user_email = ? WHERE id = ?')
      .run(user_name, user_email, req.params.id);

    // Attempt to send email
    const resend = getResend();
    if (resend && user_email) {
      try {
        const winner = db.prepare(`
          SELECT w.*, p.name as prize_name, p.description as prize_description, pc.value as prize_value 
          FROM winners w 
          LEFT JOIN prizes p ON w.prize_id = p.id 
          LEFT JOIN prize_codes pc ON w.code = pc.code
          WHERE w.id = ?
        `).get(req.params.id) as any;

        if (winner) {
          // Determine app URL to serve background image dynamically
          const appUrl = process.env.VITE_APP_URL || 'https://winner.skate.ch';
          const backgroundUrl = `${appUrl}/Mail-Background.jpg`;

          await resend.emails.send({
            from: process.env.FROM_EMAIL || 'gewinn@winner.skate.ch',
            to: user_email,
            subject: 'Dein SKATE.CH Gewinn zum 10-jährigen Jubiläum!',
            html: `
              <div style="background-color: #f4f4f5; padding: 40px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
                  <tr>
                    <td align="center" style="padding: 30px 20px 20px 20px; text-align: center;">
                      <h1 style="color: #EF4444; font-size: 28px; font-weight: 900; letter-spacing: 2px; margin: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">10 JAHRE SKATE.CH</h1>
                      <p style="color: #71717a; font-size: 16px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin-top: 10px;">Vielen Dank für deine Teilnahme am Gewinnspiel!</p>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 10px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; color: #3f3f46;">
                      Hey <strong>${user_name}</strong>,<br><br>
                      Wir freuen uns sehr – du hast an unserem Wheel of Fortune gedreht und kräftig abgeräumt! Hier ist dein Gewinn:<br>
                      <strong style="color: #EF4444; font-size: 18px;">${winner.prize_name}</strong>
                    </td>
                  </tr>
                  
                  <tr>
                    <td style="padding: 30px 40px;">
                      <!-- Graphic Voucher Box -->
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" background="${backgroundUrl}" style="background-image: url('${backgroundUrl}'); background-size: cover; background-position: center; border-radius: 12px; background-color: #18181b; border: 3px solid #EF4444;">
                        <tr>
                          <!-- Added dark fallback overlay for text readability -->
                          <td style="background: rgba(0,0,0,0.65); border-radius: 9px; padding: 40px 30px; text-align: left;">
                            <p style="color: #EF4444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: bold; font-size: 14px; letter-spacing: 2px; margin: 0; text-transform: uppercase;">Dein Gutschein</p>
                            
                            <h2 style="color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 34px; font-weight: 900; margin: 8px 0 10px 0;">${winner.prize_value ? winner.prize_value : winner.prize_name}</h2>
                            <p style="color: #d4d4d8; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16px; margin: 0 0 35px 0; font-style: italic;">${winner.prize_description || 'Einlösbar bei deinem nächsten Einkauf'}</p>
                            
                            <table cellpadding="0" cellspacing="0" border="0">
                              <tr>
                                <td style="background: #ffffff; padding: 12px 25px; border-radius: 6px; text-align: center;">
                                  <p style="color: #71717a; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin: 0; text-transform: uppercase; font-weight: bold;">Gutscheincode</p>
                                  <p style="color: #18181b; font-family: 'Courier New', Courier, monospace; font-size: 26px; font-weight: 900; margin: 5px 0 0 0; letter-spacing: 3px;">${winner.code}</p>
                                </td>
                              </tr>
                            </table>
                            
                            <p style="color: #a1a1aa; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin-top: 30px; margin-bottom: 0; text-transform: uppercase; font-weight: bold;">Gültig bis 30. April 2026</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <tr>
                    <td align="center" style="padding: 20px 40px 40px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="font-size: 16px; color: #3f3f46; margin-bottom: 25px; line-height: 1.6;">
                        Besuche einfach unseren Webshop und gib deinen Gutscheincode direkt am Ende des Bestellvorgangs ein.<br>Wir freuen uns auf dich!
                      </p>
                      <a href="https://skate.ch" style="display: inline-block; background-color: #EF4444; color: #ffffff; text-decoration: none; padding: 16px 36px; font-weight: bold; border-radius: 30px; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);">Jetzt online einlösen</a>
                    </td>
                  </tr>
                  
                  <tr>
                     <td align="center" style="padding: 20px; background-color: #f4f4f5; text-align: center;">
                        <p style="color: #a1a1aa; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin: 0;">&copy; 2026 SKATE.CH – Keep Rolling.</p>
                     </td>
                  </tr>
                </table>
              </div>
            `
          });

          // Mark email as sent in DB
          db.prepare('UPDATE winners SET email_sent = 1 WHERE id = ?').run(req.params.id);
          console.log(`Email sent successfully to ${user_email}`);
        }
      } catch (error) {
        console.error('Error sending email:', error);
        // We don't fail the request if email fails, as the user still sees the voucher in browser
      }
    }

    res.json({ success: true });
  });

  app.get('/api/winners', checkAdminAuth, (req, res) => {
    const winners = db.prepare(`
      SELECT w.*, p.name as prize_name 
      FROM winners w 
      LEFT JOIN prizes p ON w.prize_id = p.id 
      ORDER BY w.won_at DESC
    `).all();
    res.json(winners);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

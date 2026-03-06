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
          await resend.emails.send({
            from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
            to: user_email,
            subject: 'Dein SKATE.CH Gewinn!',
            html: `
              <div style="font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; padding: 40px; border: 4px solid #EF4444;">
                <h1 style="color: #EF4444; font-size: 32px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 5px;">SKATE.CH</h1>
                <h2 style="color: #fff; font-size: 24px; text-transform: uppercase; margin-top: 0; letter-spacing: 1px;">Dein Gewinn!</h2>
                <hr style="border-color: #EF4444; margin-bottom: 30px;">
                <p style="font-size: 16px; line-height: 1.6; color: #e4e4e7;">
                  Hey <strong>${user_name}</strong>,<br><br>
                  Du hast am Wheel of Fortune teilgenommen und gewonnen! 
                  Hier ist dein Preis: <strong style="color: #EF4444;">${winner.prize_name}</strong>.
                </p>
                ${winner.prize_description ? `<p style="font-size: 14px; color: #a1a1aa; margin-top: -10px; font-style: italic;">${winner.prize_description}</p>` : ''}

                
                ${winner.prize_value ? `<div style="margin-top: 20px;"><span style="color: #a1a1aa; text-transform: uppercase; font-size: 12px; font-weight: bold; letter-spacing: 1px;">Wert</span><br><span style="font-size: 24px; font-weight: bold; color: #EF4444;">${winner.prize_value}</span></div>` : ''}

                <div style="background-color: #fff; color: #000; padding: 20px; font-size: 32px; font-weight: bold; text-align: center; margin: 30px 0; border: 4px solid #000; font-family: monospace;">
                  ${winner.code}
                </div>
                
                <p style="color: #a1a1aa; font-size: 14px;">
                  Löse deinen ERP-Gutscheincode einfach bei deinem nächsten Einkauf im Kassenbereich bei <a href="https://skate.ch" style="color: #EF4444; text-decoration: none; font-weight: bold;">SKATE.CH</a> ein!<br><br>
                  Keep rolling,<br>SKATE.CH Team
                </p>
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

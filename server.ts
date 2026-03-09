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
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  app.set('trust proxy', 1); // Wichtig für Rate Limiting hinter einem Reverse Proxy
  const PORT = 3000;

  // Security Middlewares
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled for Vite development and inline scripts
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
    const {
      name, name_en, name_fr, name_it,
      color,
      description, description_en, description_fr, description_it,
      mail_description, mail_description_en, mail_description_fr, mail_description_it,
      mail_instruction, mail_instruction_en, mail_instruction_fr, mail_instruction_it,
      min_order_value, min_order_value_en, min_order_value_fr, min_order_value_it,
      quantity, prefix, custom_codes, value, weight, is_jackpot, is_same_code
    } = req.body;

    let insertId;
    try {
      db.transaction(() => {
        // 1. Insert Prize
        const result = db.prepare(`INSERT INTO prizes (
          name, name_en, name_fr, name_it, 
          color, 
          description, description_en, description_fr, description_it, 
          mail_description, mail_description_en, mail_description_fr, mail_description_it, 
          mail_instruction, mail_instruction_en, mail_instruction_fr, mail_instruction_it, 
          min_order_value, min_order_value_en, min_order_value_fr, min_order_value_it,
          value, weight, is_jackpot, is_same_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          name, name_en || '', name_fr || '', name_it || '',
          color || '#EF4444',
          description || '', description_en || '', description_fr || '', description_it || '',
          mail_description || '', mail_description_en || '', mail_description_fr || '', mail_description_it || '',
          mail_instruction || '', mail_instruction_en || '', mail_instruction_fr || '', mail_instruction_it || '',
          min_order_value || '', min_order_value_en || '', min_order_value_fr || '', min_order_value_it || '',
          value || '', weight || 1, is_jackpot ? 1 : 0, is_same_code ? 1 : 0
        );
        insertId = result.lastInsertRowid;

        // 2. Insert custom codes if provided
        if (custom_codes && Array.isArray(custom_codes) && custom_codes.some(c => c.trim() !== '')) {
          const insertCode = db.prepare('INSERT INTO prize_codes (prize_id, code, value) VALUES (?, ?, ?)');
          const checkCode = db.prepare('SELECT id FROM prize_codes WHERE LOWER(code) = LOWER(?)');

          for (const codeStr of custom_codes) {
            if (typeof codeStr === 'string' && codeStr.trim() !== '') {
              const code = codeStr.trim();
              if (!is_same_code && checkCode.get(code)) continue;
              insertCode.run(insertId, code, null);
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
    const {
      name, name_en, name_fr, name_it,
      color,
      description, description_en, description_fr, description_it,
      mail_description, mail_description_en, mail_description_fr, mail_description_it,
      mail_instruction, mail_instruction_en, mail_instruction_fr, mail_instruction_it,
      min_order_value, min_order_value_en, min_order_value_fr, min_order_value_it,
      add_quantity, prefix, custom_codes, value, weight, is_jackpot, is_same_code
    } = req.body;
    const prizeId = req.params.id;

    try {
      db.transaction(() => {
        // 1. Update Prize name, color & desc
        db.prepare(`UPDATE prizes SET 
          name = ?, name_en = ?, name_fr = ?, name_it = ?, 
          color = ?, 
          description = ?, description_en = ?, description_fr = ?, description_it = ?, 
          mail_description = ?, mail_description_en = ?, mail_description_fr = ?, mail_description_it = ?, 
          mail_instruction = ?, mail_instruction_en = ?, mail_instruction_fr = ?, mail_instruction_it = ?, 
          min_order_value = ?, min_order_value_en = ?, min_order_value_fr = ?, min_order_value_it = ?,
          value = ?, weight = ?, is_jackpot = ?, is_same_code = ?
          WHERE id = ?`).run(
          name, name_en || '', name_fr || '', name_it || '',
          color || '#EF4444',
          description || '', description_en || '', description_fr || '', description_it || '',
          mail_description || '', mail_description_en || '', mail_description_fr || '', mail_description_it || '',
          mail_instruction || '', mail_instruction_en || '', mail_instruction_fr || '', mail_instruction_it || '',
          min_order_value || '', min_order_value_en || '', min_order_value_fr || '', min_order_value_it || '',
          value || '', weight || 1, is_jackpot ? 1 : 0, is_same_code ? 1 : 0, prizeId
        );

        // 2. Add custom codes if provided
        if (custom_codes && Array.isArray(custom_codes) && custom_codes.length > 0) {
          const insertCode = db.prepare('INSERT INTO prize_codes (prize_id, code, value) VALUES (?, ?, ?)');
          const checkCode = db.prepare('SELECT id FROM prize_codes WHERE LOWER(code) = LOWER(?)');

          for (const codeStr of custom_codes) {
            if (typeof codeStr === 'string' && codeStr.trim() !== '') {
              const code = codeStr.trim();
              if (!is_same_code && checkCode.get(code)) continue;
              insertCode.run(prizeId, code, null);
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
            if (
              p.color || p.description || p.description_en !== undefined || p.description_fr !== undefined || p.description_it !== undefined ||
              p.mail_description !== undefined || p.mail_description_en !== undefined || p.mail_description_fr !== undefined || p.mail_description_it !== undefined ||
              p.mail_instruction !== undefined || p.mail_instruction_en !== undefined || p.mail_instruction_fr !== undefined || p.mail_instruction_it !== undefined ||
              p.name_en !== undefined || p.name_fr !== undefined || p.name_it !== undefined ||
              p.value !== undefined || p.weight !== undefined || p.is_jackpot !== undefined || p.is_same_code !== undefined
            ) {
              db.prepare(`UPDATE prizes SET 
                name_en = coalesce(?, name_en), name_fr = coalesce(?, name_fr), name_it = coalesce(?, name_it),
                color = coalesce(?, color), 
                description = coalesce(?, description), description_en = coalesce(?, description_en), description_fr = coalesce(?, description_fr), description_it = coalesce(?, description_it),
                mail_description = coalesce(?, mail_description), mail_description_en = coalesce(?, mail_description_en), mail_description_fr = coalesce(?, mail_description_fr), mail_description_it = coalesce(?, mail_description_it),
                mail_instruction = coalesce(?, mail_instruction), mail_instruction_en = coalesce(?, mail_instruction_en), mail_instruction_fr = coalesce(?, mail_instruction_fr), mail_instruction_it = coalesce(?, mail_instruction_it),
                min_order_value = coalesce(?, min_order_value), min_order_value_en = coalesce(?, min_order_value_en), min_order_value_fr = coalesce(?, min_order_value_fr), min_order_value_it = coalesce(?, min_order_value_it),
                value = coalesce(?, value), weight = coalesce(?, weight), is_jackpot = coalesce(?, is_jackpot), is_same_code = coalesce(?, is_same_code) WHERE id = ?`)
                .run(
                  p.name_en || null, p.name_fr || null, p.name_it || null,
                  p.color || null,
                  p.description || null, p.description_en || null, p.description_fr || null, p.description_it || null,
                  p.mail_description || null, p.mail_description_en || null, p.mail_description_fr || null, p.mail_description_it || null,
                  p.mail_instruction || null, p.mail_instruction_en || null, p.mail_instruction_fr || null, p.mail_instruction_it || null,
                  p.min_order_value || null, p.min_order_value_en || null, p.min_order_value_fr || null, p.min_order_value_it || null,
                  p.value || null, p.weight || null, p.is_jackpot !== undefined ? (p.is_jackpot ? 1 : 0) : null, p.is_same_code !== undefined ? (p.is_same_code ? 1 : 0) : null, prizeId
                );
            }
          } else {
            const insertResult = db.prepare(`INSERT INTO prizes (
              name, name_en, name_fr, name_it,
              color, 
              description, description_en, description_fr, description_it,
              mail_description, mail_description_en, mail_description_fr, mail_description_it,
              mail_instruction, mail_instruction_en, mail_instruction_fr, mail_instruction_it,
              min_order_value, min_order_value_en, min_order_value_fr, min_order_value_it,
              value, weight, is_jackpot, is_same_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
              .run(
                p.name, p.name_en || '', p.name_fr || '', p.name_it || '',
                p.color || '#EF4444',
                p.description || '', p.description_en || '', p.description_fr || '', p.description_it || '',
                p.mail_description || '', p.mail_description_en || '', p.mail_description_fr || '', p.mail_description_it || '',
                p.mail_instruction || '', p.mail_instruction_en || '', p.mail_instruction_fr || '', p.mail_instruction_it || '',
                p.min_order_value || '', p.min_order_value_en || '', p.min_order_value_fr || '', p.min_order_value_it || '',
                p.value || '', p.weight || 1, p.is_jackpot ? 1 : 0, p.is_same_code ? 1 : 0
              );
            prizeId = insertResult.lastInsertRowid;
          }

          // Insert codes
          if (p.codes && Array.isArray(p.codes)) {
            const insertCode = db.prepare('INSERT INTO prize_codes (prize_id, code, value) VALUES (?, ?, ?)');
            const checkCode = db.prepare('SELECT id FROM prize_codes WHERE LOWER(code) = LOWER(?)');

            for (const codeStr of p.codes) {
              if (codeStr && typeof codeStr === 'string' && codeStr.trim() !== '') {
                const code = codeStr.trim();
                if (!p.is_same_code && checkCode.get(code)) continue;
                insertCode.run(prizeId, code, null);
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

  // Get codes for a prize
  app.get('/api/prizes/:id/codes', checkAdminAuth, (req, res) => {
    try {
      const codes = db.prepare('SELECT * FROM prize_codes WHERE prize_id = ? ORDER BY is_used ASC, id DESC').all(req.params.id);
      res.json(codes);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch codes' });
    }
  });

  // Edit a specific code
  app.put('/api/codes/:id', checkAdminAuth, (req, res) => {
    try {
      const codeStr = req.body.code?.trim();
      if (!codeStr) return res.status(400).json({ error: 'Empty code' });

      const existing = db.prepare('SELECT is_used, prize_id FROM prize_codes WHERE id = ?').get(req.params.id) as any;
      if (!existing) return res.status(404).json({ error: 'Code not found' });
      if (existing.is_used === 1) return res.status(400).json({ error: 'Cannot edit locked (used) code' });

      // Check for duplicate if not universal code
      const prize = db.prepare('SELECT is_same_code FROM prizes WHERE id = ?').get(existing.prize_id) as any;
      if (!prize.is_same_code) {
        const dup = db.prepare('SELECT id FROM prize_codes WHERE LOWER(code) = LOWER(?) AND id != ?').get(codeStr, req.params.id);
        if (dup) return res.status(400).json({ error: 'Dieser Code existiert bereits im System.' });
      }

      db.prepare('UPDATE prize_codes SET code = ? WHERE id = ?').run(codeStr, req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  // Delete a specific code
  app.delete('/api/codes/:id', checkAdminAuth, (req, res) => {
    try {
      const existing = db.prepare('SELECT is_used FROM prize_codes WHERE id = ?').get(req.params.id) as any;
      if (!existing) return res.status(404).json({ error: 'Code not found' });
      if (existing.is_used === 1) return res.status(400).json({ error: 'Cannot delete locked (used) code' });

      db.prepare('DELETE FROM prize_codes WHERE id = ?').run(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
    }
  });

  // Add new codes to a prize
  app.post('/api/prizes/:id/codes', checkAdminAuth, (req, res) => {
    try {
      const codes = req.body.codes; // Array of strings
      if (!codes || !Array.isArray(codes)) return res.status(400).json({ error: 'Invalid payload' });

      const prize = db.prepare('SELECT is_same_code FROM prizes WHERE id = ?').get(req.params.id) as any;
      if (!prize) return res.status(404).json({ error: 'Prize not found' });

      const insertCode = db.prepare('INSERT INTO prize_codes (prize_id, code, value) VALUES (?, ?, ?)');
      const checkCode = db.prepare('SELECT id FROM prize_codes WHERE LOWER(code) = LOWER(?)');

      let addedCount = 0;
      let skippedCount = 0;
      db.transaction(() => {
        for (const c of codes) {
          const codeStr = typeof c === 'string' ? c.trim() : '';
          if (codeStr !== '') {
            if (!prize.is_same_code && checkCode.get(codeStr)) {
              skippedCount++;
              continue;
            }
            insertCode.run(req.params.id, codeStr, null);
            addedCount++;
          }
        }
      })();

      res.json({ success: true, added: addedCount, skipped: skippedCount });
    } catch (e) {
      res.status(500).json({ error: 'Failed' });
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

        if (!winningPrize.is_same_code) {
          db.prepare('UPDATE prize_codes SET is_used = 1 WHERE id = ?').run(codeRow.id);
        }

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
    const { first_name, last_name, newsletter, user_email, language } = req.body;
    const user_name = `${first_name} ${last_name}`.trim();
    const userLang = language || 'de';
    db.prepare('UPDATE winners SET user_name = ?, first_name = ?, last_name = ?, newsletter = ?, user_email = ?, language = ? WHERE id = ?')
      .run(user_name, first_name || '', last_name || '', newsletter ? 1 : 0, user_email, userLang, req.params.id);

    // Attempt to send email
    const resend = getResend();
    if (resend && user_email) {
      try {
        const winner = db.prepare(`
          SELECT w.*, p.*, pc.value as prize_value 
          FROM winners w 
          LEFT JOIN prizes p ON w.prize_id = p.id 
          LEFT JOIN prize_codes pc ON w.code = pc.code
          WHERE w.id = ?
        `).get(req.params.id) as any;

        if (winner) {
          // Determine app URL to serve background image dynamically
          const appUrl = process.env.VITE_APP_URL || 'https://win.skate.ch';
          const backgroundUrl = `${appUrl}/Mail-Background.jpg`;

          // Translations mapping based on language
          const l = userLang === 'en' || userLang === 'fr' || userLang === 'it' ? `_${userLang}` : '';

          const translatedName = winner[`name${l}`] || winner.name;
          const translatedDesc = winner[`description${l}`] || winner.description;
          const translatedMailDesc = winner[`mail_description${l}`] || winner[`mail_description`] || translatedDesc;
          const translatedMailInst = winner[`mail_instruction${l}`] || winner[`mail_instruction`];
          const translatedMinOrder = winner[`min_order_value${l}`] || winner[`min_order_value`];

          // Default subjects based on language
          const subjects: any = {
            en: 'Your SKATE.CH 10th Anniversary Prize!',
            fr: 'Votre prix pour le 10e anniversaire de SKATE.CH !',
            it: 'Il tuo premio per il 10° anniversario di SKATE.CH!',
            de: 'Dein SKATE.CH Gewinn zum 10-jährigen Jubiläum!',
          };

          const subject = subjects[userLang] || subjects['de'];
          const thankYouText: any = {
            en: 'Thank you for participating!',
            fr: 'Merci d\'avoir participé !',
            it: 'Grazie per aver partecipato!',
            de: 'Vielen Dank für deine Teilnahme am Gewinnspiel!'
          };

          const heyText: any = {
            en: 'Hey', fr: 'Salut', it: 'Ciao', de: 'Hey'
          };

          const introText: any = {
            en: 'We are thrilled – you spun our Wheel of Fortune and won big! Here is your prize:',
            fr: 'Nous sommes ravis - vous avez fait tourner notre Roue de la Fortune et raflé la mise ! Voici votre prix:',
            it: 'Siamo entusiasti: hai girato la nostra Ruota della Fortuna e hai vinto alla grande! Ecco il tuo premio:',
            de: 'Wir freuen uns sehr – du hast an unserem Wheel of Fortune gedreht und kräftig abgeräumt! Hier ist dein Gewinn:'
          };

          const voucherText: any = {
            en: 'Your Prize', fr: 'Votre bon', it: 'Il tuo buono', de: 'Dein Gewinn'
          };

          const codeText: any = {
            en: 'Voucher Code', fr: 'Code du bon', it: 'Codice del buono', de: 'Gutscheincode'
          };

          const defaultMailDesc: any = {
            en: 'Redeemable on your next purchase',
            fr: 'Réutilisable lors de votre prochain achat',
            it: 'Riscattabile al tuo prossimo acquisto',
            de: 'Einlösbar bei deinem nächsten Einkauf'
          };

          const validUntil: any = {
            en: 'Valid until April 30, 2026',
            fr: 'Valable jusqu\'au 30 avril 2026',
            it: 'Valido fino al 30 aprile 2026',
            de: 'Gültig bis 30. April 2026'
          };

          const defaultMailInst: any = {
            en: 'Simply visit our webshop and enter your voucher code directly at checkout.',
            fr: 'Visitez simplement notre boutique en ligne et entrez votre code de bon directement à la caisse.',
            it: 'Visita il nostro negozio online e inserisci il codice del tuo buono direttamente alla cassa.',
            de: 'Besuche einfach unseren Webshop und gib deinen Gutscheincode direkt am Ende des Bestellvorgangs ein.'
          };

          const finalGreeting: any = {
            en: 'We look forward to seeing you!<br>Keep Rolling.',
            fr: 'Nous avons hâte de vous voir !<br>Keep Rolling.',
            it: 'Non vediamo l\'ora di vederti!<br>Keep Rolling.',
            de: 'Wir freuen uns auf dich!<br>Keep Rolling.'
          };

                    const defaultDesc: any = { en: 'Here is your prize:', fr: 'Voici votre prix :', it: 'Ecco il tuo premio:', de: 'Hier ist dein Gewinn:' };
          const buttonText: any = {
            en: 'Redeem online now', fr: 'Échanger en ligne', it: 'Riscatta online', de: 'Jetzt online einlösen'
          };

          await resend.emails.send({
            from: process.env.FROM_EMAIL || 'gewinn@winner.skate.ch',
            to: user_email,
            subject: subject,
            html: `
              <div style="background-color: #f4f4f5; padding: 40px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
                  
                  <!-- Brand and Campaign Context Header -->
                  <tr>
                    <td align="center" style="padding: 0; text-align: center; background-color: #ffffff;">
                      <img src="${appUrl}/10-years-skate.ch.png" alt="10 JAHRE SKATE.CH" width="480" style="width: 80%; max-width: 480px; display: block; margin: 0 auto; border: 0;" />
                    </td>
                  </tr>
                  
                  <!-- Short Email Context -->
                  <tr>
                    <td align="center" style="padding: 20px 20px 0 20px; text-align: center;">
                      <p style="color: #71717a; font-size: 14px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0;">${thankYouText[userLang] || thankYouText['de']}</p>
                    </td>
                  </tr>
                  
                  <!-- Personal Greeting & Pop-up Description instead of win statement -->
                  <tr>
                    <td align="center" style="padding: 30px 40px 10px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="font-size: 16px; color: #3f3f46; margin: 0 0 10px 0; font-weight: bold;">
                        ${heyText[userLang] || heyText['de']} ${winner.first_name || winner.user_name},
                      </p>
                      <h2 style="color: #18181b; font-size: 28px; font-weight: 900; margin: 0 0 20px 0; line-height: 1.3;">
                        ${translatedDesc || defaultDesc[userLang] || defaultDesc['de']}
                      </h2>
                    </td>
                  </tr>
                  
                  <!-- Visual Prize Box -->
                  <tr>
                    <td align="center" style="padding: 0 40px 15px 40px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #18181b; border-radius: 12px; border: 2px solid #EF4444;">
                        <tr>
                          <td align="center" style="padding: 40px 30px;">
                            
                            <!-- 1. Type of Prize -->
                            <p style="color: #EF4444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-weight: 900; font-size: 22px; letter-spacing: 3px; margin: 0 0 15px 0; text-transform: uppercase;">
                              ${voucherText[userLang] || voucherText['de']}
                            </p>
                            
                            <!-- 2. Value Name -->
                            <h3 style="color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 38px; font-weight: 900; margin: 0 0 25px 0; line-height: 1.1;">
                              ${translatedName || winner.value || winner.prize_value}
                            </h3>
                            
                            <!-- 3. Voucher Code -->
                            <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                              <tr>
                                <td align="center" style="background: #ffffff; padding: 15px 30px; border-radius: 8px;">
                                  <p style="color: #71717a; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11px; margin: 0 0 5px 0; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">
                                    ${codeText[userLang] || codeText['de']}
                                  </p>
                                  <p style="color: #18181b; font-family: 'Courier New', Courier, monospace; font-size: 28px; font-weight: 900; margin: 0; letter-spacing: 2px;">
                                    ${winner.code}
                                  </p>
                                </td>
                              </tr>
                            </table>
                            
                            <!-- 4. Conditions (Min Order) -->
                            ${translatedMinOrder ? `<div style="margin-top: 25px;"><p style="color: #ef4444; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; margin: 0; font-weight: bold; background: rgba(239, 68, 68, 0.1); display: inline-block; padding: 6px 12px; border-radius: 4px;">${translatedMinOrder}</p></div>` : ``}
                            
                            <!-- 5. Validity -->
                            <p style="color: #a1a1aa; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin: 25px 0 0 0; text-transform: uppercase; font-weight: bold;">
                              ${validUntil[userLang] || validUntil['de']}
                            </p>
                            
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- Short Description UNDER the box -->
                  <tr>
                    <td align="center" style="padding: 25px 40px 40px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="color: #3f3f46; font-size: 15px; margin: 0; line-height: 1.6;">
                        ${translatedMailDesc || defaultMailDesc[userLang] || defaultMailDesc['de']}
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Short Usage Instructions -->
                  <tr>
                    <td align="center" style="padding: 10px 40px 30px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="font-size: 15px; color: #3f3f46; margin: 0; line-height: 1.6;">
                        ${translatedMailInst ? translatedMailInst.replace(/\n/g, '<br>').replace(/\n/g, '<br>') : (defaultMailInst[userLang] || defaultMailInst['de'])}
                      </p>
                    </td>
                  </tr>
                  
                  <!-- CTA Button -->
                  <tr>
                    <td align="center" style="padding: 0 40px 30px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <a href="https://skate.ch" style="display: inline-block; background-color: #EF4444; color: #ffffff; text-decoration: none; padding: 16px 40px; font-size: 16px; font-weight: 900; border-radius: 30px; text-transform: uppercase; letter-spacing: 1.5px;">
                        ${buttonText[userLang] || buttonText['de']}
                      </a>
                    </td>
                  </tr>
                  
                  <!-- Rules / Disclaimer for the user -->
                  <tr>
                    <td align="center" style="padding: 0 40px 30px 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                      <p style="font-size: 11px; color: #a1a1aa; margin: 0; line-height: 1.5; text-align: center;">
                        Pro Person ist nur eine Teilnahme erlaubt. Preise werden ausschliesslich innerhalb der Schweiz versendet. Der Rechtsweg ist ausgeschlossen. Bei mehrfacher Teilnahme oder sonstiger missbräuchlicher Nutzung erlischt jeglicher Anspruch auf sämtliche Preise.
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Optional Brand Footer -->
                  <tr>
                     <td align="center" style="padding: 30px; background-color: #f4f4f5; text-align: center;">
                        <p style="color: #18181b; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 18px; font-weight: 900; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px;">Keep Rolling.</p>
                        <p style="color: #a1a1aa; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; margin: 0;">&copy; 2026 SKATE.CH</p>
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

  app.get('/api/admin/export-prizes', checkAdminAuth, (req, res) => {
    try {
      const prizes = db.prepare(`SELECT * FROM prizes ORDER BY id ASC`).all();
      const result = prizes.map((p: any) => {
        const codes = db.prepare(`SELECT code FROM prize_codes WHERE prize_id = ?`).all(p.id).map((r: any) => r.code);
        return { ...p, codes };
      });
      res.json(result);
    } catch (error) {
      console.error('Export prizes error:', error);
      res.status(500).json({ error: 'Failed to export prizes' });
    }
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

  // Vite middleware for development or Static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from the React app build
    app.use(express.static(path.join(__dirname, 'dist')));
    
    // The "catchall" handler: for any request that doesn't
    // match one above, send back React's index.html file.
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

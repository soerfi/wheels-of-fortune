import re

with open('server.ts', 'r') as f:
    content = f.read()

# 1. Update /api/settings PUT route
old_put_settings = r'''  app.put('/api/settings', checkAdminAuth, (req, res) => {
    const { active_slots, voucher_bg_url } = req.body;
    db.prepare('UPDATE settings SET active_slots = ?, voucher_bg_url = ? WHERE id = 1')
      .run(JSON.stringify(active_slots || []), voucher_bg_url);
    res.json({ success: true });
  });'''

new_put_settings = r'''  app.put('/api/settings', checkAdminAuth, (req, res) => {
    const { active_slots, voucher_bg_url, test_mode } = req.body;
    db.prepare('UPDATE settings SET active_slots = ?, voucher_bg_url = ?, test_mode = ? WHERE id = 1')
      .run(JSON.stringify(active_slots || []), voucher_bg_url, test_mode ? 1 : 0);
    res.json({ success: true });
  });'''
content = content.replace(old_put_settings, new_put_settings)


# 2. Update rate limiter to check test_mode
old_spin_limiter = r'''  const spinLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    limit: 2, // Limit each IP to 2 spins per hour
    message: { error: 'Zu viele Drehs von dieser IP, bitte warte eine Stunde.' },
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req, res) => process.env.NODE_ENV !== 'production' // Skip rate limiting in DEV mode
  });'''

new_spin_limiter = r'''  const spinLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    limit: 2, // Limit each IP to 2 spins per hour
    message: { error: 'Zu viele Drehs von dieser IP, bitte warte eine Stunde.' },
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req, res) => {
      // Skip rate limiting in DEV mode or if test_mode is enabled
      if (process.env.NODE_ENV !== 'production') return true;
      try {
        const settings = db.prepare('SELECT test_mode FROM settings WHERE id = 1').get() as any;
        return settings?.test_mode === 1;
      } catch (e) {
        return false;
      }
    }
  });'''
content = content.replace(old_spin_limiter, new_spin_limiter)


# 3. Update /api/winners/:id to skip email check in test_mode
old_email_check = r'''    // Security Check: 1 win per email
    if (user_email) {
      const existingWinner = db.prepare('SELECT id FROM winners WHERE user_email = ? AND id != ?').get(user_email, req.params.id);
      if (existingWinner) {
        return res.status(400).json({ error: 'Diese E-Mail-Adresse hat bereits an diesem Gewinnspiel teilgenommen.' });
      }
    }'''

new_email_check = r'''    // Security Check: 1 win per email
    if (user_email) {
      const settings = db.prepare('SELECT test_mode FROM settings WHERE id = 1').get() as any;
      if (settings?.test_mode !== 1) {
        const existingWinner = db.prepare('SELECT id FROM winners WHERE user_email = ? AND id != ?').get(user_email, req.params.id);
        if (existingWinner) {
          return res.status(400).json({ error: 'Diese E-Mail-Adresse hat bereits an diesem Gewinnspiel teilgenommen.' });
        }
      }
    }'''
content = content.replace(old_email_check, new_email_check)


with open('server.ts', 'w') as f:
    f.write(content)

print("Backend test mode updates applied to server.ts")

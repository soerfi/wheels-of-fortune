import re

with open('server.ts', 'r') as f:
    content = f.read()

# 1. Reduce the IP limit to 2 per hour
old_limit = r'''  const spinLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    limit: 5, // Limit each IP to 5 spins per windowMs (single-spin app, so 5 is plenty for testing/retries)
    message: { error: 'Zu viele Drehs von dieser IP, bitte warte eine Stunde.' },
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req, res) => process.env.NODE_ENV !== 'production' // Skip rate limiting in DEV mode
  });'''

new_limit = r'''  const spinLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    limit: 2, // Limit each IP to 2 spins per hour
    message: { error: 'Zu viele Drehs von dieser IP, bitte warte eine Stunde.' },
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip: (req, res) => process.env.NODE_ENV !== 'production' // Skip rate limiting in DEV mode
  });'''
content = content.replace(old_limit, new_limit)

# 2. Add email constraint to /api/winners/:id
old_put_api = r'''  app.put('/api/winners/:id', async (req, res) => {
    const { first_name, last_name, newsletter, user_email, language } = req.body;
    const user_name = `${first_name} ${last_name}`.trim();
    const userLang = language || 'de';
    db.prepare('UPDATE winners SET user_name = ?, first_name = ?, last_name = ?, newsletter = ?, user_email = ?, language = ? WHERE id = ?')
      .run(user_name, first_name || '', last_name || '', newsletter ? 1 : 0, user_email, userLang, req.params.id);'''

new_put_api = r'''  app.put('/api/winners/:id', async (req, res) => {
    const { first_name, last_name, newsletter, user_email, language } = req.body;
    
    // Security Check: 1 win per email
    if (user_email) {
      const existingWinner = db.prepare('SELECT id FROM winners WHERE user_email = ? AND id != ?').get(user_email, req.params.id);
      if (existingWinner) {
        return res.status(400).json({ error: 'Diese E-Mail-Adresse hat bereits an diesem Gewinnspiel teilgenommen.' });
      }
    }

    const user_name = `${first_name} ${last_name}`.trim();
    const userLang = language || 'de';
    db.prepare('UPDATE winners SET user_name = ?, first_name = ?, last_name = ?, newsletter = ?, user_email = ?, language = ? WHERE id = ?')
      .run(user_name, first_name || '', last_name || '', newsletter ? 1 : 0, user_email, userLang, req.params.id);'''
content = content.replace(old_put_api, new_put_api)


with open('server.ts', 'w') as f:
    f.write(content)

print("Updates applied to server.ts")

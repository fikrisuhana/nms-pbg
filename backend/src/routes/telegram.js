const express  = require('express');
const router   = express.Router();
const pool     = require('../db/pool');
const telegram = require('../services/telegram');
const { adminAuth } = require('../middleware/auth');

// GET /api/telegram
router.get('/', async (req, res) => {
    try {
        const config = await telegram.getConfig();
        // Mask token for security
        const safe = config ? { ...config, bot_token: config.bot_token ? '***' : '' } : null;
        res.json(safe);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/telegram
router.put('/', adminAuth, async (req, res) => {
    const { bot_token, chat_id, enabled } = req.body;
    try {
        await pool.query(
            `UPDATE telegram_config
             SET bot_token  = COALESCE(NULLIF($1,''), bot_token),
                 chat_id    = COALESCE(NULLIF($2,''), chat_id),
                 enabled    = $3,
                 updated_at = NOW()`,
            [bot_token || '', chat_id || '', enabled === true || enabled === 'true']
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/telegram/test
router.post('/test', adminAuth, async (req, res) => {
    const sent = await telegram.sendMessage('✅ <b>NMS-PBG</b> — Telegram berhasil terhubung!');
    res.json({ ok: sent, message: sent ? 'Pesan terkirim' : 'Gagal kirim (cek token/chat_id dan enabled)' });
});

module.exports = router;

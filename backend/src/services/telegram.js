const axios = require('axios');
const pool  = require('../db/pool');

async function getConfig() {
    const result = await pool.query('SELECT * FROM telegram_config LIMIT 1');
    return result.rows[0] || null;
}

async function sendMessage(text) {
    const config = await getConfig();
    if (!config || !config.enabled || !config.bot_token || !config.chat_id) return false;

    try {
        await axios.post(`https://api.telegram.org/bot${config.bot_token}/sendMessage`, {
            chat_id:    config.chat_id,
            text:       text,
            parse_mode: 'HTML',
        }, { timeout: 10000 });
        return true;
    } catch (err) {
        console.error('[Telegram] Failed to send message:', err.message);
        return false;
    }
}

module.exports = { sendMessage, getConfig };

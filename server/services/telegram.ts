import { getSettings } from '../database/settingsDao.js';
import { addLog } from '../database/logDao.js';

let telegramHealth: { status: 'connected' | 'stable' | 'unconfigured' | 'degraded' | 'down'; latency: number } = { status: 'unconfigured', latency: 0 };

export async function updateTelegramHealth(): Promise<{ status: 'connected' | 'stable' | 'unconfigured' | 'degraded' | 'down'; latency: number }> {
  try {
    const settings = await getSettings();
    if (!settings.botToken || !settings.chatId) {
      telegramHealth = { status: 'unconfigured', latency: 0 };
      return telegramHealth;
    }
    const start = Date.now();
    const url = `https://api.telegram.org/bot${settings.botToken}/getMe`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (response.ok) {
      const latency = Date.now() - start;
      telegramHealth = { status: latency > 1500 ? 'degraded' : 'connected', latency };
    } else {
      telegramHealth = { status: 'down', latency: -1 };
    }
  } catch (error) {
    telegramHealth = { status: 'down', latency: -1 };
  }
  return telegramHealth;
}

export function getTelegramHealth() {
  // Fire background health ping if older than 2 minutes
  pingTelegram().catch(() => {});
  return telegramHealth;
}

export async function pingTelegram() {
  await updateTelegramHealth();
}

export async function sendToTelegram(text: string, customChatId?: string | null) {
  const settings = await getSettings();
  const targetChatId = customChatId || settings.chatId;
  if (!settings.botToken || !targetChatId) {
     return { success: false, error: 'Telegram not configured' };
  }
  
  const start = Date.now();
  try {
    const url = `https://api.telegram.org/bot${settings.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ 
        chat_id: targetChatId, 
        text, 
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      const errorMsg = responseData.description || "Unknown Telegram API error";
      await addLog('ERROR', 'TELEGRAM', `API Error: ${errorMsg}`);
      telegramHealth = { status: 'down', latency: -1 };
      return { success: false, error: errorMsg };
    }
    
    const latency = Date.now() - start;
    telegramHealth = { status: latency > 1500 ? 'degraded' : 'stable', latency };
    return { success: true, messageId: responseData.result.message_id };
  } catch (error: any) {
    await addLog('ERROR', 'TELEGRAM', `Network error: ${error.message}`);
    telegramHealth = { status: 'down', latency: -1 };
    return { success: false, error: error.message || "Network error" };
  }
}

export async function sendReplyToTelegram(text: string, replyToMessageId: number, customChatId?: string | null) {
  const settings = await getSettings();
  const targetChatId = customChatId || settings.chatId;
  if (!settings.botToken || !targetChatId) return { success: false };
  
  try {
    const url = `https://api.telegram.org/bot${settings.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ 
        chat_id: targetChatId,
        reply_to_message_id: replyToMessageId,
        text, 
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const responseData = await response.json();
    if (!response.ok) {
      return { success: false, error: responseData?.description || `HTTP ${response.status}` };
    }
    return { success: true, messageId: responseData?.result?.message_id };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

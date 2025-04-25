const TELEGRAM_API_URL =
  process.env.TELEGRAM_API_URL || "https://api.telegram.org/bot";
const axios = require("axios");
const { Telegraf } = require("telegraf");

const BOT_API_TOKEN = process.env.BOT_API_TOKEN;

const bot = new Telegraf(BOT_API_TOKEN);

function errorHandler(error) {
  if (error.response) {
    if (error.response.status === 401 || error.response.status === 404) {
      return { ok: false, code: 401 };
    }
  }
  const response = {
    ok: false,
    code: 1,
    data: error.message || error.response?.data,
  };
  bot.telegram.sendMessage(process.env.ADMIN_ID, `Error:\n\n${response.data}`);
  console.error("Error:", error);
  return response;
}

async function getMe(token) {
  try {
    const response = await axios.get(`${TELEGRAM_API_URL}${token}/getMe`);
    return { ok: true, username: response.data.result.username };
  } catch (error) {
    return errorHandler(error);
  }
}

async function setWebhook(token, webhookUrl) {
  try {
    await axios.get(`${TELEGRAM_API_URL}${token}/setWebhook`, {
      params: { url: webhookUrl },
    });
    return { ok: true };
  } catch (error) {
    return errorHandler(error);
  }
}

async function deleteWebhook(token) {
  try {
    await axios.get(`${TELEGRAM_API_URL}${token}/deleteWebhook`);
    return { ok: true };
  } catch (error) {
    errorHandler(error);
  }
}

async function sendMessage(token, chatId, text) {
  try {
    await axios.post(`${TELEGRAM_API_URL}${token}/sendMessage`, {
      chat_id: chatId,
      text: text,
    });
    return { ok: true };
  } catch (error) {
    errorHandler(error);
  }
}

async function getBots(users, user_id) {
  const botsObject = users.data[user_id].bots || {};
  const tokens = Object.keys(botsObject);

  const bots = await Promise.all(
    tokens.map(async (token) => {
      const result = await getMe(token);
      if (!result.ok) {
        if (result.code === 401) {
          delete users.data[user_id].bots[token];
          users.save();
        }
      } else {
        return { token, username: result.username };
      }
    })
  );

  return bots.filter((bot) => bot);
}

module.exports = {
  setWebhook,
  deleteWebhook,
  sendMessage,
  getMe,
  getBots,
  bot,
};

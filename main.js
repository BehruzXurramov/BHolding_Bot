const dotenv = require("dotenv").config();
const express = require("express");
const { bot, users } = require("./bot");
const { sendMessage } = require("./functions");

const BOT_API_TOKEN = process.env.BOT_API_TOKEN;
const WEBHOOK_PATH = `/mybot/${BOT_API_TOKEN}`;
const PORT = process.env.PORT || 3000;
const URL = process.env.APP_URL;

const app = express();
app.use(express.json());

app.get("/test", (req, res) => {
  res.send("Server is running. Test endpoint is working.");
});

app.post("/bot", async (req, res) => {
  try {
    const { id, token } = req.query;

    if (!id || !token) {
      return res.sendStatus(200);
    }

    if (!users.data.hasOwnProperty(id)) {
      return res.sendStatus(200);
    }

    if (!users.data[id].bots.hasOwnProperty(token)) {
      return res.sendStatus(200);
    }

    const message = req.body.message;
    if (message) {
      const chatId = message.chat.id;
      const text =
        users.data[id].bots[token] ||
        `Sorry, this bot is not active at the moment.`;

      const result = await sendMessage(
        token,
        chatId,
        text + "\n\nService provider: @BHolding_Bot"
      );

      if (!result.ok) {
        if (result.code == 401) {
          delete users.data[id].bots[token];
          users.save();
        } else {
          await bot.telegram.sendMessage(
            process.env.ADMIN_ID,
            `Error:\n\n${result.data}`
          );
          console.error(error);
        }
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    bot.telegram.sendMessage(
      process.env.ADMIN_ID,
      `Error:\n\n${error.message}`
    );
    console.error(error);
  }
});

app.use(bot.webhookCallback(WEBHOOK_PATH));

bot.telegram
  .setWebhook(`${URL}${WEBHOOK_PATH}`)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server ${PORT}-portda, webhook URL: ${URL}${WEBHOOK_PATH}`);
    });
  })
  .catch(console.error);

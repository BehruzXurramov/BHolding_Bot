const LJDB = require("ljdb");
const { Markup } = require("telegraf");
const {
  getMe,
  getBots,
  setWebhook,
  deleteWebhook,
  bot,
} = require("./functions");
const { message } = require("telegraf/filters");

//  ===== status ======
// 0 - doing nothing
// 1 - sending bot token
// 2 - adding a message to the bot

const users = new LJDB("users");

function errorHandler(error) {
  bot.telegram.sendMessage(process.env.ADMIN_ID, `Error:\n\n${error.message}`);
  console.error(error);
}

function myBotsButtons(bots) {
  try {
    const lo = bots.length % 2;
    const buttons = [];
    for (let i = 0; i < bots.length - lo; i += 2) {
      buttons.push([
        Markup.button.callback(bots[i].username, `bot_${bots[i].token}`),
        Markup.button.callback(
          bots[i + 1].username,
          `bot_${bots[i + 1].token}`
        ),
      ]);
    }

    if (lo) {
      buttons.push([
        Markup.button.callback(
          bots[bots.length - 1].username,
          `bot_${bots[bots.length - 1].token}`
        ),
      ]);
    }

    return Markup.inlineKeyboard(buttons);
  } catch (error) {
    errorHandler(error);
  }
}

async function myBots(ctx, edit) {
  try {
    const bots = await getBots(users, ctx.from.id);

    if (edit) {
      if (!bots || bots.length === 0) {
        await ctx.editMessageText(
          "ℹ️ You haven’t registered any bots yet. Use /addbot to get started."
        );
      } else {
        await ctx.editMessageText(
          "🔍 Your registered bots:",
          myBotsButtons(bots)
        );
      }
    } else {
      if (!bots || bots.length === 0) {
        await ctx.reply(
          "ℹ️ You haven’t registered any bots yet. Use /addbot to get started."
        );
      } else {
        await ctx.reply("🔍 Your registered bots:", myBotsButtons(bots));
      }
    }
  } catch (error) {
    errorHandler(error);
  }
}

async function checkOwner(ctx, token) {
  try {
    if (!users.data[ctx.from.id].bots.hasOwnProperty(token)) {
      await ctx.answerCbQuery("Sorry, this bot has been deleted.", {
        show_alert: true,
      });
      await myBots(ctx, true);
      return false;
    }

    const result = await getMe(token);
    if (!result.ok) {
      await ctx.answerCbQuery("Sorry, this bot's token is invalid.", {
        show_alert: true,
      });
      delete users.data[ctx.from.id].bots[token];
      users.save();
      await myBots(ctx, true);
      return false;
    }

    return result;
  } catch (error) {
    errorHandler(error);
  }
}

bot.use(async (ctx, next) => {
  try {
    if (!users.data.hasOwnProperty(ctx.from.id)) {
      await ctx.telegram.sendMessage(
        process.env.ADMIN_ID,
        `New user\nUsername: @${ctx.from.username || ""}\nName: ${
          ctx.from.first_name
        } ${ctx.from.last_name || ""}\nLang: ${ctx.from.language_code}`
      );
      users.data[ctx.from.id] = {};
      users.save();
    }
    return next();
  } catch (error) {
    errorHandler(error);
  }
});

bot.start(async (ctx) => {
  try {
    await ctx.reply("Welcome, Now you can fully use this bot.");
  } catch (error) {
    errorHandler(error);
  }
});

bot.help(async (ctx) => {
  try {
    await ctx.reply(
      `<b>Here's how it works!</b>\n\n<b>What can this bot do?</b>\nYou add your bots here by sending their token and assign a custom notification. Then our system sends your chosen notification in response to any message your bot receives. This is useful for one-way bots, selling your bot's username, or indicating when your bot is currently offline. You can remove your bot here at any time.\n<i>We use webhooks when a bot is added, and when you remove your bot, we delete its data and webhook.</i>\n\n<b>Note:</b>\nFormatting (like bold, italic, and links embedded in text) maybe lost in your custom message.However, direct links (URLs) will still be functional.\n\n<b>Commands in detail:</b>\n/addbot - Add a new bot. You need to send your bot's token, then assign a custom notification.\n/mybots - View your bots. Here you can also edit their custom notifications or delete a bot.\n/cancel - Cancel your current action. This can be adding a bot or assigning a custom notification.\n/clear - Clean the chat of extra messages. This deletes all messages in the chat.\n\nPlease contact us if you encounter any issues or have useful feedback or questions.\nDeveloper: @BehruzXurramov`,
      {
        parse_mode: "HTML",
      }
    );
  } catch (error) {
    errorHandler(error);
  }
});

bot.command("addbot", async (ctx) => {
  try {
    await ctx.reply("OK. Send me the bot token.");
    users.data[ctx.from.id].status = "1";
    users.save();
  } catch (error) {
    errorHandler(error);
  }
});

bot.command("mybots", async (ctx) => {
  try {
    await myBots(ctx, false);
  } catch (error) {
    errorHandler(error);
  }
});

bot.command("cancel", async (ctx) => {
  try {
    const status = users.data[ctx.from.id].status;
    if (!status) {
      await ctx.reply("You are not doing anything.");
      return;
    }
    if (status == "1") {
      await ctx.reply("Bot addition canceled");
      users.data[ctx.from.id].status = "0";
      users.save();
    } else if (status.startsWith("2")) {
      await ctx.reply("Adding a message to the bot has been canceled.");
      users.data[ctx.from.id].status = "0";
      users.save();
    } else {
      await ctx.reply("You are not doing anything.");
    }
  } catch (error) {
    errorHandler(error);
  }
});

bot.command("clear", async (ctx) => {
  try {
    const clearId = ctx.message.message_id;
    const startId = users.data[ctx.from.id].clearId || 0;

    for (let i = clearId; i > startId; i--) {
      await ctx.deleteMessage(i).catch((err) => {});
    }
    await ctx.reply("Chat cleared.");

    users.data[ctx.from.id].clearId = clearId;
    users.save();
  } catch (error) {
    errorHandler(error);
  }
});

bot.command("stc", async (ctx) => {
  try {
    if (ctx.from.id == process.env.ADMIN_ID) {
      const userCount = Object.keys(users.data).length;
      const tokenCount = Object.values(users.data).reduce((count, user) => {
        return count + Object.keys(user.bots || {}).length;
      }, 0);

      await ctx.reply(
        `Bot's statistic:\nTotal Users: ${userCount}\nTotal Tokens: ${tokenCount}`
      );
    }
  } catch (error) {
    errorHandler(error);
  }
});

bot.action(/bot_(.+)/, async (ctx) => {
  try {
    const token = ctx.match[1];
    const owner = await checkOwner(ctx, token);
    if (!owner) return;

    await ctx.editMessageText(
      `Bot: @${owner.username}\nMessage: ${
        users.data[ctx.from.id].bots[token] ||
        "Sorry, this bot is not active at the moment."
      }\nWhat do you want to do with the bot?`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback("Edit Message", `editmessage_${token}`),
          Markup.button.callback("Delete Bot", `deletesure_${token}`),
        ],
        [Markup.button.callback("« Back to Bots List", `botslist`)],
      ])
    );
  } catch (error) {
    errorHandler(error);
  }
});

bot.action(/editmessage_(.+)/, async (ctx) => {
  try {
    const token = ctx.match[1];
    const owner = await checkOwner(ctx, token);
    if (!owner) return;
    await ctx.answerCbQuery();
    await ctx.reply(
      `OK. Send me the message you want to set for this bot. Maximum possible character length: 3500.`
    );
    users.data[ctx.from.id].status = `2#${token}`;
    users.save();
  } catch (error) {
    errorHandler(error);
  }
});

bot.action(/deletesure_(.+)/, async (ctx) => {
  try {
    const token = ctx.match[1];
    const owner = await checkOwner(ctx, token);
    if (!owner) return;

    await ctx.editMessageText(
      `Are you sure you want to delete this bot? @${owner.username}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Yes, Delete", `delete_${token}`)],
        [
          Markup.button.callback("« Back to Bot", `bot_${token}`),
          Markup.button.callback("« Back to Bots List", `botslist`),
        ],
      ])
    );
  } catch (error) {
    errorHandler(error);
  }
});

bot.action(/botslist/, async (ctx) => {
  try {
    await myBots(ctx, true);
  } catch (error) {
    errorHandler(error);
  }
});

bot.action(/delete_(.+)/, async (ctx) => {
  try {
    const token = ctx.match[1];
    delete users.data[ctx.from.id].bots[token];
    users.save();
    await deleteWebhook(token);

    await ctx.answerCbQuery("🗑️ Your bot has been deleted from the helper.", {
      show_alert: true,
    });

    await myBots(ctx, true);
  } catch (error) {
    errorHandler(error);
  }
});

bot.on(message("text"), async (ctx) => {
  try {
    const status = users.data[ctx.from.id].status;
    const message = ctx.message.text;
    if (!status) return;
    if (status == "1") {
      const result = await getMe(message);
      if (!result.ok) {
        await ctx.reply(
          "⚠️ The token you provided is invalid. Please check and send again."
        );
        return;
      }

      const webhookUrl = `${process.env.APP_URL}/bot?id=${ctx.from.id}&token=${message}`;
      await setWebhook(message, webhookUrl);

      if (!users.data[ctx.from.id].bots) {
        users.data[ctx.from.id].bots = {};
      }

      users.data[ctx.from.id].bots[message] = "";
      users.data[ctx.from.id].status = `2#${message}`;
      users.save();

      await ctx.reply(
        `✅ Your bot @${result.username} has been registered!\nSend your custom notification message now, or use /cancel to skip. Maximum possible character length: 3500.\n(Default message is: “Sorry, this bot is not active at the moment.”)`
      );
    } else if (status.startsWith("2")) {
      const token = status.split("#")[1];
      const result = await getMe(token);
      if (!result.ok) {
        await ctx.reply(
          "Sorry, the bot token you are trying to add to the message is invalid."
        );
        delete users.data[ctx.from.id].bots[token];
        users.data[ctx.from.id].status = "0";
        users.save();
      } else if (!users.data[ctx.from.id].bots.hasOwnProperty(token)) {
        await ctx.reply(
          "Sorry, the bot you're trying to add a message to has been deleted."
        );
        users.data[ctx.from.id].status = "0";
        users.save();
      } else if (message.length > 3500) {
        await ctx.reply(
          `The number of characters in this message (${message.length}) is too long. Maximum possible character length: 3500. Please shorten it and try sending it again:`
        );
      } else {
        users.data[ctx.from.id].bots[token] = message;
        await ctx.reply(
          `✅ Your notification message for @${result.username} has been saved.`
        );
        users.data[ctx.from.id].status = "0";
        users.save();
      }
    }
  } catch (error) {
    errorHandler(error);
  }
});

module.exports = {
  bot,
  users,
};

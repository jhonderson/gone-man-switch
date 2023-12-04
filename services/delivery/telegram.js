const querystring = require("querystring");

const sendMessage = async ({ botToken }, { chatId: chat_id, text, parseMode: parse_mode }) => {
  if (!botToken) {
    throw new Error("Can't send Telegram message because bot-token is missing");
  }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage?${
    querystring.stringify({
      chat_id,
      text,
      parse_mode,
    })
  }`);
  return res.status == 200;
}

module.exports = {
  sendMessage
}

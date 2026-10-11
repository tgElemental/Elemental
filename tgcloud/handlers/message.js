// Telegram Serverless: /start and /help; real game state is Cloudflare D1.
// Register the same GitHub Pages Mini App URL in BotFather's Menu Button.
import { api } from 'sdk';
const GAME_URL='https://tgelemental.github.io/Elemental/';
export default async function (message) {
  if (message?.chat?.type !== 'private' || !message?.from?.id) return;
  const text=String(message.text||'').trim();
  const cmd=text.startsWith('/')?text.split(/[@\s]/,1)[0]:'';
  if(cmd==='/start'||cmd==='/game'||cmd==='/help') {
    await api.sendMessage({
      chat_id:message.chat.id,
      text:cmd==='/help'
        ?'چهار عنصر را به میدان بفرست؛ برد ۳ امتیاز و مساوی ۱ امتیاز دارد. آب+خاک درخت می‌سازد و آتش+باد نور. روزی ۲۰ عنصر رایگان دریافت می‌کنی.'
        :'چرخهٔ جهان دوباره بیدار شده است. چهار عنصر را به حرکت درآور و تعادل را برگردان.',
      reply_markup:{inline_keyboard:[[
        {text:'ورود به جهان عناصر',web_app:{url:GAME_URL}}
      ]]}
    });
  }
}

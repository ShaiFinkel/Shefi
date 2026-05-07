import "./lib/env.js";
import { bot } from "./bot/telegram.js";
import { startScheduler } from "./scheduler/digests.js";

async function main() {
  console.log("Shefi & Co. עולה לאוויר…");
  startScheduler(bot);

  bot.start({
    onStart: (info) => {
      console.log(`✓ הבוט פעיל בשם @${info.username}`);
    },
  });

  const shutdown = async () => {
    console.log("\nכיבוי…");
    await bot.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("כשל בהפעלה:", err);
  process.exit(1);
});

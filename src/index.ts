import "./lib/env.js";
import { bot } from "./bot/telegram.js";
import { startScheduler } from "./scheduler/digests.js";
import { startServer } from "./server/http.js";
import { eventBus } from "./server/events.js";

async function main() {
  console.log("Shefi & Co. עולה לאוויר…");

  startScheduler(bot);

  await startServer(3000);

  bot.start({
    onStart: (info) => {
      console.log(`✓ הבוט פעיל בשם @${info.username}`);
      eventBus.emitEvent({
        agent: "system",
        kind: "system",
        content: `Shefi & Co. עלתה לאוויר. הבוט @${info.username} פעיל.`,
      });
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

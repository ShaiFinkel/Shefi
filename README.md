# Shefi & Co. — חברת הסוכנים שלך

> **את ה־CEO. סוכני ה־AI שלך עושים את העבודה.**

מערכת אישית של סוכני AI שמתקשרים איתך דרך הטלגרם ומבטיחים ששום משימה, רעיון או בקשה לא נופלים בין הכיסאות.

## הצוות

| סוכן | תפקיד | מתמחה ב־ |
|------|-------|----------|
| **שפי** | Chief of Staff | מקבלת כל הודעה ומעבירה ליד הנכונה |
| **טובה** | מנהלת משימות | קליטה, תעדוף, סגירה, רשימות |
| **מירה** | מזכירה | דייג'סט בוקר/ערב + תזכורות מתוזמנות |
| **איה** | ארכיונאית | זיכרון סמנטי — "מה אמרתי על...?" |

## איך מתחילים

### 1. דרישות
- Node.js 20 או חדש יותר
- Token של בוט טלגרם מ־[@BotFather](https://t.me/BotFather)
- ה־user id שלך בטלגרם מ־[@userinfobot](https://t.me/userinfobot)
- מפתח OpenAI מ־[platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### 2. התקנה

```bash
cp .env.example .env
# מלאי את הערכים ב־.env (TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USER_IDS, OPENAI_API_KEY)
npm install
npm run db:init     # מאתחל את ה־SQLite (פעם ראשונה)
npm start           # מפעיל את הבוט
```

### 3. שימוש בטלגרם

- **הודעת טקסט** — כל דבר שעולה לראש. שפי תחליט מה לעשות איתו.
- **הודעה קולית** — תתומלל אוטומטית ותעבור אותו pipeline.
- **`/today`** — מה פתוח להיום.
- **`/open`** — כל הפריטים הפתוחים.
- **`/done <id>`** — סגירת משימה לפי id.

### 4. דייג'סטים אוטומטיים

- **08:00 כל בוקר** — מירה שולחת דייג'סט בוקר (מה היום, מה באיחור).
- **18:00 כל ערב** — סיכום יום (מה סגרת, מה נשאר).
- **תזכורות** — בודק כל דקה. אם ביקשת תזכורת — תקבלי הודעה בזמן.

## מבנה הפרויקט

```
src/
├── index.ts                 הפעלה: bot + scheduler
├── bot/
│   ├── telegram.ts          grammy: הודעות, פקודות, allowlist
│   └── voice.ts             הורדת voice + Whisper
├── agents/
│   ├── shefi.ts             Chief of Staff (orchestrator + handoffs)
│   ├── tova.ts              Task Manager
│   ├── mira.ts              Secretary
│   ├── aya.ts               Archivist
│   └── tools.ts             כל הכלים שהסוכנים יכולים לקרוא
├── db/
│   ├── schema.ts            items, reminders, memories
│   ├── client.ts            wrapper מעל better-sqlite3
│   └── init.ts              `npm run db:init`
├── scheduler/
│   └── digests.ts           cron: דייג'סטים + תזכורות
└── lib/
    ├── env.ts               טעינה ובדיקת .env
    └── llm.ts               OpenAI client + embeddings
```

## פרטיות

הכל מקומי. ה־DB יושב ב־`./data/shefi.db` במחשב שלך. רק הקריאות ל־OpenAI יוצאות החוצה (לטריאז'/תמלול/embeddings). אין שירות צד־שלישי נוסף.

## דרכים להמשיך

- **Phase 5** — סוכנים מתמחים: אירועים (ימי הולדת, חגים), ספקים (חוזים, חשבוניות), רווחה (מתנות, הטבות).
- **Airtable sync** — אם תרצי תצוגה ויזואלית של ה־DB.
- **WhatsApp** — תמיכה במקביל לטלגרם.

הקוד הישן מ־v0 שמור ב־`archive/`.

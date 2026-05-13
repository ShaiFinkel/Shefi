# הפיכת Shefi & Co. לציבורית (PWA אמיתית)

המטרה: שעובדים יוכלו להיכנס ל־`https://shefi.team/me` מהנייד שלהם, להוסיף למסך הבית, ולקבל מייל magic link אמיתי.

יש 4 שלבים. סה"כ זמן: **~25 דקות**, עלות: **$22 לשנה**.

---

## שלב 1: רישום חשבון Resend (חינם, 2 דק')

Resend שולח את מיילי ה־magic-link. החשבון החינמי נותן 3,000 מיילים בחודש — יותר ממה שתצטרכי.

1. היכנסי ל־<https://resend.com/signup>
2. הירשמי עם המייל הארגוני שלך
3. אחרי אימות מייל, היכנסי ל־<https://resend.com/api-keys>
4. לחצי "Create API Key" → תני שם "Shefi Production" → Permission: "Sending access" → Create
5. **העתיקי את ה־key** (יוצג רק פעם אחת!)

הוסיפי לקובץ `.env`:
```bash
RESEND_API_KEY=re_xxxxxxxxxxxx
```

> 💡 **בלי לאמת דומיין** המיילים יישלחו מ־`onboarding@resend.dev` (יעבוד לבדיקות, אבל ייראה חצי־ספאם). כדי לשלוח מ־`hello@shefi.team` — תצטרכי להוסיף לדומיין שלך 4 רשומות DNS שRendsend מספק (אחרי שלב 3).

---

## שלב 2: רישום חשבון Cloudflare (חינם, 3 דק')

Cloudflare ייתן HTTPS, יחבר את הדומיין למק שלך, וגם יבצע את רישום הדומיין.

1. <https://dash.cloudflare.com/sign-up>
2. הירשמי עם המייל
3. אמת את המייל

---

## שלב 3: קניית הדומיין ב־Cloudflare Registrar (5 דק', $22/שנה)

1. בדשבורד Cloudflare → שמאל למעלה → **Domain Registration → Register Domains**
2. חפשי **`shefi.team`** → הוסיפי לעגלה → קניית דומיין
3. בדף התשלום:
   - שם, כתובת, טלפון אמיתיים (חובה לפי ICANN)
   - סמני "Privacy Protection" (חינם, מסתיר את הפרטים האישיים שלך מ־WHOIS)
4. שלמי בכרטיס אשראי
5. הדומיין יהיה מוכן בתוך 1–5 דקות

> 💡 Cloudflare Registrar מוכר במחיר עלות (לא מוסיף רווח), אז זה הזול ביותר ברשת.

---

## שלב 4: התקנת Cloudflare Tunnel על המק (10 דק')

הצינור הזה מחבר את ה־`localhost:3000` שלך לאינטרנט עם HTTPS אוטומטי, בלי לפתוח פורטים בראוטר.

### 4.1 התקנת cloudflared

```bash
brew install cloudflared
```

(אם אין לך Homebrew: <https://brew.sh>)

### 4.2 התחברות לחשבון

```bash
cloudflared tunnel login
```

יפתח דפדפן, בחרי את הדומיין `shefi.team` ותאשרי.

### 4.3 יצירת tunnel

```bash
cloudflared tunnel create shefi
```

הפקודה תדפיס משהו כמו:
```
Created tunnel shefi with id 12345678-abcd-...
Created file: /Users/shaifinkelstein/.cloudflared/12345678-abcd-...json
```
שמרי את ה־UUID לרגע.

### 4.4 הצמדת הדומיין ל־tunnel

```bash
cloudflared tunnel route dns shefi shefi.team
```

(זה יוצר רשומת CNAME אוטומטית בדומיין שלך.)

### 4.5 קונפיג קובץ

צרי `~/.cloudflared/config.yml`:
```yaml
tunnel: 12345678-abcd-...    # ← ה-UUID משלב 4.3
credentials-file: /Users/shaifinkelstein/.cloudflared/12345678-abcd-...json

ingress:
  - hostname: shefi.team
    service: http://localhost:3000
  - service: http_status:404
```

### 4.6 הרצה כשירות מתמיד

```bash
sudo cloudflared service install
```

עכשיו ה־tunnel ירוץ אוטומטית ברקע, גם אחרי restart של המק.

לבדיקה:
```bash
sudo launchctl print system/com.cloudflare.cloudflared
```

### 4.7 עדכון ה־.env

```bash
APP_PUBLIC_URL=https://shefi.team
```

הפעילי מחדש את שפי:
```bash
lsof -ti:3000 | xargs kill
node dist/index.js
```

---

## שלב 5 (אופציונלי): שליחת מיילים מ־@shefi.team

אם תרצי שמיילי ה־magic link יישלחו מ־`hello@shefi.team` (במקום `onboarding@resend.dev`):

1. ב־Resend dashboard → Domains → Add Domain → `shefi.team`
2. Resend ייתן 4 רשומות DNS להוסיף ל־Cloudflare:
   - SPF (TXT)
   - DKIM (CNAME × 3)
3. ב־Cloudflare → DNS → Records → הוסיפי כל אחת מהרשומות בדיוק כפי שנתנו
4. חזרי ל־Resend → Verify
5. עדכון `.env`:
```bash
RESEND_FROM_EMAIL=Shefi & Co. <hello@shefi.team>
```

---

## שלב 6: הגנת admin על הדשבורד (מומלץ)

עכשיו שהדומיין ציבורי, את לא רוצה שמישהו אקראי יגלה את `https://shefi.team/` ויראה את הדשבורד שלך.

### 6.1 צרי טוקן אקראי

```bash
openssl rand -base64 32
```

### 6.2 הוסיפי ל־`.env`

```bash
ADMIN_TOKEN=<הטוקן>
```

הפעילי מחדש את השרת.

### 6.3 הוסיפי לדפדפן הניהולי שלך

ב־<https://shefi.team> פתחי DevTools → Console → הקלידי:
```javascript
localStorage.setItem("shefi_admin_token", "<הטוקן>");
location.reload();
```

(תצטרכי לעשות את זה פעם אחת בכל מכשיר שאת רוצה לגשת ממנו.)

מעכשיו, כל ניסיון להגיע ל־`/api/...` בלי הטוקן יקבל **401**. הפורטל לעובדים (`/me`) ימשיך לעבוד רגיל.

---

## שלב 7: שליחת לינק לעובדים

צרי הודעת וואטסאפ קבועה:

> **היי [שם],**
>
> פתחנו פורטל אישי לכל מה שקשור לציוד ורווחה — בקשות ציוד, היסטוריה, ובקרוב גם תזכורות.
>
> 🔗 **כנסי כאן:** <https://shefi.team/me>
>
> ⚙️ **באייפון:** אחרי שתיכנסי, לחצי על כפתור השיתוף (⎙) ובחרי "הוסף למסך הבית" — זה יעשה לך אייקון אמיתי באפליקציות.
>
> 📩 **הכניסה דרך המייל הארגוני** — כל פעם שתצטרכי להיכנס מחדש, נשלח לך לינק חד־פעמי במייל.

---

## פתרון בעיות נפוצות

### "המייל לא הגיע"
- בדקי בספאם
- וודאי שהמייל בעברית/אנגלית של העובד מוגדר ב־`employees.email` בדיוק
- בדקי את הלוגים: `tail -f /tmp/shefi-bot.log` — תראי `📧 [EMAIL — dev mode]` אם RESEND_API_KEY ריק

### "התעודה לא בתוקף" כש־cloudflared חדש
- חכי 1–2 דק' אחרי שיצרת את ה־tunnel — Cloudflare מנפיק תעודה אוטומטית
- אם זה לא עובד, רצי `cloudflared tunnel cleanup shefi` ואז שלב 4.3 שוב

### עובד מקבל 401 כל פעם שהוא נכנס
- ה־cookie לא נשמר. וודאי ש־`APP_PUBLIC_URL` ב־`.env` מתחיל ב־`https://`
- ב־Safari ב־iOS, אם ה־PWA הותקנה כבר, יציאה והתקנה מחדש מנקה cookies — לא נורא, יקבל מייל חדש

---

## עלות חודשית סופית

| שירות | עלות |
|---|---|
| Cloudflare Tunnel | **$0** (חינם תמיד) |
| Cloudflare Registrar | **$22 לשנה** = $1.83/חודש |
| Resend (3K מיילים) | **$0** (יותר ממה שתצטרכי) |
| **סה"כ** | **~$2/חודש** |

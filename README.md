# Cover Generator — Solid Insights

מחולל קאברים אוטומטי בסגנון ליינוקאט.

## הגדרה מקומית

```bash
npm install
cp .env.local.example .env.local
# הכנס את ה-FAL_KEY שלך ב-.env.local
npm run dev
```

פתח http://localhost:3000

## Deploy ל-Vercel

1. דחף את הקוד ל-GitHub
2. ב-Vercel: Import repository
3. ב-Environment Variables הוסף: `FAL_KEY = your_key`
4. Deploy

## API Key

הירשם ב-[fal.ai](https://fal.ai) → Dashboard → API Keys → Create Key

## שימוש

1. העלה תמונה של אדם
2. כתוב כותרת H1 בערבית
3. כתוב טקסט לריבון
4. לחץ "צור קאבר"
5. הורד PNG ב-1080×1920

## מודל

משתמש ב-`fal-ai/flux/dev/image-to-image` לייצור הליינוקאט.
זמן עיבוד: 30-60 שניות.

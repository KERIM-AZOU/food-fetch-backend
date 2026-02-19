# Backend API Changes

## 1. Search now supports regions

`POST /api/search` has a new `region` field.

```json
// Qatar (default, no changes needed)
{ "term": "pizza" }

// Turkey
{ "term": "pizza", "region": "turkey" }
```

Available regions: `qatar` (snoonu, rafeeq, talabat), `turkey` (tgoyemek)

Each region has default lat/lon. You can still override with `lat` and `lon`.

## 2. Search returns spoken summary + optional TTS

Send `language` and `generateAudio: true` to get a spoken result announcement.

```json
{
  "term": "pizza",
  "region": "qatar",
  "language": "ar",
  "generateAudio": true
}
```

Response now includes:
```json
{
  "products": [...],
  "pagination": {...},
  "region": "qatar",
  "summary": "لقيت بيتزا بسعر 5 من Talabat، عندي 45 نتيجة من Snoonu, Talabat",
  "audio": { "data": "<base64>", "contentType": "audio/mpeg" }
}
```

- `summary` — always present, text to display or speak
- `audio` — only present when `generateAudio: true`, base64 audio from ElevenLabs

## 3. Chat no longer talks when food is found

When the user mentions food, the chat response is now:
```json
{
  "response": "",
  "foodMentioned": true,
  "foodItems": ["pizza"],
  "shouldSearch": true
}
```

`response` is empty when `shouldSearch: true`. **Do not play TTS for empty responses.**

## 4. New flow for audio chat + food search

```
1. User speaks → POST /api/chat/audio
2. Get response:
   - shouldSearch: false → play response audio as before
   - shouldSearch: true  → response is "", don't play anything
3. If shouldSearch: true → POST /api/search with:
   - term: foodItems[0]
   - region: current region
   - language: detected language from chat response
   - generateAudio: true
4. Play the search audio (summary announcement)
```

## 5. Greeting is always Arabic

`POST /api/chat/start` now always returns an Arabic greeting regardless of `language` param.

## 6. Chat provider is swappable

Backend now supports swapping between Groq and OpenAI for chat (like TTS and transcription). No frontend changes needed.

## 7. Turkey region — what the frontend needs to handle

Turkey uses **tgoyemek** as its platform. The search response is the same format as Qatar (products, not restaurants), so **no special rendering needed**.

Key differences when `region: "turkey"`:

- **Prices are in TL (Turkish Lira)**, not QAR. Display currency accordingly.
- **ETA format is Turkish**: e.g. `"30-40dk"` instead of `"30 mins"`.
- **Product URLs** point to `tgoyemek.com`: e.g. `https://tgoyemek.com/restoranlar/1624#pizza`
- **Source** field is `"tgoyemek"` instead of `"Snoonu"` / `"Talabat"` / `"Rafeeq"`.
- **`platforms` param is removed** — backend always uses the region's platforms automatically.

Example request:
```json
{
  "term": "pizza",
  "region": "turkey",
  "language": "tr",
  "generateAudio": true
}
```

Example product in response:
```json
{
  "product_name": "Orta Boy Pizza Fırsatı",
  "product_price": 450,
  "product_image": "https://cdn.tgoapps.com/...",
  "product_url": "https://tgoyemek.com/restoranlar/1624#trendyol-ozel-menu",
  "restaurant_name": "PizzaLazza (Mecidiyeköy)",
  "restaurant_eta": "30-40dk",
  "source": "tgoyemek"
}
```

### Frontend checklist for Turkey support:
- [ ] Add region selector (Qatar / Turkey)
- [ ] Pass `region: "turkey"` in search requests when Turkey is selected
- [ ] Show TL currency symbol for Turkey products
- [ ] Handle Turkish ETA format (`dk` = dakika = minutes)
- [ ] No need to handle `platforms` param anymore — removed from API

# PlaneProxy ✈️

Telegram proxy server waarmee je Claude AI kunt gebruiken en websites kunt ophalen — perfect voor in het vliegtuig waar alleen messaging-apps werken (bijv. Air France WiFi).

## Wat doet het?

- **Claude AI via Telegram** — Stel vragen, krijg antwoorden, voer gesprekken
- **Websites ophalen** — Haal de tekstinhoud van elke website op via `/fetch`
- **Samenvatten** — Laat Claude een website samenvatten via `/summarize`
- **Gespreksgeheugen** — Onthoudt context tot 20 berichten

## Setup

### 1. Telegram Bot aanmaken

1. Open Telegram en zoek `@BotFather`
2. Stuur `/newbot` en volg de instructies
3. Kopieer de bot token

### 2. Anthropic API Key

1. Ga naar [console.anthropic.com](https://console.anthropic.com)
2. Maak een API key aan

### 3. Configuratie

```bash
cp .env.example .env
```

Vul je tokens in in `.env`:

```
TELEGRAM_BOT_TOKEN=je_telegram_bot_token
ANTHROPIC_API_KEY=je_anthropic_api_key
ALLOWED_USERS=je_telegram_user_id    # optioneel, voor beveiliging
```

> Tip: Stuur `/myid` naar de bot om je Telegram user ID te vinden.

### 4. Installeren & Starten

```bash
npm install
npm start
```

## Commando's

| Commando | Beschrijving |
|----------|-------------|
| `/start` | Welkomstbericht |
| `/fetch URL` | Haal website-inhoud op als tekst |
| `/summarize URL` | Haal website op + laat Claude samenvatten |
| `/clear` | Wis gespreksgeschiedenis |
| `/myid` | Toon je Telegram user ID |
| *(gewoon bericht)* | Stel een vraag aan Claude |

## Hosting

Deploy op een server die altijd draait (bijv. een VPS, Railway, Fly.io) zodat de bot beschikbaar is wanneer je in het vliegtuig zit.

```bash
# Met pm2 (aanbevolen voor VPS)
npm install -g pm2
pm2 start src/index.js --name planeproxy
pm2 save
```

## Beveiliging

Stel `ALLOWED_USERS` in met je Telegram user ID om te voorkomen dat anderen je bot (en API credits) gebruiken.

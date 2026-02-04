# QuizAppHtml — Enterprise Run Guide

This project ships a small static frontend and a lightweight API endpoint to serve question data. The included `server.js` is an Express-based production-friendly server with security, compression, rate-limiting, and optional API key protection.

Quick start

1. Install dependencies

```bash
cd "D:\\Work Folder\\Projects\\QuizAppHtml"
npm install
```

2. Optional environment variables

- `PORT` — server port (default `3000`).
- `API_KEY` — optional API key. If set, clients must send `x-api-key` header.
- `ALLOWED_ORIGIN` — CORS allowed origin (default `*`). Set to your frontend origin in production.

Create a `.env` file in the project root if needed:

```
PORT=3000
API_KEY=
ALLOWED_ORIGIN=http://your.company.domain
```

3. Run

```bash
npm start
```

Open: `http://localhost:3000` (serves `html/quiz_assessment.html`).

Notes for enterprise deployment

- Use HTTPS and configure a reverse-proxy (NGINX, Azure App Service, AWS ALB) in front of the Node process.
- Set `ALLOWED_ORIGIN` to your exact frontend origin to avoid open CORS.
- Provide `API_KEY` and ensure clients send `x-api-key` header when needed.
- Enable logging/monitoring and run the process under a process manager (PM2, systemd).
- Consider placing `questions.json` in a secured database or S3 and the server reading it from there.

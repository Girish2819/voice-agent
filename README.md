# Institute Super 30 Website

Full-stack website built with React frontend and Node.js backend.

## Features

- Institute landing page for IIT-JEE and NEET preparation
- Inquiry section with floating round phone icon
- Voice question flow:
  - Capture voice question from browser microphone
  - Convert voice to text using browser speech recognition (free)
  - Search best matching institute knowledge in backend
  - Generate final answer using Gemini API (or local fallback if key missing)
  - Convert answer text back to voice using browser speech synthesis (free)

## Tech Stack

- Frontend: React + Vite + TypeScript
- Backend: Node.js + Express
- AI/NLP: Gemini API + `natural` (intent + FAQ search) + browser Web Speech APIs

## Run Project

### 1) Backend setup

```bash
cd backend
npm install
npm run dev
```

Create `backend/.env` and add:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
```

### 2) Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and backend on `http://localhost:5000`.

## Important

- Allow microphone permission in browser.
- Use Chrome/Edge for best speech recognition support.
- Gemini key is optional but recommended for better answers.
- Without Gemini key, app uses local fallback responses.

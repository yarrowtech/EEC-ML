# Frontend (React + Vite)

## Setup

1. Create env file:
   - Copy `.env.example` to `.env`
2. Set backend URL:
   - `VITE_API_URL=http://localhost:5000` is used for production builds. During
     `npm run dev`, Vite automatically uses the browser's current origin and
     proxies `/api` and `/socket.io` to `127.0.0.1:5000`, so another device on
     the same Wi-Fi can open `http://<computer-lan-ip>:5173` without changing
     this value.

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Preview Build

```bash
npm run preview
```

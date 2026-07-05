# AutoSolutions Operations Console

Premium frontend for the AutoSolutions real-estate voice assistant system.

## Stack
- Vite + React + TypeScript
- Tailwind CSS v4
- Lucide Icons
- Axios
- React Router

## Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Copy `.env.example` to `.env` and set your backend URL.
   ```bash
   VITE_API_BASE_URL=http://localhost:8000
   ```

3. **Run Dev Server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`.

## Features
- **Overview**: Real-time stats and system health.
- **Call Logs**: Detailed history with transcript viewer/downloader.
- **Contacts**: CRM view of discovered customers.
- **Site Visits**: Full lifecycle management for property visit bookings.
- **Knowledge Base**: Website crawling, PDF uploading, and search testing.
- **Outbound**: Single and bulk call dispatching.
- **Configuration**: Advanced settings management for the Gemini runtime.

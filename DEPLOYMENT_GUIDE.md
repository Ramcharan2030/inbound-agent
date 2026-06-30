# 🚀 Full-Stack Deployment Guide (Budget: ~500-600 INR / $6-$7 USD)

Deploying this AI Voice Agent project requires two separate hosting environments: one for the **Frontend** (React/Vite) and one for the **Backend** (Python, FastAPI, LiveKit).

To stay within your 500-600 INR monthly budget while maintaining excellent performance for real-time audio, here is the recommended architecture:

---

## 1. Frontend Deployment: Vercel (Cost: FREE / $0)

Vercel is the industry standard for deploying React/Vite frontends. It is incredibly fast, offers a global CDN, and is completely free for standard usage.

**Steps to deploy:**
1. Push your entire project to a free GitHub repository.
2. Go to [Vercel.com](https://vercel.com/) and sign up with your GitHub account.
3. Click **Add New Project** and select your GitHub repository.
4. **Important Configuration:**
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. In the **Environment Variables** section on Vercel, add your backend API URL (once you deploy the backend in step 2). Usually, this looks like `VITE_API_URL=https://your-backend-url.com`.
6. Click **Deploy**. Vercel will give you a free `your-app.vercel.app` domain with SSL automatically set up.

---

## 2. Backend Deployment: DigitalOcean Droplet / Hetzner (Cost: ~$6/month)

Because this backend handles real-time audio (LiveKit, Text-to-Speech, Speech-to-Text), it requires steady CPU access. "Platform-as-a-Service" options like Render or Heroku often throttle CPU on their cheap tiers, which causes voice stuttering ("trucking and braking"). 

A dedicated VPS (Virtual Private Server) like a **DigitalOcean Basic Droplet** or **Hetzner Cloud** is the best choice.

**Steps to deploy:**
1. **Create a Server:** Sign up for [DigitalOcean](https://www.digitalocean.com/) and create a "Droplet". Choose Ubuntu 24.04 and the **$6/month Regular Intel/AMD** tier.
2. **Connect via SSH:**
   ```bash
   ssh root@your_server_ip
   ```
3. **Install Docker on the server:**
   ```bash
   apt update
   apt install docker.io docker-compose-v2 git -y
   ```
4. **Clone your code:**
   ```bash
   git clone https://github.com/yourusername/your-repo.git
   cd your-repo
   ```
5. **Setup your environment variables:**
   Create the `.env` file on the server and add your LiveKit, Supabase, and Google API keys.
   ```bash
   nano .env
   # Paste your keys here, then press Ctrl+X, Y, Enter to save.
   ```
6. **Run the Backend using the provided Dockerfile:**
   Because your project already has a perfect `Dockerfile` and `supervisord.conf` setup, you can just build and run it directly!
   ```bash
   docker build -t voice-agent-backend .
   docker run -d --name voice-agent --env-file .env -p 8000:8000 -p 8081:8081 voice-agent-backend
   ```
7. **(Optional but Recommended) Setup a Domain and SSL:** You can use Cloudflare (Free) to point a domain to your DigitalOcean IP address and handle HTTPS/SSL for your API.

---

### Alternative Backend (Easiest but slightly higher risk of voice stuttering): Render.com
If you do not want to deal with Linux terminals, you can use [Render.com](https://render.com/).
- Choose **Web Service**.
- Select your GitHub repo.
- Environment: Docker.
- Tier: **Starter ($7/month)** (Avoid the free tier, it sleeps after 15 mins).
- Add your environment variables in the Render dashboard.

### Summary of Costs
- **Frontend (Vercel):** ₹0
- **Backend (DigitalOcean):** ~₹500 ($6)
- **Total Monthly Cost:** ~₹500 ($6) per month! This is a perfect "Free Premium" feeling setup.

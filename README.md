# Edge Landings 🌐

> **Professional websites for local businesses. Built in 24 hours. $0 upfront. Pay only after you approve it.**

Edge Landings is a subscription-based website-building service for local businesses. We create conversion-ready websites with transparent pricing, hosting, SSL, security updates, and ongoing support — all included in one monthly subscription.

**Created by Brice Leasure**

---

## 📋 Table of Contents

| | |
|---|---|
| [✨ Features](#-features) | [🔌 API Endpoints](#-api-endpoints) |
| [💎 Pricing Tiers](#-pricing-tiers) | [🔐 Environment Variables](#-environment-variables) |
| [🛠 Tech Stack](#-tech-stack) | [🗄️ Database Setup](#-database-setup) |
| [📁 Project Structure](#-project-structure) | [💳 Stripe Integration](#-stripe-integration) |
| [🚀 Getting Started](#-getting-started) | [🎨 Demo Sites](#-demo-sites) |
| [🌐 Deployment](#-deployment) | [📚 Documentation](#-documentation) |

---

## ✨ Features

| Feature | Description |
|---|---|
| ⚡ **24-Hour Delivery** | Professional websites built and delivered in 24 hours |
| 💰 **$0 Upfront** | Clients only pay after they approve their site |
| 🎨 **Industry Templates** | Roofing, HVAC, Plumbing, Bakery, Barber, Realtor, and more |
| 📱 **Mobile-Responsive** | All sites optimized for every device |
| 🔒 **Hosting & SSL** | Included with every subscription |
| 🛡️ **Security Updates** | Ongoing maintenance handled automatically |
| 📈 **SEO-Optimized** | Pro and Elite tiers include search engine optimization |
| 🔄 **Cancel Anytime** | No long-term contracts required |

---

## 💎 Pricing Tiers

| Plan | Price | Best For |
|---|---|---|
| **Basic Website** | $99/mo | Small businesses needing a simple online presence |
| **Pro Website** | $179/mo | Growing businesses wanting more features & visibility |
| **Leads Only** | $179/mo | Contractors wanting a steady stream of local job leads |
| **Combo: Pro + Leads** | $249/mo | Maximum growth — save $109/mo vs. buying separately |

### Basic Website — $99/month
- 1-page professional website
- Contact form + Google Maps integration
- Mobile-friendly responsive design
- 2 revisions in first month only
- Hosting & basic security updates

### Pro Website — $179/month
- Up to 5 pages
- SEO-optimized (title, meta, headings)
- Google reviews widget
- Unlimited small revisions
- 1 content update per month
- Faster support

### Leads Only — $179/month
- Unlimited fresh permit leads (roofing, HVAC, plumbing, electrical)
- Free 1-page website with contact form + Google Maps
- Mobile-friendly design
- Cancel anytime

### Combo: Pro Website + Leads — $249/month
- Everything in Pro Website
- Unlimited contractor leads
- Priority support

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Static HTML/CSS/JS with Tailwind CSS + React components |
| **Backend** | Node.js with Express (`server.js`) |
| **Hosting** | Vercel (serverless functions + static hosting) |
| **Payments** | Stripe (subscriptions, checkout, billing portal, webhooks) |
| **Database** | Supabase (PostgreSQL) with Vercel KV fallback + in-memory fallback |
| **AI** | Anthropic Claude API (`@anthropic-ai/sdk`) |
| **Email** | Resend API (welcome emails, password resets) |
| **Scheduling** | Calendly integration (embedded widget) |

---

## 📁 Project Structure

```
Edge-landings/
├── server.js                 # Express server: routes, Stripe, dashboard, AI, webhooks
├── package.json              # Project config and dependencies
├── vercel.json               # Vercel deployment configuration
├── README.md                 # This file
│
├── api/                      # Vercel serverless functions
│   ├── signup.js             # User registration + email notifications
│   ├── login.js              # Email-based authentication
│   ├── dashboard.js          # User dashboard data
│   ├── forgot-password.js    # Password reset request
│   ├── reset-password.js     # Password reset execution
│   └── users.js              # User storage module (Supabase + fallback)
│
├── index.html                # Main marketing landing page
├── pricing.html              # Pricing tiers page
├── signup.html               # Account creation
├── login.html                # Login page
├── dashboard.html            # User dashboard
├── success.html              # Post-payment success
├── cancel.html               # Payment cancellation
├── forgot-password.html      # Password recovery
├── reset-password.html       # Password reset form
│
├── public/                   # Additional static pages
│   ├── index.html
│   ├── pricing.html
│   ├── signup.html
│   ├── bakery-pro.html
│   ├── realtor-pro.html
│   └── lawyer-template/      # Multi-page lawyer template
│
├── Demo Sites                # Industry-specific landing page demos
│   ├── bakery-basic.html     # Basic tier demo
│   ├── bakery-pro.html       # Pro tier demo
│   ├── barber-demo.html
│   ├── coffee-demo.html
│   ├── doctor-demo.html
│   ├── fitness-demo.html
│   ├── auto-demo.html
│   ├── tattoo-demo.html
│   └── realtor-pro.html
│
├── src/                      # React source files
│   ├── App.js                # React application component
│   └── index.js              # React entry point
│
├── build/                    # React build output
├── static/                   # Static JS bundles
│
├── create-tables.sql         # Database schema (Supabase)
└── docs/
    └── seo-conversion-plan.md # SEO checklist and optimization tasks
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- Stripe account configured
- Supabase project created (or use Vercel KV/in-memory)
- Anthropic API key (for AI features)
- Resend API key (for email features)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd Edge-landings
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the root directory with the required variables (see [Environment Variables](#environment-variables))

4. **Run database migrations:**
   Execute `create-tables.sql` in your Supabase project to create required tables.

5. **Start the development server:**
   ```bash
   npm run dev
   ```
   
   The server will start at `http://localhost:3000` (or your configured port).

---

## 🌐 Deployment

### Deploy to Vercel

1. **Push your code to GitHub**

2. **Import your repository in Vercel**

3. **Configure environment variables** in Vercel dashboard

4. **Deploy:**
   ```bash
   vercel
   ```

See detailed setup guides:
- [COMPLETE_SETUP.md](./COMPLETE_SETUP.md)
- [DATABASE_SETUP.md](./DATABASE_SETUP.md)
- [STRIPE_SETUP.md](./STRIPE_SETUP.md)
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
- [EMAIL_SETUP.md](./EMAIL_SETUP.md)
- [VERCEL_CONFIG.md](./VERCEL_CONFIG.md)

---

## 🔌 API Endpoints

### Server Routes (`server.js`)

| Route | Method | Description |
|---|---|---|
| `/` | GET | Main landing page |
| `/pricing.html` | GET | Pricing tiers page |
| `/create-checkout-session` | POST | Create Stripe checkout session |
| `/create-portal-session` | POST | Create Stripe billing portal session |
| `/api/login` | POST | User authentication |
| `/api/dashboard` | POST | User dashboard data |
| `/api/claude` | POST | Claude AI proxy endpoint |
| `/api/test` | GET | Health check |
| `/webhook` | POST | Stripe webhook handler |

### Serverless Functions (`api/`)

| Endpoint | Description |
|---|---|
| `/api/signup` | Create user account + send welcome emails |
| `/api/login` | Authenticate user credentials |
| `/api/dashboard` | Fetch user subscription data |
| `/api/forgot-password` | Request password reset |
| `/api/reset-password` | Execute password reset |

---

## 🔐 Environment Variables

Create a `.env` file with these variables:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_key_here
STRIPE_PRICE_BASIC=price_id_basic
STRIPE_PRICE_PRO=price_id_pro
STRIPE_PRICE_LEADS=price_id_leads
STRIPE_PRICE_COMBO=price_id_combo

# Supabase Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_service_role_key

# OR Vercel KV (alternative to Supabase)
KV_REST_API_URL=your_kv_url
KV_REST_API_TOKEN=your_kv_token

# Anthropic AI
ANTHROPIC_API_KEY=sk-ant-your_key

# Email (Resend)
RESEND_API_KEY=re_your_key

# Frontend URL
VERCEL_URL=https://your-project.vercel.app
```

---

## 🗄️ Database Setup

### Supabase Tables

Run the SQL in `create-tables.sql` in your Supabase SQL editor to create:

- `users` table — Stores user accounts
- `reset_tokens` table — Password reset tokens

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for detailed instructions.

---

## 💳 Stripe Integration

### Setup Steps

1. **Create Products & Prices:**
   - Basic Website: $99/month
   - Pro Website: $179/month
   - Leads Only: $179/month
   - Combo (Pro + Leads): $249/month

2. **Configure Webhooks:**
   - Endpoint: `https://your-domain.com/webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

3. **Add Price IDs to Environment Variables:**
   - `STRIPE_PRICE_BASIC`
   - `STRIPE_PRICE_PRO`
   - `STRIPE_PRICE_LEADS`
   - `STRIPE_PRICE_COMBO`

See [STRIPE_SETUP.md](./STRIPE_SETUP.md) for complete setup instructions.

---

## 🎨 Demo Sites

Live demos to show prospective clients what their site could look like:

| Tier | URL | Features |
|---|---|---|
| **Basic** | `/bakery-basic.html` | 1-page site, contact form, mobile-responsive |
| **Pro** | `/bakery-pro.html` | 5 pages, SEO, booking calendar, email capture, carousel |
| **Realtor Pro** | `/realtor-pro.html` | Real estate focused Pro-tier template |
| **Barber** | `/barber-demo.html` | Barber shop demo |
| **Coffee** | `/coffee-demo.html` | Coffee shop demo |
| **Auto** | `/auto-demo.html` | Auto shop demo |
| **Doctor** | `/doctor-demo.html` | Medical practice demo |
| **Fitness** | `/fitness-demo.html` | Gym/fitness demo |
| **Tattoo** | `/tattoo-demo.html` | Tattoo studio demo |

See [DEMO_LINKS.md](./DEMO_LINKS.md) for more details.

---

## 🤖 Website Generation Prompt

Use this prompt with Claude or Grok to generate new industry-specific websites:

```
"Create a modern, high-converting one-page website using Tailwind CSS for a [INDUSTRY] company in Nashville. Use the package features. Make it look professional and trustworthy with strong headlines and a clear call-to-action. Include a contact form."
```

**Usage:**
- Replace `[INDUSTRY]` with: Roofing, HVAC, Plumbing, Bakery, etc.
- Replace `[TIER]` with: Basic, Pro, or Elite

**Examples:**
- "Create a modern, high-converting one-page website using Tailwind CSS for a **Roofing** company in Nashville..."
- "Create a modern, high-converting one-page website using Tailwind CSS for an **HVAC** company in Nashville..."

---

## 📚 Documentation

Additional documentation files in the root directory:

| File | Purpose |
|---|---|
| [COMPLETE_SETUP.md](./COMPLETE_SETUP.md) | All-in-one setup guide with copy-paste code |
| [DATABASE_SETUP.md](./DATABASE_SETUP.md) | Vercel KV (Redis) database setup |
| [STRIPE_SETUP.md](./STRIPE_SETUP.md) | Stripe account and webhook configuration |
| [STRIPE_PROMO_SETUP.md](./STRIPE_PROMO_SETUP.md) | Promotional/discount configuration |
| [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) | Supabase PostgreSQL configuration |
| [EMAIL_SETUP.md](./EMAIL_SETUP.md) | Email service (Resend) configuration |
| [VERCEL_CONFIG.md](./VERCEL_CONFIG.md) | Vercel project configuration |
| [VERCEL_404_FIX.md](./VERCEL_404_FIX.md) | Troubleshooting 404 errors |
| [VERCEL_PROJECT_CHECKLIST.md](./VERCEL_PROJECT_CHECKLIST.md) | Deployment checklist |
| [FIX_API_KEY.md](./FIX_API_KEY.md) | API key troubleshooting |
| [FIX_PRODUCTION_OVERRIDES.md](./FIX_PRODUCTION_OVERRIDES.md) | Production environment fixes |
| [FIND_SETTINGS.md](./FIND_SETTINGS.md) | Settings location guide |
| [CLEAN_START.md](./CLEAN_START.md) | Clean start instructions |
| [FRESH_START.md](./FRESH_START.md) | Fresh start guide |
| [API_TEST_GUIDE.md](./API_TEST_GUIDE.md) | API endpoint testing guide |
| [DEMO_LINKS.md](./DEMO_LINKS.md) | Live demo site links |
| [deploy.md](./deploy.md) | Quick deployment options |
| [webhook-setup.md](./webhook-setup.md) | Stripe webhook setup |

---

## 📝 License

MIT License © Brice Leasure

---

## 🤝 Support

For issues, questions, or contributions, open an issue on GitHub or contact the development team.

---

<div align="center">

**Built with ❤️ for local businesses**

</div>

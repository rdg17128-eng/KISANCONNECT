# KisanConnect 🌾
> **Agriculture Reimagined for the Digital Era • Technology Empowering Nature**

[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Razorpay](https://img.shields.io/badge/Payments-Razorpay%20Standard%20Checkout-0C2340?logo=razorpay&logoColor=white)](https://razorpay.com/)
[![Leaflet](https://img.shields.io/badge/Maps-Leaflet%20GPS-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20Realtime-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**KisanConnect** is a unified, next-generation agricultural commerce, logistics, and settlement platform built to eliminate traditional supply-chain friction between **Farmers**, **Procurement Buyers & Processing Mills**, **Agro-Transport Logistics Providers**, and **Consumers**. 

By bringing together **high-precision GPS farm tagging**, **direct mill discovery**, **algorithmic truck capacity matching**, **cryptographic QR gate authentication**, **Razorpay 3-step payment gateway settlement**, and **real-time multilingual synchronization**, KisanConnect delivers complete transparency from farm field to processing mill.

---

## 💡 Key Innovations & Capabilities

1. **High-Accuracy Farm GPS Geo-Tagging & Plot Mapping:**
   - 1-tap **"Use Current Location"** utilizing satellite hardware GPS polling (`enableHighAccuracy: true`, `timeout: 10000`) with down to `±8m` parcel accuracy.
   - Deep rural Indian reverse-geocoding specifically tailored for villages, hamlets, mandals, tehsils, and districts.
   - Comprehensive offline state and district lookup across all 28 Indian States & 8 Union Territories.

2. **Direct Mill Discovery & Price Transparency:**
   - Real-time commodity rate indexing and transparent mill price listings per quintal/tonne.
   - Distance-sorted mill directory so farmers can choose the most profitable and logistically efficient buyer.

3. **Smart Agro-Transport Capacity Matching:**
   - Transport requests (`TR-2026-XXXXXX`) automatically match only vehicles whose rated tonnage meets or exceeds the crop load volume ($\text{Truck Capacity} \ge \text{Crop Quantity}$).
   - Multi-transporter bidding with transparent haulage quotes, arrival ETAs, and live trip progression.

4. **Cryptographic QR Gate Verification:**
   - Every accepted enquiry generates a tamper-proof digital QR code containing crop authenticity metadata, farmer details, crop tonnage, and assigned mill ID.
   - Mill gate operators authenticate arriving loads in seconds using an in-browser camera scanner (`html5-qrcode`), preventing unauthorized deliveries or route manipulation.

5. **Integrated Razorpay Payment Gateway & Instant Settlement:**
   - **Full 3-Step Verification Pipeline:**
     1. Backend order creation (`/api/create-order`) via Razorpay REST API.
     2. Standard Checkout modal presentation (`RazorpayCheckoutModal`).
     3. Server-side HMAC-SHA256 signature verification (`/api/verify-payment`) and live capture confirmation.
   - **Auto-Success Settlement Flow:** Seamless instant settlement for demo/test environments (`/api/auto-success-payment`) with authentic cryptographic signature generation.
   - Generates itemized, printable, and downloadable **Payment Settlement Bills**.

6. **10+ Indian Regional Languages Support:**
   - Native multilingual switching (English, Hindi, Telugu, Tamil, Kannada, Marathi, Gujarati, Bengali, Punjabi, Malayalam) for accessible adoption across India.

---

## 🔄 End-to-End Workflow Architecture

```
┌─────────────────┐           ┌──────────────────┐           ┌──────────────────────┐
│  FARMER PORTAL  │           │   BUYER / MILL   │           │  TRANSPORTER PORTAL  │
└────────┬────────┘           └────────┬─────────┘           └──────────┬───────────┘
         │                             │                                │
1. FIELD REGISTRATION                  │                                │
   • 1-Tap "Use Current Location"      │                                │
   • High-accuracy GPS (±8m)           │                                │
   • Resolves Village & Mandal         │                                │
         │                             │                                │
2. ENQUIRY DISPATCH                    │                                │
   • Select Crop & Enter Acreage       │                                │
   • Request Mill Procurement ────────►│                                │
   • Enquiry ID: KC-2026-XXXXXX        │                                │
         │                             │                                │
         │                    3. REVIEW & ACCEPT                        │
         │                       • Validates rate & tonnage             │
         │                       • Accepts enquiry                      │
         │◄──────────────────────• Generates Crop QR Code               │
         │                       • Creates Transport Req ──────────────►│
         │                             │                                │
         │                             │                     4. QUOTE & ASSIGN
         │                             │                        • Filter trucks:
         │                             │                          Capacity >= Load
         │◄────────────────────────────┼────────────────────────• Submits Haulage Bid
         │                             │                                │
5. ACCEPTS QUOTE & MONITORS            │                                │
   • Locks transporter vehicle         │                     6. TRANSIT PROGRESSION
   • Tracks live transit status ◄──────┼────────────────────────• ASSIGNED
         │                             │                        • PICKUP_STARTED
         │                             │                        • CROP_PICKED_UP
         │                             │                        • IN_TRANSIT
         │                             │                        • ARRIVED_AT_MILL
         │                             │                                │
         │                    7. GATE ENTRY & QR SCAN                   │
         │                       • Operator scans driver QR ◄───────────┘
         │                       • 🟢 VERIFIED MATCH
         │                             │
         │                    8. DIGITAL LOAD RECEIVING
         │                       • Confirms weighment & quality
         │◄──────────────────────• Real-time Status: LOAD RECEIVED
         │                             │
         │                    9. RAZORPAY SETTLEMENT
         │                       • Secure Order Creation
         │                       • HMAC-SHA256 Verification
         │◄──────────────────────• Real-time Cross-Portal Event
         │                             │
10. PAYMENT SETTLED & BILLING          │
    • Stage 6: Payment Settled         │
    • Total Earnings Dashboard Updated │
    • Download Verified Receipt & Bill │
```

---

## 🏛️ Ecosystem Portals

### 🚜 1. Farmer Portal
* **Crop Inventory:** Register fields with accurate 1-tap GPS coordinates, crop type, and acreage.
* **Mill Directory:** Browse nearby buyers sorted by distance and buying rates.
* **Proposals & Enquiries:** Send custom supply proposals with haulage preference.
* **Traceability & Lifecycle Stepper:** 6-stage real-time tracking:
  `PENDING` ➔ `ACCEPTED` ➔ `QR GENERATED` ➔ `IN TRANSIT` ➔ `LOAD RECEIVED` ➔ `PAYMENT SETTLED`.
* **Settlement Invoices:** View, print, or download official payment slips with Razorpay transaction and UTR references.
* **Weather & Commodity Intel:** Real-time localized weather forecasts and market price indices.

### 🏭 2. Buyer & Mill Operator Portal
* **Live Enquiries Inbox:** Real-time feed of incoming farmer proposals with instant status toggling.
* **One-Click Acceptance:** Instantly approve farmer enquiries and dispatch transport notices.
* **Hardware Camera QR Scanner:** In-browser scanner powered by `html5-qrcode` to verify arriving cargo.
* **Digital Load Receiving:** One-click confirmation of received cargo with automated weight ledger entries.
* **Razorpay Payment Gateway:** Execute trade settlements with Razorpay standard checkout or auto-settlement modes.

### 🚛 3. Transporter Portal
* **Capacity-Matched Job Board:** Shows haulage jobs only to trucks capable of transporting the specified tonnage.
* **Competitive Bidding:** Transporters bid with custom pricing and estimated pickup time.
* **Live Transit Progression:** Status updater from initial dispatch to mill gate arrival.
* **Fleet Management:** Register trucks with vehicle numbers, load capacities, and per-km tariffs.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, Vite (Ultra-fast HMR) |
| **Payment Gateway** | Razorpay Node.js SDK, Standard Web Checkout, HMAC-SHA256 Signature Verification |
| **Styling & Design** | Vanilla CSS, Glassmorphic Design System, Dynamic Accent Lighting |
| **Geolocation & Maps** | Leaflet, React-Leaflet, High-Accuracy Geolocation API, OpenStreetMap Nominatim |
| **QR Engine** | `qrcode` (Vector/Canvas Generator), `html5-qrcode` (Live Camera Hardware Scanner) |
| **Database & Realtime**| Supabase (PostgreSQL + Realtime Channels), Cross-Tab Storage Event Bus |
| **Internationalization**| Multi-language localization (10 Indian languages) |
| **Backend / OCR** | Node.js Standalone Server, Express/Vite Middleware, FastAPI OCR Service |

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0.0 or higher)
* [npm](https://www.npmjs.com/) (v9.0.0 or higher)

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kisanconnect-sih/kisan.git
   cd kisan
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the `new_app` directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   VITE_OPENWEATHER_API_KEY=your_openweather_key

   # Razorpay Credentials
   RAZORPAY_KEY_ID=your_razorpay_key_id
   RAZORPAY_KEY_SECRET=your_razorpay_key_secret
   VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 🧪 Testing Razorpay Integration

To run the automated Razorpay integration test suite:

```bash
npm test
```

The test suite validates:
- Sub-100 paise amount validation (HTTP 400 rejection)
- Missing parameter verification handling
- Cryptographic signature mismatch detection
- Authentic HMAC-SHA256 signature verification
- Live Razorpay API order creation
- Full end-to-end Auto-Success payment settlement

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).

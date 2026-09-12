# KisanConnect 🌾
> **Agriculture Reimagined for the Digital Era • Technology Empowering Nature**

[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Leaflet](https://img.shields.io/badge/Maps-Leaflet%20GPS-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20Realtime-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**KisanConnect** is a unified, next-generation agricultural commerce and logistics ecosystem designed to eliminate traditional supply-chain bottlenecks between **Farmers**, **Procurement Buyers & Processing Mills**, **Agro-Transport Logistics Providers**, and **Consumers**. 

By bringing together **high-precision GPS farm tagging**, **direct mill discovery**, **algorithmic truck capacity matching**, **cryptographic QR gate authentication**, and **real-time payment settlement with instant digital billing**, KisanConnect provides complete transparency from farm field to processing mill.

---

## 💡 The New Application Idea

Traditional agricultural supply chains are plagued by opaque pricing, exploitative middlemen, inaccurate farm plot tagging, gate entry fraud, and delayed payment settlements that leave farmers waiting weeks for compensation.

**KisanConnect transforms this with 6 core innovations:**

1. **High-Accuracy Farm GPS Geo-Tagging:**
   - 1-tap **"Use Current Location"** utilizing satellite hardware GPS polling (`enableHighAccuracy: true`, `timeout: 10000`) providing down to `±8m` parcel accuracy.
   - Deep rural Indian reverse-geocoding specifically tailored for villages, hamlets, mandals, tehsils, and districts.
   - Interactive high-zoom map centering with search and live plot address resolution.

2. **Direct Mill Discovery & Price Transparency:**
   - Real-time commodity rate indexing and transparent mill price listings per quintal.
   - Distance-sorted mill directory so farmers can pick the most profitable and logistically efficient buyer.

3. **Smart Agro-Transport Capacity Matching:**
   - Transport requests (`TR-2026-XXXXXX`) automatically match only those transport vehicles whose rated tonnage meets or exceeds the crop load volume ($\text{Truck Capacity} \ge \text{Crop Quantity}$).
   - Multi-transporter bidding with price quotes, arrival ETAs, and live trip progression.

4. **Cryptographic QR Gate Verification:**
   - Every accepted enquiry generates a tamper-proof digital QR code containing crop authenticity metadata, farmer details, crop tonnage, and assigned mill ID.
   - Mill gate operators authenticate arriving loads in seconds using an in-browser camera scanner (`html5-qrcode`), preventing unauthorized deliveries or route manipulation.

5. **Digital Load Receiving & Audit Ledger:**
   - Digitally records truck weighment, accepted quantity, arrival timestamps, and operator signatures into an immutable ledger.

6. **Instant Payment Settlement & Cross-Portal Synchronization:**
   - Buyers record payment completion with payment mode (UPI, NEFT/RTGS, Net Banking, Cash) and bank transaction UTR numbers.
   - Real-time cross-tab and database synchronization updates the farmer's portal instantly without page refresh:
     - Advances the lifecycle to **Stage 6: `Payment Settled`**.
     - Generates an itemized, printable, and downloadable **Payment Bill / Settlement Slip**.
     - Updates the farmer's financial dashboard counters and lifetime earnings.

---

## 🔄 The New End-to-End Application Flow

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
         │                    9. PAYMENT SETTLEMENT
         │                       • Records settlement:
         │                         UPI / NEFT / UTR Ref
         │◄──────────────────────• Real-time Cross-Portal Event
         │                             │
10. PAYMENT RECEIVED & BILLING         │
    • Stage 6: Payment Settled         │
    • Total Earnings Card Updated      │
    • View & Print Settlement Bill     │
```

---

## 🏛️ Ecosystem Portals

### 🚜 1. Farmer Portal (*Empower Your Yield*)
* **Crop Inventory:** Register fields with accurate 1-tap GPS coordinates, crop type, and acreage.
* **Mill Directory:** Browse nearby buyers sorted by distance and buying rates.
* **Proposals & Enquiries:** Send custom supply proposals with haulage preference.
* **Traceability & Lifecycle Stepper:** 6-stage real-time tracking:
  `PENDING` ➔ `ACCEPTED` ➔ `QR GENERATED` ➔ `IN TRANSIT` ➔ `LOAD RECEIVED` ➔ `PAYMENT SETTLED`.
* **Settlement Invoices:** View, print, or download official payment slips with UTR transaction references.
* **Weather & Commodity Intel:** Real-time localized weather forecasts and market price indices.

### 🏭 2. Buyer & Mill Operator Portal (*Precision Sourcing*)
* **Live Enquiries Inbox:** Debounced, high-speed feed of incoming farmer proposals with instant status toggling.
* **One-Click Acceptance:** Instantly approve farmer enquiries and dispatch transport notices.
* **Hardware Camera QR Scanner:** In-browser scanner powered by `html5-qrcode` to verify arriving cargo.
* **Digital Load Receiving:** One-click confirmation of received cargo with automated weight ledger entries.
* **Payment Recording Engine:** Record settlements via UPI, Net Banking, or Cash with UTR tracking, triggering immediate synchronization to the farmer.

### 🚛 3. Transporter Portal (*Smart Agro-Logistics*)
* **Capacity-Matched Job Board:** Shows haulage jobs only to trucks capable of transporting the specified tonnage.
* **Competitive Bidding:** Transporters bid with custom pricing and estimated pickup time.
* **Live Transit Progression:** Status updater from initial dispatch to mill gate arrival.
* **Fleet Management:** Register trucks with vehicle numbers, load capacities, and per-km tariffs.

### 🥗 4. Consumer Portal (*Direct Farm Transparency*)
* **Farm Produce Catalog:** Browse certified farm crops directly.
* **Batch Traceability:** Trace food origin back to verified farmer coordinates and harvest timestamps.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, Vite (Ultra-fast HMR) |
| **Styling & Design** | Vanilla CSS, Glassmorphic Design System, Dynamic Accent Lighting |
| **Geolocation & Maps** | Leaflet, React-Leaflet, High-Accuracy Geolocation API, OpenStreetMap Nominatim |
| **QR Engine** | `qrcode` (Raster/Vector Generator), `html5-qrcode` (Live Camera Hardware Scanner) |
| **State & Sync** | Supabase (PostgreSQL + Realtime Channels), Cross-Tab Storage Event Bus |
| **Typography & Icons** | Google Fonts (Inter, Outfit), FontAwesome 6 Pro |

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0.0 or higher)
* [npm](https://www.npmjs.com/) (v9.0.0 or higher)

### Installation & Local Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rdg17128-eng/KISANCONNECT.git
   cd KISANCONNECT
   ```

2. **Navigate to the web application:**
   ```bash
   cd new_app
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## 📱 User Experience & Visual Design

* **Rich Earth & Emerald Palette:** Premium agricultural emerald (`#10b981`), golden harvest wheat (`#f59e0b`), and deep volcanic slate backgrounds (`#0a0f0d`).
* **Glassmorphic Bento Grids:** Frosted translucent cards with subtle borders and smooth micro-animations.
* **Responsive & Mobile-First:** Designed to work smoothly on rural 4G mobile devices, tablets, and desktop workstations.
* **Multi-Language Support:** Native language selector for accessible regional adoption.

---

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).

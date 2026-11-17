# IRCTC Tatkal Booking Assistant 🚆⚡

An intelligent, non-intrusive Chrome Extension (Manifest V3) that streamlines and accelerates the IRCTC Tatkal booking workflow by automating repetitive form-filling and train selection up to the payment screen.

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-brightgreen.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Telemetry](https://img.shields.io/badge/Telemetry-Zero%20External%20Calls-success.svg)](#privacy--security-safeguards)

---

## 🌟 Features

- **Passenger Profiles & Groups**: Pre-save passenger details (Name, Age, Gender, Berth Preference, Food Choice) locally and switch between travel groups with a single click.
- **Journey Configuration**: Pre-configure Source & Destination stations, Travel Class (including "All Classes"), Date, Train Number, and Tatkal/General Quota.
- **Smart Station & Date Autofill**: Converts standard dates to IRCTC's required format (`DD/MM/YYYY`) and fills PrimeNG autocomplete search inputs.
- **Auto-Pilot Train & Class Selection**:
  - Automatically locates your configured train (e.g. `JHELUM EXPRESS (11078)`) on `/nget/train-list`.
  - Clicks your configured travel class (e.g. `Sleeper (SL)`, `3A`, `2A`) and triggers availability refresh.
  - Detects and selects your journey date slot card (e.g. `Wed, 18 Nov | WL62`).
  - Monitors and clicks the **Book Now** button as soon as it is enabled.
  - Automatically confirms booking condition dialogs (Waitlist confirmation / "Yes").
- **Passenger Form Autofill**: Populates all passenger details, adds rows dynamically via "+ Add Passenger", selects berth preferences, and checks "Book only if confirm berths are allotted".
- **Payment Method Pre-selection**: Automatically selects BHIM/UPI/QR for the fastest Tatkal checkout.
- **Review Page Alerts**: Focuses and highlights the CAPTCHA input field and sounds an alert for manual user solving.
- **Offline Simulation Test Bench**: Includes a standalone mock IRCTC environment (`mock-irctc.html` + `run_test_server.py`) for offline practice and end-to-end verification.

---

## 🛡️ Privacy & Security Safeguards

This extension is built strictly as a client-side helper to assist genuine passengers during high-speed Tatkal booking windows:

> [!IMPORTANT]
> - **Zero CAPTCHA Automation**: Does NOT solve or bypass CAPTCHAs. All CAPTCHAs must be solved manually by the user.
> - **Zero OTP Automation**: Does NOT read, intercept, or bypass OTPs.
> - **Zero Payment Automation**: Hard stop on `/nget/payment`. Does NOT handle or store bank details, credit cards, or UPI PINs.
> - **100% Local Storage**: All passenger and journey configurations remain strictly inside your browser's `chrome.storage.local`. Zero external servers, analytics, or telemetry.

---

## 🚀 Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/abhitej1216/Tatkal-ticket-booking-extension.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the project directory (`Tatkal-ticket-booking-extension`).

---

## 📖 Usage Guide

### 1. Setup Passenger Profiles & Journey
1. Click the **IRCTC Tatkal Assistant** icon in the Chrome toolbar.
2. Under the **Passengers** tab, add your passenger details (Name, Age, Gender, Berth Preference).
3. Under the **Journey** tab, configure:
   - Source & Destination station codes (e.g. `AGC`, `PUNE`)
   - Journey Date
   - Train Number or Name (e.g. `11078` or `JHELUM EXPRESS`)
   - Travel Class (e.g. `Sleeper (SL)`, `AC 3 Tier (3A)`, or `All Classes`)
   - Quota (`Tatkal`, `General`, or `Premium Tatkal`)

### 2. Auto-Pilot Booking Flow
1. Log in to [IRCTC NextGen Portal](https://www.irctc.co.in/nget/).
2. Click **Start Assistant** (or **Fill Journey**) in the popup.
3. The assistant will:
   - Fill station codes and date on the search page.
   - Click "Search Trains".
   - On the train results page, locate your train, expand your chosen class, select your date slot, and click "Book Now".
   - On the passenger details page, auto-fill passenger rows, check confirm berth options, and select UPI payment.
   - On the review page, highlight the CAPTCHA box for you to type and proceed to payment.

### 3. Local Mock Testing
Test the extension offline anytime without making real IRCTC requests:
```bash
python run_test_server.py
```
Open `http://localhost:8000/mock-irctc.html` in Chrome and test the full flow with mock data.

---

## 📁 Repository Structure

```
├── manifest.json         # Chrome Extension Manifest (Manifest V3)
├── background.js         # Service worker handling messaging and auto-injection
├── content.js            # Content script for DOM automation on IRCTC & mock pages
├── popup.html            # Extension popup user interface
├── popup.js              # Popup logic, tabs, passenger & journey management
├── popup.css             # Popup UI styling (IRCTC theme)
├── storage.js            # Chrome Storage API wrapper for passenger & config data
├── utils.js              # DOM helpers, dispatchers, date formatters, validators
├── mock-irctc.html       # Realistic offline IRCTC simulator for local testing
├── run_test_server.py    # Local HTTP server for offline testing
├── validate_all.py       # Codebase syntax and schema validator
├── icons/                # Extension action icons (16x16, 48x48, 128x128)
├── ARCHITECTURE.md       # Technical architecture and event flow documentation
├── CHANGELOG.md          # Version release history
└── TESTING.md            # Comprehensive test plan and instructions
```

---

## ⚖️ Disclaimer

This software is an independent open-source tool developed for educational and personal convenience purposes to assist users in filling repetitive forms faster. It is not affiliated with, endorsed by, or connected to IRCTC (Indian Railway Catering and Tourism Corporation) or Indian Railways. Users are advised to comply with all applicable IRCTC terms of service and ticketing rules.

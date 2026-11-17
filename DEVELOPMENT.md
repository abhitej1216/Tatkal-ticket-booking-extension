# IRCTC Tatkal Booking Assistant — Development Guide

## 1. Technology Stack
- **Platform**: Google Chrome Extension (Manifest V3)
- **Languages**: JavaScript (ES6+ standard), HTML5, CSS3
- **Storage**: Chrome Storage API (`chrome.storage.local`)
- **Page Execution**: Content Scripts, DOM MutationObserver, Custom Event Dispatchers
- **Background**: Service Worker (`background.js`)
- **External Dependencies**: Zero runtime dependencies. 100% lightweight native browser code.

---

## 2. Project Architecture & File Hierarchy

```
irctc-tatkal-assistant/
├── manifest.json        # Chrome Extension Manifest V3 configuration
├── popup.html           # Modern 4-tab user interface
├── popup.css            # Responsive styles and color themes
├── popup.js             # UI controller, passenger/group CRUD, message dispatch
├── background.js        # Service worker: extension state & message routing
├── content.js           # Content script: page detector, form filling, observer
├── storage.js           # Chrome Storage API abstraction for local persistence
├── utils.js             # Angular DOM setters, validators, notifications
├── mock-irctc.html      # Local simulated IRCTC booking test bench
├── run_test_server.py   # Python lightweight local test HTTP server
├── icons/               # Extension icons (16, 32, 48, 128px PNGs)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── PROJECT_STATUS.md    # Single source of truth for project state
├── DEVELOPMENT.md       # Development, setup, and architectural guide
├── CHANGELOG.md         # Chronological development changes
├── TASKS.md             # Development task tracker
├── ARCHITECTURE.md      # Detailed system architecture with Mermaid diagrams
├── AGENTS.md            # Mandatory rules for AI coding agents
├── HANDOFF.md           # Session handoff documentation
└── TESTING.md           # Test cases, execution instructions, and reports
```

---

## 3. Chrome Extension Installation & Setup

To load this extension in Google Chrome:

1. Open Google Chrome and enter `chrome://extensions` in the address bar.
2. Toggle on **"Developer mode"** in the top right corner.
3. Click the **"Load unpacked"** button in the top left corner.
4. Browse to and select the directory:
   `C:\Codes\autofill chrome ext\irctc-tatkal-assistant`
5. The extension **"IRCTC Tatkal Booking Assistant"** will now appear in your extensions list.
6. Click the Extensions (puzzle piece) icon in Chrome's toolbar and pin **IRCTC Tatkal Assistant** for easy access.

---

## 4. How Content Scripts Interact with IRCTC Pages

### A. Angular-Aware Value Injection (`utils.js`)
IRCTC is built on modern Angular. Traditional DOM assignment (`input.value = "John"`) fails because Angular's internal reactive form controls (`FormControl`, `FormGroup`) do not update.

To resolve this, `utils.js` executes:
1. Retrieval of the native property setter:
   ```javascript
   const nativeSetter = Object.getOwnPropertyDescriptor(
     window.HTMLInputElement.prototype, 'value'
   ).set;
   nativeSetter.call(element, value);
   ```
2. Dispatch of all required synthetic events with `{ bubbles: true }`:
   - `input`
   - `change`
   - `blur`
   - `keydown` / `keyup`

### B. Dynamic Element Observation (`MutationObserver`)
IRCTC renders passenger rows dynamically when "+ Add Passenger" is clicked.
The content script observes DOM changes through a debounced `MutationObserver`:
- Watches `document.body` for child list additions.
- Detects page state transitions (e.g. from `/train-search` to `/psgninput` or `/payment`).
- Halts all automated actions instantly when the payment page is reached.

---

## 5. Storage Data Model

All data is stored purely locally in `chrome.storage.local`. No external API calls are made.

```typescript
// Passenger Entity
interface Passenger {
  id: string;               // UUID v4
  name: string;             // Full Name
  age: number;              // 1 - 125
  gender: 'Male' | 'Female' | 'Transgender';
  berthPreference: 'Lower' | 'Middle' | 'Upper' | 'Side Lower' | 'Side Upper' | 'No Preference';
  foodPreference: 'Veg' | 'Non-Veg' | 'No Food';
  nationality: string;      // default: "Indian"
  idType?: 'Aadhaar' | 'PAN' | 'Passport' | '';
  idNumber?: string;
}

// Passenger Group Entity
interface Group {
  id: string;               // UUID v4
  name: string;             // e.g. "Family Tatkal"
  passengerIds: string[];   // Referenced Passenger UUIDs
}

// Journey Configuration
interface JourneyConfig {
  source: string;           // Station Code (e.g., NDLS)
  destination: string;      // Station Code (e.g., BCT)
  date: string;             // YYYY-MM-DD
  trainNumber?: string;     // e.g., 12952
  travelClass: 'SL' | '3A' | '2A' | '1A' | 'CC' | 'EC' | '2S';
  quota: 'General' | 'Tatkal' | 'Premium Tatkal' | 'Ladies';
}
```

---

## 6. How to Test the Extension

You can test the extension in 2 environments:
1. **Local Simulated Environment (`mock-irctc.html`)**: Run without risking real IRCTC sessions or during non-Tatkal hours.
2. **Official IRCTC Website (`https://www.irctc.co.in/`)**: Live production environment.

Refer to `TESTING.md` for complete end-to-end testing procedures.

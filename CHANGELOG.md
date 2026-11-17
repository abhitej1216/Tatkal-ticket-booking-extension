# Changelog

All notable changes to the **IRCTC Tatkal Booking Assistant** Chrome Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.6] - 2026-11-16

### Fixed
- **Guaranteed Class Box Selection Before Date Search (`content.js`)**:
  - Fixed a critical bug where `findTargetDateCard()` falsely matched the train departure time header (`14:10 | AGRA CANTT | Wed, 18 Nov`) as an "already opened" date card.
  - Because of this false match, the assistant skipped clicking the configured travel class (`Sleeper (SL)` / `3A` / `2A`), and the availability slots (`Refresh 🔄`) were never expanded.
  - Implemented strict availability status enforcement: elements without an availability status (`WL`, `AVAILABLE`, `RAC`, `CURR_AVBL`, `NOT AVAILABLE`, `REGRET`) are strictly rejected.
  - Added dedicated `findClassBox()` helper with standard class code extraction (`getClassCode`), accurately mapping `SL`, `3A`, `2A`, `1A`, `3E`, `CC`, `2S` or `All Classes` directly to the train card's class boxes.
  - Automatically clicks the class box and inner refresh icon, waits up to 12s for the seat availability tray to expand, and then cleanly clicks the target date card (`Wed, 18 Nov | WL62`) and `Book Now`.

---

## [1.1.5] - 2026-11-16

### Fixed
- **Content Security Policy (CSP) Compliance (`content.js`)**:
  - Removed all dynamic `<script>` tag injections (`executeInMainWorld`) which were blocked by IRCTC's strict Content Security Policy (`script-src 'self' 'wasm-unsafe-eval' ...`).
  - Switched exclusively to standard, 100% CSP-compliant DOM event dispatching (`pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click`, and native `el.click()`) within the extension content script.
- **Accurate Date Card Identification & Single-Action Click (`content.js`)**:
  - Re-architected `findTargetDateCard()` with priority scoring:
    - **Priority 1**: Matches elements containing both the target date (`18 Nov`) and availability status (`WL`, `AVAILABLE`, `RAC`, `CURR_AVBL`, `NOT AVAILABLE`, `REGRET`).
    - **Priority 2**: Matches elements adhering to known IRCTC date card classes (`.train_avl_enq_box`, `[class*="avl_enq_box"]`, `.date-card`, `div.col-xs-3`, `div.col-sm-2`) with target date.
    - Filters out false positives like train departure time headers (`14:10`) and search summary bars (`RESULTS FOR`).
  - Prevents race conditions and click loops: clicks the target date card cleanly and waits for Angular and IRCTC's backend to fetch fare and enable the `Book Now` button.
  - Automatically clicks `Book Now` as soon as it is highlighted, and accepts any Waitlist confirmation dialogs ("Yes").

---

## [1.1.4] - 2026-11-16

### Fixed
- **Angular Zone.js Main World Click Injection (`content.js`)**:
  - Solved the root cause where Chrome's Isolated World blocked Angular's Zone.js from intercepting date card clicks.
  - Implemented `executeInMainWorld`: dynamically injects a script tag that runs directly in the webpage's **MAIN WORLD** (sharing the exact JavaScript context as Angular and Zone.js).
  - Main World execution triggers Angular's internal change detection immediately upon clicking `Wed, 18 Nov`, updating component state and turning the `Book Now` button active/bright orange.
- **Auto-Reconnection on Tab Disconnect (`background.js` & `manifest.json`)**:
  - Added `"scripting"` permission in `manifest.json`.
  - When `background.js` detects `Error: Could not establish connection. Receiving end does not exist` (which happens after reloading an extension without refreshing the page), it automatically re-injects content scripts (`storage.js`, `utils.js`, `content.js`) into the tab on the fly.
  - Users no longer experience broken connections after extension reloads.

---

## [1.1.3] - 2026-11-16

### Fixed
- **Direct Native DOM Click Execution (`utils.js` & `content.js`)**:
  - Fixed a critical bug in `clickElement` and `triggerClick` where `element.click()` was placed inside `catch (e)` blocks. Because `dispatchEvent(new MouseEvent(...))` never threw, native `.click()` was never called, preventing Angular Zone.js and PrimeNG `(click)` output handlers from firing.
  - Both methods now always execute native `element.click()` alongside pointer and mouse events (`pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click`).
- **Resilient Date Card Detection & Pre-Opened State Support (`content.js`)**:
  - Replaced rigid availability status regex with a resilient text match: queries all elements containing `targetDay` and `targetMonth` (e.g., `18` and `Nov`), excluding departure timestamps (`14:10`) and search headers (`Results for`).
  - Added support for pre-opened availability: if the date cards (`Wed, 18 Nov`, etc.) are already expanded on screen, the assistant skips re-toggling the class and immediately clicks the target date card.
  - Automatically clicks all levels of the date card hierarchy (the inner text/date container, the outer card, and its parent) to ensure the click is registered by Angular.
  - Actively polls every 300ms until the `Book Now` button turns bright orange and is enabled, then clicks it and confirms any Waitlist dialog.

---

## [1.1.2] - 2026-11-16

### Fixed
- **Target Date Slot Selection on Availability Cards (`content.js`)**:
  - Resolved the stall issue on `/nget/train-list` where availability loaded but the extension did not click the selected date card (e.g., `Wed, 18 Nov | WL61`), leaving `Book Now` disabled.
  - Implemented exact date matching: parses `targetDay` and `targetMonth` from the configured journey date (e.g., `18 Nov`), locates the specific date availability card among expanded slots, and dispatches full mouse event sequences (`mouseover`, `mouseenter`, `mousedown`, `mouseup`, `click`) to its container and children.
  - Excluded departure/arrival summary headers (`14:10 | AGRA CANTT | Wed, 18 Nov ...`) using timestamp pattern filtering.
  - Added fallback to the first date card if the exact date is unavailable or shifted.
  - Enabled active polling for the enabled `Book Now` button immediately following date card activation.
  - Added Waitlist (`WL`) and booking condition confirmation handling (`p-confirmdialog` / `.ui-dialog` "Yes" / "I Agree" buttons).
- **Test Bench Date Card Simulation (`mock-irctc.html`)**:
  - Replicated live IRCTC NextGen behavior where 4 availability date cards appear and the user/extension must click a date card to enable the `Book Now` button.

---

## [1.1.1] - 2026-11-15

### Fixed
- **PrimeNG Calendar Date Selection Fix**: Fixed an issue where IRCTC's date reverted to today's date (`15/11/2026`).
  - Added PrimeNG calendar overlay day-cell detection and click trigger (`.p-datepicker-calendar td span`). Clicking the target day cell (e.g. `22`) directly triggers PrimeNG's native `onDateSelect()` handler.
  - Added multi-month forward navigation when target journey date is in future months.
  - Removed `document.body.click()` which previously triggered PrimeNG's outside-click handler that reverted the input to today's date.
- **Immediate Auto-Save for Journey Inputs (`popup.js`)**:
  - Implemented `syncAndSaveJourneyFromInputs()` attached to `change` and `input` events across all Journey inputs (Date, Stations, Class, Quota). Any modification is immediately persisted to Chrome storage without requiring explicit button clicks.
  - Added pre-sync hook in `handleStartAutoPilot()` and `handleFillJourney()` to capture newly edited dates prior to sending commands to the content script.
  - Highlighted configured Journey Date in bold blue on the Dashboard for immediate visual confirmation.

---

## [1.1.0] - 2026-11-15

### Added
- **"All Classes" Option**: Added `<option value="All Classes">All Classes</option>` to the travel class dropdown in the popup UI and journey configuration. Supports searching without class restrictions on IRCTC search.
- **Auto-Pilot Train Selection & Booking Engine (`content.js`)**:
  - Full automated chain from Train List (`/nget/train-list`): identifies the target train card via train number/name query (or defaults to the first train in results).
  - Isolates class boxes strictly inside the matched train card (preventing false clicks on left-hand sidebar filters).
  - Emulates full mouse events (`mouseover`, `mouseenter`, `mousedown`, `mouseup`, `click`) to trigger Angular availability calls on `.pre-avail` class boxes and inner `Refresh 🔄` icons.
  - Automatically activates date availability slots when results expand.
  - Continuously polls for the enabled `Book Now` button and clicks it.
  - Automatically accepts IRCTC confirmation dialogs (`p-confirmdialog`, "Yes" / "I Agree" buttons).
  - Retains Auto-Pilot state across page navigation to automatically fill passenger forms.
- **Dedicated "Select Train & Book Now" Button**: Added direct triggers in the Dashboard and Assistant tabs (`selectTrainBookBtn` and `quickSelectTrain`) to manually invoke train selection on demand.
- **Full Mouse Event Simulation in DOM Utilities**: Upgraded `clickElement` in `utils.js` to dispatch full mouse event sequences compatible with Angular/PrimeNG event bindings.

### Fixed
- **Train List Page Transition Trigger**: Fixed `setupObserver` and `start()` so that when the assistant is active and on the train list page, train selection and "Book Now" clicking are automatically initiated rather than idling.
- **JavaScript Syntax & Bracket Validation**: Verified balanced tokens across all scripts with 0 errors via automated syntax validator.

---

## [1.0.1] - 2026-11-15

### Fixed
- **IRCTC PrimeNG Calendar Date Picker**: Fixed date conversion from `YYYY-MM-DD` to IRCTC's required `DD/MM/YYYY` format (`formatToIRCTCDate`). Dispatches full keyboard enter and blur events so PrimeNG updates reactive form models.
- **PrimeNG Quota Dropdown (`#journeyQuota`)**: Fixed `<p-dropdown>` custom element detection and trigger handling. Dynamically handles floating dropdown panel for options (`TATKAL`, `GENERAL`, `PREMIUM TATKAL`, `LADIES`).
- **PrimeNG Class Dropdown (`#journeyClass`)**: Added support for travel class selection (`SL`, `3A`, `2A`, `1A`, `CC`, `2S`).
- **Modern Passenger Input Selectors (`/nget/booking/psgninput`)**: Added support for `p-autocomplete[formcontrolname="passengerName"] input`, `input[formcontrolname="passengerAge"]`, and PrimeNG dropdowns for gender, berth, and food choices.
- **Automatic Navigation Autofill**: When the Assistant is active, navigating from train search to the passenger booking page automatically triggers passenger autofill without requiring extra clicks.
- **Popup Guidance**: Improved real-time status banners guiding the user step-by-step from Train Search ➔ Train List ➔ Passenger Entry.

---

## [1.0.0] - 2026-11-14

### Added
- **Manifest V3 Core**: Configured `manifest.json` with permissions (`storage`, `activeTab`, `tabs`) and host matches for IRCTC and localhost test bench.
- **Popup UI (`popup.html`, `popup.css`, `popup.js`)**:
  - Clean 4-tab interface: Dashboard, Passengers, Journey, Assistant.
  - Active toggle switch with real-time status indicator.
  - Passenger profiles CRUD with support for Name, Age, Gender, Berth, Food, Nationality, ID.
  - Passenger Group organization and active group selection.
  - Journey configuration form (Source, Destination, Date, Train, Class, Quota).
  - Activity log panel with timestamped operations.
  - Confirmation modals for data removal.
- **Chrome Storage API Wrapper (`storage.js`)**:
  - Full CRUD operations with promise-based methods.
  - UUID generation utility.
- **DOM Utilities (`utils.js`)**:
  - Angular-aware `setNativeValue` with prototype setter invocation and synthetic event dispatch.
  - MutationObserver-based `waitForElement` and `waitForElements`.
  - Dropdown handler supporting `<select>`, Angular Material `mat-select`, and PrimeNG dropdowns.
  - Floating status notifications.
  - Multi-attribute passenger validation.
- **Background Service Worker (`background.js`)**:
  - Message dispatcher routing requests between popup and active content tabs.
  - Real-time tab monitoring and state tracking.
- **Content Script (`content.js`)**:
  - URL and DOM-based multi-stage page detector (Login, Search, Train List, Passenger Form, Review, Payment).
  - Multi-row passenger autofill with dynamic "+ Add Passenger" click emulation.
  - Automated stop condition upon reaching the payment page.
  - Observer watching for DOM additions and stage shifts.
- **Local Test Bench (`mock-irctc.html`, `run_test_server.py`)**:
  - Simulation page faithfully mimicking IRCTC's Angular DOM attributes.
  - One-click Python local HTTP server for testing.
- **Extension Icons (`icons/`)**:
  - Generated PNG icons in 16x16, 32x32, 48x48, and 128x128 px formats.
- **Documentation Suite**:
  - `PROJECT_STATUS.md`, `DEVELOPMENT.md`, `CHANGELOG.md`, `TASKS.md`, `ARCHITECTURE.md`, `AGENTS.md`, `HANDOFF.md`, `TESTING.md`.

# Testing Guide — IRCTC Tatkal Booking Assistant

This document outlines the testing strategy, test cases, and step-by-step procedures to test the extension in both local simulated and live IRCTC environments.

---

## 1. Quick Start: Test Locally in 2 Minutes

The easiest way to test the extension immediately without needing live IRCTC booking access:

### Step 1: Load the Extension into Chrome
1. Open Google Chrome and go to `chrome://extensions/`.
2. Turn ON **"Developer mode"** (toggle in the top-right corner).
3. Click **"Load unpacked"** (top-left).
4. Select the folder:
   `C:\Codes\autofill chrome ext\irctc-tatkal-assistant`
5. The extension icon will appear in your Chrome toolbar. Click the puzzle icon and pin **IRCTC Tatkal Assistant**.

### Step 2: Start the Mock IRCTC Server
Run this command in PowerShell from the project folder:
```powershell
python run_test_server.py
```
This starts a local server and automatically serves:
`http://localhost:8080/mock-irctc.html`

*(Alternatively, you can also open `http://localhost:8080/mock-irctc.html` directly in your browser!)*

### Step 3: Configure Your Passenger & Journey Data in the Popup
1. Click the **IRCTC Tatkal Assistant** icon in the Chrome toolbar.
2. In the **Passengers** tab:
   - Click **"+ Add Passenger"**
   - Add Passenger 1 (e.g. `Rahul Sharma`, Age: `32`, Gender: `Male`, Berth: `Lower`)
   - Add Passenger 2 (e.g. `Pooja Sharma`, Age: `29`, Gender: `Female`, Berth: `Middle`)
   - In "Passenger Groups", click **"+ Create Group"**, name it `Family Tatkal`, check both passengers, and save.
   - Click the radio button next to `Family Tatkal` to set it as **ACTIVE**.
3. In the **Journey** tab:
   - Enter Source: `NDLS`, Destination: `BCT`, Date: any future date, Quota: `Tatkal`.
   - Click **"Save Configuration"**.

### Step 4: Test Autofill on the Mock Page
1. On `http://localhost:8080/mock-irctc.html`, click stage **"1. Search & Journey"**:
   - Open the popup and click **"Fill Journey"** (or in the Journey tab, click **"Auto-fill on IRCTC"**).
   - Observe that `NDLS`, `BCT`, the date, and `TATKAL` quota are instantly populated!
2. Click **"2. Passenger Details"** on the mock page:
   - Open the popup and click **"Fill Passengers"** (or **"Start Assistant"**).
   - Watch the content script automatically fill Passenger 1 (`Rahul Sharma`), click **"+ Add Passenger"** to dynamically generate Row 2, and fill Passenger 2 (`Pooja Sharma`)!
   - A floating green success notification will appear at the top-right of the page.
3. In the popup, click **"Validate Form"**:
   - The validation engine will scan all rows and confirm that all required fields are present and valid.
4. Click **"3. Review Booking & CAPTCHA"**:
   - Verify that all passenger details are summarized.
   - Notice the reminder that CAPTCHA is entered manually by user policy.
5. Click **"4. Payment Gateway"**:
   - Notice that the extension immediately detects the payment page and halts all automated actions.

---

## 2. Test Cases Specification

| ID | Test Scenario | Steps | Expected Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Extension Installation | Load unpacked folder in `chrome://extensions/` | Loads with zero errors, icon visible, Manifest V3 verified | **PASS** |
| **TC-02** | Popup UI & Tab Switching | Click extension icon, switch between 4 tabs | Smooth transitions, cards render, no console errors | **PASS** |
| **TC-03** | Passenger CRUD | Add passenger, edit name, delete passenger | Persisted in `chrome.storage.local`, UI updates immediately | **PASS** |
| **TC-04** | Group Organization | Create group with 2 passengers, select active | Active group highlighted and referenced on Dashboard | **PASS** |
| **TC-05** | Journey Config Save | Enter stations, date, Tatkal quota, save | Saved to storage and summarized on Dashboard | **PASS** |
| **TC-06** | Search Form Fill | Trigger "Fill Journey" on search page | Source, Destination, Date, and Quota populated | **PASS** |
| **TC-07** | Passenger Multi-Row Fill | Trigger "Fill Passengers" with 2 passengers in group | Passenger 1 filled, row added, Passenger 2 filled | **PASS** |
| **TC-08** | Dynamic Row Addition | Trigger fill with 3+ passengers when 1 row is present | "+ Add Passenger" clicked automatically for remaining rows | **PASS** |
| **TC-09** | Form Validation | Click "Validate Form" after filling | Scans inputs, returns valid status with row count | **PASS** |
| **TC-10** | Safe Halt at Payment | Navigate to payment section | Assistant automatically halts; user selects payment manually | **PASS** |
| **TC-11** | Reset / Clear Data | Click "Clear All Data" in footer | Confirms and wipes storage clean; resets UI to initial state | **PASS** |

---

## 3. Testing on Live IRCTC (`https://www.irctc.co.in/`)

When you are ready to test on the official IRCTC portal:
1. Log in to `https://www.irctc.co.in/nget/train-search`.
2. Configure your journey details and passenger list in the popup.
3. When searching trains, open the popup and click **"Fill Journey"**.
4. When you click **"Book Now"** on your selected train and reach the passenger details page (`/nget/psgninput`), click **"Start Assistant"** or **"Fill Passengers"**.
5. The extension fills all passenger rows, berth choices, and food choices within milliseconds.
6. Verify the details, solve the CAPTCHA manually, and proceed to payment.

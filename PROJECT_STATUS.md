# IRCTC Tatkal Booking Assistant — Project Status

> [!NOTE]
> This document provides a high-level snapshot of the project's current state, progress, and upcoming work. Single source of truth for the project.

## Project Overview

| Field             | Value                                                    |
|-------------------|----------------------------------------------------------|
| **Project Name**  | IRCTC Tatkal Booking Assistant                           |
| **Type**          | Chrome Extension (Manifest V3)                           |
| **Objective**     | Reduce manual work during IRCTC Tatkal ticket booking by auto-filling passenger details, selecting train & class, clicking Book Now, and navigating to payment |
| **Version**       | 1.1.6                                                    |
| **Current Phase** | Complete Auto-Pilot Train Selection & Hands-Free Booking Release |
| **Completion**    | 100% (Core Extension, Auto-Pilot Engine, Test Bench & Documentation Complete) |
| **Last Updated**  | 2026-11-16                                               |

---

## What This Extension Does

- **Passenger Profile Management**: Stores passenger profiles (name, age, gender, berth preference, food preference, nationality, ID) locally via Chrome Storage API.
- **Journey Configuration**: Configures source, destination, date, train number/name, travel class (including "All Classes"), and Tatkal/General quota.
- **Passenger Groups**: Organizes passengers into customizable Groups with active group selection.
- **Multi-Stage Page Detection**: Detects all IRCTC booking stages (Search, Train List, Passenger Entry, Review, Payment).
- **Search Autofill**: Populates station codes, converts dates to `DD/MM/YYYY`, selects Quota and Class in PrimeNG dropdowns.
- **Auto-Pilot Train Selection & Booking Engine**:
  - Automatically identifies configured train on `/nget/train-list` (or first train if blank).
  - Automatically selects configured class (or first class if "All Classes") on the matched train card.
  - Automatically refreshes seat availability with full mouse event emulation.
  - Automatically selects available date slots and clicks enabled `Book Now`.
  - Automatically confirms any booking condition dialogs (`p-confirmdialog` / "Yes").
- **Passenger Form Autofill**: Populates passenger fields, dynamic "+ Add Passenger" rows, berth preferences, and food choices.
- **Booking Preferences**: Automatically checks "Book only if confirm berths are allotted", "Consider for Auto Upgradation", and selects UPI payment mode.
- **Review Page Assistant**: Focuses and highlights CAPTCHA field with an audio alert.
- **Automated Payment Halt**: Strictly halts automated actions upon reaching `/nget/payment`.
- **Offline Simulation Test Bench**: Includes `mock-irctc.html` + `run_test_server.py` for comprehensive local testing.

## What This Extension Does NOT Do (Security & Ethics Safeguards)

> [!CAUTION]
> In strict compliance with security standards, the extension **never**:
> - Bypasses or solves CAPTCHA challenges (user must solve manually).
> - Bypasses OTP verification.
> - Automates payment authorization or stores banking/card/UPI credentials.
> - Skips or jumps IRCTC queues or rate limits.
> - Interacts with private or unauthorized endpoints.

---

## Feature Completion Matrix

| # | Feature | Status |
|---|---|---|
| 1 | Chrome Manifest V3 configuration (`manifest.json`) | ✅ Done |
| 2 | Popup UI with 4-tab navigation (Dashboard, Passengers, Journey, Assistant) | ✅ Done |
| 3 | Auto-Pilot hero card and quick controls | ✅ Done |
| 4 | Passenger Profile CRUD (Create, Read, Update, Delete) | ✅ Done |
| 5 | Passenger Group management and active group selection | ✅ Done |
| 6 | Journey configuration with "All Classes" support | ✅ Done |
| 7 | Chrome Storage API abstraction module (`storage.js`) | ✅ Done |
| 8 | Angular DOM setters and utility functions (`utils.js`) | ✅ Done |
| 9 | Background service worker message routing (`background.js`) | ✅ Done |
| 10 | Multi-stage IRCTC page detector (`content.js`) | ✅ Done |
| 11 | Journey detail autofill on IRCTC search page (`content.js`) | ✅ Done |
| 12 | Train card & class box targeting on `/nget/train-list` (`content.js`) | ✅ Done |
| 13 | Seat availability refresh & Book Now auto-click (`content.js`) | ✅ Done |
| 14 | "Book only if confirm berths are allotted" & Auto Upgradation | ✅ Done |
| 15 | Passenger form autofill with multi-row expansion (`content.js`) | ✅ Done |
| 16 | Review page CAPTCHA highlighting and audio beep (`content.js`) | ✅ Done |
| 17 | Automated safety halt at payment page (`content.js`) | ✅ Done |
| 18 | Floating real-time notification engine | ✅ Done |
| 19 | Local IRCTC simulation test bench (`mock-irctc.html`) | ✅ Done |
| 20 | Complete documentation suite (8 required Markdown files) | ✅ Done |

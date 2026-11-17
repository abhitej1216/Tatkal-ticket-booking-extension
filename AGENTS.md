# Mandatory Rules for AI Coding Agents

All AI coding assistants (Claude Code, Cursor, ChatGPT, Codex, Antigravity, etc.) working on this repository must strictly observe the following 14 principles:

---

## 1. Context First
Always read `PROJECT_STATUS.md`, `DEVELOPMENT.md`, `TASKS.md`, `ARCHITECTURE.md`, and `HANDOFF.md` before making any code modifications.

## 2. Inspect Before Overwriting
Never blindly create or replace existing files. Inspect existing implementations to preserve working features and maintain consistent conventions.

## 3. Do Not Rewrite Working Code Unnecessarily
Refactor only when strictly needed to fulfill an explicit requirement or fix a bug. Maintain documentation integrity and keep existing comments intact.

## 4. Architecture Compliance
Respect the Chrome Extension Manifest V3 boundaries:
- `popup.js` must never attempt direct DOM manipulation on target tabs; it must communicate via `background.js` or `chrome.tabs.sendMessage`.
- `content.js` must never store sensitive passwords or bypass page boundaries.

## 5. Angular Framework Compatibility
IRCTC runs on Angular. Direct DOM assignments like `input.value = "val"` do not trigger Angular's form validation. Always use `IRCTCUtils.setNativeValue()` or dispatch full synthetic `input`, `change`, and `blur` events with `bubbles: true`.

## 6. Zero Dependencies
Keep the extension lightweight. Do not introduce heavy npm packages, Webpack/Vite bundlers, or external CSS/JS libraries unless explicitly instructed.

## 7. Absolute Security & Ethics Policy
Under **NO circumstances** shall an agent implement:
- Automated CAPTCHA solving, OCR scraping, or CAPTCHA bypass.
- Automated OTP interception or auto-submission.
- Automated payment execution, card number entry, or banking credential storage.
- Queue-jumping, rate-limit bypassing, or unauthorized endpoint exploitation.

## 8. Hard Stop at Payment
The extension must halt automated operations the instant the user reaches the payment gateway or bank selection page.

## 9. Maintain Error Resilience
Always check if DOM elements exist before accessing properties. Use `waitForElement` and fallback selector arrays.

## 10. Test Every Change
Whenever a change is made, test it against the local test bench (`mock-irctc.html`) or live test cases described in `TESTING.md`.

## 11. Honest Progress Reporting
Never mark a task in `TASKS.md` as completed unless it has been implemented and tested. Report unverified features honestly.

## 12. Local-Only Storage
All persistent data must be saved through `chrome.storage.local`. Never send user information to external servers or remote endpoints.

## 13. Documentation Maintenance
Update `PROJECT_STATUS.md`, `CHANGELOG.md`, `TASKS.md`, and `HANDOFF.md` after every significant milestone.

## 14. Smooth Handoff
Before concluding a work session, update `HANDOFF.md` with:
- Exact state of the project.
- Work completed during the session.
- Any known limitations or remaining items.
- Clear, actionable next steps for the incoming agent.

// ===========================================================================
// IRCTC Tatkal Booking Assistant - Content Script (content.js)
// Runs on https://www.irctc.co.in/* pages (and local test pages).
// Depends on utils.js (IRCTCUtils) and storage.js (IRCTCStorage)
// ===========================================================================

'use strict';

/**
 * Page state identifiers
 */
const PAGE_STATE = Object.freeze({
  UNKNOWN: 'unknown',
  LOGIN: 'login',
  SEARCH: 'search',
  TRAIN_LIST: 'trainList',
  PASSENGER_FORM: 'passengerForm',
  REVIEW: 'review',
  PAYMENT: 'payment',
  CONFIRMATION: 'confirmation',
});

/**
 * Main IRCTC Autofill Controller
 */
class IRCTCAutofill {
  constructor() {
    this.state = {
      isActive: false,
      isAutoPilot: false,
      filledPassengers: 0,
      errors: [],
      currentPage: PAGE_STATE.UNKNOWN,
    };

    this.observer = null;
    this._observerDebounceTimer = null;

    // Bind message handler
    this._onMessage = this._handleMessage.bind(this);
    chrome.runtime.onMessage.addListener(this._onMessage);

    // Initial page detection
    this.state.currentPage = this._detectPage();
    this.setupObserver();

    console.log('[IRCTC Tatkal Assistant] Content script initialized. Detected page:', this.state.currentPage);

    // Auto-resume Auto-Pilot if active across page transitions
    chrome.storage.local.get(['autoPilotActive'], (res) => {
      if (res && res.autoPilotActive) {
        this.state.isAutoPilot = true;
        this.state.isActive = true;
        console.log('[IRCTC Tatkal Assistant] Auto-Pilot active from storage. Triggering page action on:', this.state.currentPage);
        setTimeout(() => {
          this.runCurrentStageAction();
        }, 1200);
      }
    });
  }

  // ── Page Detection ─────────────────────────────────────────────────────────

  _detectPage() {
    const url = window.location.href;

    // Payment (check early)
    if (
      url.includes('/nget/payment') ||
      url.includes('/payment') ||
      document.querySelector('.payment-opt') ||
      document.querySelector('.bank-list') ||
      document.querySelector('app-payment-options') ||
      document.querySelector('#payment-section')
    ) {
      return PAGE_STATE.PAYMENT;
    }

    // Confirmation / PNR
    if (
      url.includes('/nget/booking/pnr') ||
      url.includes('/confirm') ||
      document.querySelector('.pnr-display') ||
      document.querySelector('.booking-confirmation') ||
      document.querySelector('#confirmation-section')
    ) {
      return PAGE_STATE.CONFIRMATION;
    }

    // Review page
    if (
      url.includes('/nget/booking/review') ||
      url.includes('/nget/review') ||
      document.querySelector('.review-container') ||
      document.querySelector('app-booking-summary') ||
      document.querySelector('#review-section')
    ) {
      return PAGE_STATE.REVIEW;
    }

    // Passenger details form
    if (
      url.includes('/nget/booking/psgninput') ||
      url.includes('/nget/psgninput') ||
      url.includes('/psgninput') ||
      url.includes('/passenger') ||
      document.querySelector('app-passenger') ||
      document.querySelector('app-passenger-details') ||
      document.querySelector('.passenger-form') ||
      document.querySelector('.psgn-row') ||
      document.querySelector('p-autocomplete[formcontrolname="passengerName"]') ||
      document.querySelector('input[formcontrolname="passengerName"]') ||
      document.querySelector('#passenger-form-section')
    ) {
      return PAGE_STATE.PASSENGER_FORM;
    }

    // Train list / selection
    if (
      url.includes('/nget/train-list') ||
      document.querySelector('.train-list') ||
      document.querySelector('.bull-back') ||
      document.querySelector('app-train-list') ||
      document.querySelector('#train-list-section')
    ) {
      return PAGE_STATE.TRAIN_LIST;
    }

    // Login page
    if (
      url.includes('/nget/login') ||
      document.querySelector('.loginCont') ||
      document.querySelector('#userId') ||
      document.querySelector('input[formcontrolname="userId"]')
    ) {
      return PAGE_STATE.LOGIN;
    }

    // Search / Home page
    if (
      url.includes('/nget/train-search') ||
      url.endsWith('/nget') ||
      url.endsWith('/nget/') ||
      document.querySelector('.city-icon') ||
      document.querySelector('app-jp-input') ||
      document.querySelector('#origin') ||
      document.querySelector('#sourceStation') ||
      document.querySelector('input[aria-label*="From"]')
    ) {
      return PAGE_STATE.SEARCH;
    }

    return PAGE_STATE.UNKNOWN;
  }

  getPageState() {
    this.state.currentPage = this._detectPage();
    return {
      pageState: this.state.currentPage,
      url: window.location.href,
      isActive: this.state.isActive,
      filledPassengers: this.state.filledPassengers,
      errors: [...this.state.errors],
    };
  }

  // ── Lifecycle: start / stop ────────────────────────────────────────────────

  async start() {
    this.state.isActive = true;
    this.state.errors = [];
    this.state.filledPassengers = 0;

    const page = this._detectPage();
    this.state.currentPage = page;

    try {
      if (page === PAGE_STATE.PASSENGER_FORM) {
        await this.fillPassengerForm();
      } else if (page === PAGE_STATE.SEARCH) {
        await this.fillJourneyDetails();
      } else if (page === PAGE_STATE.PAYMENT) {
        this._notify(
          'Payment Page Reached',
          'Automated actions stopped. Please select payment method manually.',
          'warning'
        );
        this.stop();
      } else if (page === PAGE_STATE.TRAIN_LIST) {
        this._notify(
          'Selecting Train 🚆',
          'Locating configured train and class...',
          'info'
        );
        return await this.handleAutoPilotTrainList();
      } else {
        this._notify(
          'Assistant Active',
          `Current page: "${page}". Navigate to Train Search or Passenger Entry to autofill.`,
          'info'
        );
      }
    } catch (err) {
      this.state.errors.push(err.message);
      this._notify('Autofill Error', err.message, 'error');
      console.error('[IRCTC Tatkal Assistant] start() error:', err);
    }
  }

  stop() {
    this.state.isActive = false;
    this.state.isAutoPilot = false;
    chrome.storage.local.set({ autoPilotActive: false });
    this._disconnectObserver();
    this._notify('Assistant Stopped', 'Autofill operations halted.', 'info');
  }

  // ── Journey Details Filling ────────────────────────────────────────────────

  async fillJourneyDetails() {
    console.log('[IRCTC Tatkal Assistant] Filling journey details on search page...');
    let config = null;

    if (window.IRCTCStorage && typeof window.IRCTCStorage.getJourneyConfig === 'function') {
      config = await window.IRCTCStorage.getJourneyConfig();
    } else {
      const stored = await chrome.storage.local.get(['journeyConfig']);
      config = stored.journeyConfig;
    }

    if (!config || !config.source || !config.destination) {
      this._notify('Journey Config Missing', 'Please configure Source and Destination in extension popup.', 'error');
      return { success: false, error: 'No journey config' };
    }

    // 1. Fill Source Station
    const sourceSelectors = [
      '#origin input',
      'p-autocomplete[id*="origin"] input',
      'input[aria-label*="From"]',
      'input[placeholder*="From*"]',
      '#sourceStation',
      'input[formcontrolname="origin"]',
      '.ui-autocomplete-input[placeholder*="From"]'
    ];
    await this._fillAutocompleteField(sourceSelectors, config.source);
    await this._delay(300);

    // 2. Fill Destination Station
    const destSelectors = [
      '#destination input',
      'p-autocomplete[id*="destination"] input',
      'input[aria-label*="To"]',
      'input[placeholder*="To*"]',
      '#destStation',
      'input[formcontrolname="destination"]',
      '.ui-autocomplete-input[placeholder*="To"]'
    ];
    await this._fillAutocompleteField(destSelectors, config.destination);
    await this._delay(300);

    // 3. Fill Journey Date (Format MUST be DD/MM/YYYY for IRCTC)
    if (config.date) {
      const formattedDate = window.IRCTCUtils
        ? window.IRCTCUtils.formatToIRCTCDate(config.date)
        : config.date;

      console.log(`[IRCTC Tatkal Assistant] Setting date to: ${formattedDate} (raw: ${config.date})`);

      // Parse target day, month, year from formattedDate (DD/MM/YYYY)
      const dateParts = formattedDate.split('/');
      const targetDay = parseInt(dateParts[0], 10);
      const targetMonth = parseInt(dateParts[1], 10);
      const targetYear = parseInt(dateParts[2], 10);

      const dateSelectors = [
        'p-calendar[formcontrolname="journeyDate"] input',
        '#jDate input',
        'p-calendar input',
        'input[placeholder*="DD/MM/YYYY"]',
        'input[placeholder*="Journey Date"]',
        'input[aria-label*="Journey Date"]',
        '#journeyDate',
        'input[type="date"]'
      ];

      for (const sel of dateSelectors) {
        const dateInput = document.querySelector(sel);
        if (dateInput) {
          dateInput.focus();
          dateInput.click();
          await this._delay(250);

          // Check if calendar overlay opened
          let daySelected = false;
          const overlay = document.querySelector('.p-datepicker, .ui-datepicker, p-calendar .p-datepicker');
          if (overlay) {
            // Month navigation if target is future month
            const now = new Date();
            const curMonth = now.getMonth() + 1;
            const curYear = now.getFullYear();
            const monthDiff = (targetYear - curYear) * 12 + (targetMonth - curMonth);
            if (monthDiff > 0 && monthDiff <= 4) {
              for (let m = 0; m < monthDiff; m++) {
                const nextBtn = document.querySelector('.p-datepicker-next, .ui-datepicker-next, button.p-datepicker-next');
                if (nextBtn) {
                  if (window.IRCTCUtils && typeof window.IRCTCUtils.clickElement === 'function') {
                    window.IRCTCUtils.clickElement(nextBtn);
                  } else {
                    nextBtn.click();
                  }
                  await this._delay(150);
                }
              }
            }

            // Click the day number in the calendar grid
            const dayCells = Array.from(document.querySelectorAll(
              '.p-datepicker-calendar td:not(.p-datepicker-other-month) span, ' +
              '.p-datepicker-calendar td:not(.p-datepicker-other-month) a, ' +
              '.ui-datepicker-calendar td:not(.ui-datepicker-other-month) a, ' +
              '.ui-datepicker-calendar td:not(.ui-datepicker-other-month) span'
            ));

            for (const cell of dayCells) {
              if ((cell.textContent || '').trim() === String(targetDay)) {
                console.log(`[IRCTC Tatkal Assistant] Clicked day ${targetDay} in calendar!`);
                if (window.IRCTCUtils && typeof window.IRCTCUtils.clickElement === 'function') {
                  window.IRCTCUtils.clickElement(cell);
                } else {
                  cell.click();
                }
                daySelected = true;
                await this._delay(200);
                break;
              }
            }
          }

          // Also set native value directly on the input to ensure model synchronization
          dateInput.focus();
          if (dateInput.select) dateInput.select();

          if (window.IRCTCUtils && typeof window.IRCTCUtils.setNativeValue === 'function') {
            window.IRCTCUtils.setNativeValue(dateInput, formattedDate);
          } else {
            dateInput.value = formattedDate;
            dateInput.dispatchEvent(new Event('input', { bubbles: true }));
            dateInput.dispatchEvent(new Event('change', { bubbles: true }));
          }

          // Trigger Enter key to commit reactive model in PrimeNG
          dateInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          dateInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
          dateInput.dispatchEvent(new Event('change', { bubbles: true }));
          await this._delay(150);
          break;
        }
      }
    }

    // 4. Fill Quota (TATKAL, GENERAL, PREMIUM TATKAL, LADIES, etc.)
    if (config.quota) {
      console.log(`[IRCTC Tatkal Assistant] Setting quota to: ${config.quota}`);
      const quotaSelectors = [
        '#journeyQuota',
        'p-dropdown[formcontrolname="journeyQuota"]',
        '#journeyQuota .p-dropdown-trigger',
        '#journeyQuota select',
        'p-dropdown[id*="journeyQuota"]',
        'select[formcontrolname="journeyQuota"]',
        '#quotaSelect'
      ];
      for (const sel of quotaSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          await this.selectDropdown(el, config.quota);
          break;
        }
      }
    }

    // 5. Fill Travel Class (SL, 3A, 2A, 1A, CC, 2S, etc.)
    if (config.travelClass) {
      console.log(`[IRCTC Tatkal Assistant] Setting class to: ${config.travelClass}`);
      const classSelectors = [
        '#journeyClass',
        'p-dropdown[formcontrolname="journeyClass"]',
        '#journeyClass .p-dropdown-trigger',
        '#journeyClass select',
        'p-dropdown[id*="journeyClass"]',
        'select[formcontrolname="journeyClass"]',
        '#travelClass'
      ];
      for (const sel of classSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          await this.selectDropdown(el, config.travelClass);
          break;
        }
      }
    }

    const dateDisplay = window.IRCTCUtils ? window.IRCTCUtils.formatToIRCTCDate(config.date) : config.date;
    this._notify(
      'Journey Details Filled!',
      `${config.source} ➔ ${config.destination} (${dateDisplay}) [Quota: ${config.quota || 'TATKAL'}]. Click "Search Trains" to view trains!`,
      'success'
    );

    return { success: true };
  }

  async _fillAutocompleteField(selectors, value) {
    let inputEl = null;
    for (const sel of selectors) {
      inputEl = document.querySelector(sel);
      if (inputEl) break;
    }

    if (!inputEl) {
      console.warn('[IRCTC Tatkal Assistant] Station input not found for selectors:', selectors);
      return false;
    }

    inputEl.focus();
    inputEl.click();
    await this._delay(100);

    if (inputEl.setSelectionRange) {
      inputEl.setSelectionRange(0, inputEl.value.length);
    }

    if (window.IRCTCUtils) {
      window.IRCTCUtils.setNativeValue(inputEl, value);
    } else {
      inputEl.value = value;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Wait for PrimeNG autocomplete suggestions dropdown to appear, then click the match
    await this._delay(500);
    const dropdownOptions = document.querySelectorAll(
      '.ui-autocomplete-list-item, .p-autocomplete-item, .mat-option, [role="option"]'
    );
    if (dropdownOptions.length > 0) {
      // Find matching option or select first
      const valUpper = value.trim().toUpperCase();
      let matched = false;
      for (const opt of dropdownOptions) {
        if ((opt.textContent || '').toUpperCase().includes(valUpper)) {
          opt.click();
          matched = true;
          break;
        }
      }
      if (!matched) {
        dropdownOptions[0].click();
      }
    } else {
      // Press enter to confirm
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    }

    return true;
  }

  // ── Passenger Form Autofill ────────────────────────────────────────────────

  async fillPassengerForm() {
    console.log('[IRCTC Tatkal Assistant] Filling passenger form on booking page...');

    // Retrieve active group and passengers
    let passengers = [];
    let activeGroupId = null;

    if (window.IRCTCStorage) {
      const allPassengers = await window.IRCTCStorage.getPassengers();
      const groups = await window.IRCTCStorage.getGroups();
      activeGroupId = await window.IRCTCStorage.getActiveGroup();

      if (activeGroupId && groups.length > 0) {
        const activeGroup = groups.find((g) => g.id === activeGroupId);
        if (activeGroup && Array.isArray(activeGroup.passengerIds) && activeGroup.passengerIds.length > 0) {
          passengers = allPassengers.filter((p) => activeGroup.passengerIds.includes(p.id));
        }
      }
      if (passengers.length === 0) {
        passengers = allPassengers; // Fallback to all saved passengers
      }
    } else {
      const stored = await chrome.storage.local.get(['passengers', 'groups', 'activeGroupId']);
      const allPassengers = stored.passengers || [];
      const groups = stored.groups || [];
      activeGroupId = stored.activeGroupId;

      if (activeGroupId && groups.length > 0) {
        const activeGroup = groups.find((g) => g.id === activeGroupId);
        if (activeGroup && Array.isArray(activeGroup.passengerIds) && activeGroup.passengerIds.length > 0) {
          passengers = allPassengers.filter((p) => activeGroup.passengerIds.includes(p.id));
        }
      }
      if (passengers.length === 0) {
        passengers = allPassengers;
      }
    }

    if (!passengers || passengers.length === 0) {
      this._notify('No Passengers Configured', 'Please open extension popup and add your passenger details.', 'error');
      return { success: false, error: 'No passengers found' };
    }

    // Identify passenger rows on page
    const rowSelectors = [
      'app-passenger',
      'app-passenger-details',
      '.psgn-row',
      '.passenger-row',
      '.psgn-form-row',
      'tr.passenger-data-row',
      '[formarrayname="passengerList"] > div',
      '.passenger-entry'
    ];

    let rows = [];
    for (const sel of rowSelectors) {
      const found = document.querySelectorAll(sel);
      if (found.length > 0) {
        rows = Array.from(found);
        break;
      }
    }

    // Fallback: Check for passenger name inputs directly
    if (rows.length === 0) {
      const nameInputs = document.querySelectorAll(
        'p-autocomplete[formcontrolname="passengerName"], input[formcontrolname="passengerName"], #passengerName, input[placeholder*="Passenger Name"]'
      );
      if (nameInputs.length > 0) {
        rows = Array.from(nameInputs).map((el) => el.closest('app-passenger') || el.closest('tr') || el.closest('.form-group')?.parentElement || el.parentElement);
      }
    }

    if (rows.length === 0) {
      this._notify('Passenger Form Not Ready', 'Please select a train and click "Book Now" first to open passenger form.', 'warning');
      return { success: false, error: 'No passenger input rows detected' };
    }

    let filledCount = 0;

    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];

      // If we need another row, click "+ Add Passenger"
      if (i >= rows.length) {
        const added = await this._clickAddPassenger();
        if (added) {
          await this._delay(500);
          // Re-query rows
          for (const sel of rowSelectors) {
            const found = document.querySelectorAll(sel);
            if (found.length > rows.length) {
              rows = Array.from(found);
              break;
            }
          }
        }
      }

      const currentRow = rows[i] || rows[rows.length - 1];
      if (!currentRow) break;

      const success = await this._fillSinglePassengerRow(currentRow, p, i);
      if (success) {
        filledCount++;
      }
      await this._delay(150);
    }

    this.state.filledPassengers = filledCount;

    // Validate the result
    const validation = this.validateForm();
    if (validation.valid) {
      this._notify('Passenger Details Filled!', `Successfully filled ${filledCount} passenger(s). Ready for review!`, 'success');
    } else {
      this._notify('Filled With Warnings', `Filled ${filledCount} passenger(s). Please verify any highlighted fields.`, 'warning');
    }

    return { success: true, filledPassengers: filledCount, validation };
  }

  async _fillSinglePassengerRow(row, passenger, index) {
    try {
      // 1. Name (Handles PrimeNG p-autocomplete and standard inputs)
      const nameInput = row.querySelector(
        'p-autocomplete[formcontrolname="passengerName"] input, input[formcontrolname="passengerName"], input[placeholder*="Passenger Name"], input[placeholder*="Name"], .psgn-name input, input[name*="name"]'
      );
      if (nameInput) {
        nameInput.focus();
        nameInput.click();
        this._setInputValue(nameInput, passenger.name);
        await this._delay(100);
        // Dispatch enter/tab
        nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, bubbles: true }));
      }

      // 2. Age
      const ageInput = row.querySelector(
        'input[formcontrolname="passengerAge"], input[placeholder*="Age"], input[type="number"], .psgn-age input, input[name*="age"]'
      );
      if (ageInput) {
        ageInput.focus();
        ageInput.click();
        this._setInputValue(ageInput, String(passenger.age));
        await this._delay(100);
      }

      // 3. Gender
      const genderSelect = row.querySelector(
        'select[formcontrolname="passengerGender"], p-dropdown[formcontrolname="passengerGender"], select[id*="gender"], p-dropdown[id*="gender"], .psgn-gender select'
      );
      if (genderSelect) {
        await this.selectDropdown(genderSelect, passenger.gender);
      }

      // 4. Berth Preference
      if (passenger.berthPreference && passenger.berthPreference !== 'No Preference') {
        const berthSelect = row.querySelector(
          'select[formcontrolname="passengerBerthChoice"], p-dropdown[formcontrolname="passengerBerthChoice"], select[id*="berth"], p-dropdown[id*="berth"], .psgn-berth select'
        );
        if (berthSelect) {
          await this.selectDropdown(berthSelect, passenger.berthPreference);
        }
      }

      // 5. Food Preference (if applicable)
      if (passenger.foodPreference && passenger.foodPreference !== 'No Food') {
        const foodSelect = row.querySelector(
          'select[formcontrolname="passengerFoodChoice"], p-dropdown[formcontrolname="passengerFoodChoice"], select[id*="food"], p-dropdown[id*="food"], .psgn-food select'
        );
        if (foodSelect) {
          await this.selectDropdown(foodSelect, passenger.foodPreference);
        }
      }

      // 6. Nationality (if required)
      if (passenger.nationality) {
        const natInput = row.querySelector(
          'select[formcontrolname="passengerNationality"], p-dropdown[formcontrolname="passengerNationality"], input[formcontrolname="passengerNationality"], select[id*="nationality"]'
        );
        if (natInput) {
          if (natInput.tagName === 'SELECT' || natInput.tagName === 'P-DROPDOWN') {
            await this.selectDropdown(natInput, passenger.nationality);
          } else {
            this._setInputValue(natInput, passenger.nationality);
          }
        }
      }

      return true;
    } catch (err) {
      console.error(`[IRCTC Tatkal Assistant] Error filling passenger ${index + 1}:`, err);
      return false;
    }
  }

  async _clickAddPassenger() {
    const addSelectors = [
      'a span.prenext',
      'span.prenext',
      'a.prenext',
      'a[aria-label*="Add Passenger"]',
      'button[aria-label*="Add Passenger"]',
      '.add-passenger-btn',
      '#addPassenger',
      '.train-table-action a'
    ];

    for (const sel of addSelectors) {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.click();
        return true;
      }
    }

    // Try finding by button text content
    const buttons = document.querySelectorAll('button, a, span');
    for (const b of buttons) {
      if (b.textContent && b.textContent.trim().toLowerCase().includes('add passenger')) {
        b.click();
        return true;
      }
    }

    return false;
  }

  _setInputValue(element, value) {
    if (window.IRCTCUtils && typeof window.IRCTCUtils.setNativeValue === 'function') {
      window.IRCTCUtils.setNativeValue(element, value);
    } else {
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  }

  async selectDropdown(selectEl, value) {
    if (!selectEl || !value) return false;

    if (window.IRCTCUtils && typeof window.IRCTCUtils.selectDropdownOption === 'function') {
      return await window.IRCTCUtils.selectDropdownOption(selectEl, value);
    }

    // Fallback: Native <select>
    if (selectEl.tagName === 'SELECT') {
      const options = Array.from(selectEl.options);
      const match = options.find((opt) =>
        opt.value.toLowerCase() === value.toLowerCase() ||
        opt.textContent.trim().toLowerCase().includes(value.toLowerCase())
      );
      if (match) {
        selectEl.value = match.value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        selectEl.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    }

    return false;
  }

  // ── Validation ─────────────────────────────────────────────────────────────

  validateForm() {
    const errors = [];
    const nameInputs = document.querySelectorAll(
      'p-autocomplete[formcontrolname="passengerName"] input, input[formcontrolname="passengerName"], .psgn-name input, #passengerName'
    );
    const ageInputs = document.querySelectorAll(
      'input[formcontrolname="passengerAge"], .psgn-age input, #passengerAge'
    );

    if (nameInputs.length === 0) {
      return { valid: false, errors: ['No passenger inputs found to validate'] };
    }

    for (let i = 0; i < nameInputs.length; i++) {
      const name = (nameInputs[i].value || '').trim();
      const age = parseInt((ageInputs[i]?.value || '0'), 10);

      if (name.length < 2) {
        errors.push(`Passenger ${i + 1}: Name is empty or too short`);
      }
      if (isNaN(age) || age <= 0 || age > 125) {
        errors.push(`Passenger ${i + 1}: Age must be between 1 and 125`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      validatedRows: nameInputs.length,
    };
  }

  // ── DOM Observer for Angular dynamic renders ───────────────────────────────

  setupObserver() {
    if (this.observer) return;

    this.observer = new MutationObserver(() => {
      if (this._observerDebounceTimer) clearTimeout(this._observerDebounceTimer);
      this._observerDebounceTimer = setTimeout(() => {
        const newPage = this._detectPage();
        if (newPage !== this.state.currentPage) {
          console.log(`[IRCTC Tatkal Assistant] Page transitioned: ${this.state.currentPage} -> ${newPage}`);
          const previousPage = this.state.currentPage;
          this.state.currentPage = newPage;

          // Notify background worker
          chrome.runtime.sendMessage({
            action: 'PAGE_STATE_UPDATE',
            data: { pageState: newPage },
          }).catch(() => {});

          // If Auto-Pilot or Assistant is active, execute stage action automatically!
          if (this.state.isAutoPilot) {
            console.log(`[IRCTC Tatkal Assistant] Auto-Pilot triggering action on: ${newPage}`);
            this.runCurrentStageAction();
          } else if (this.state.isActive) {
            if (newPage === PAGE_STATE.TRAIN_LIST) {
              console.log('[IRCTC Tatkal Assistant] Train list detected while assistant active! Selecting train...');
              this.handleAutoPilotTrainList();
            } else if (newPage === PAGE_STATE.PASSENGER_FORM) {
              console.log('[IRCTC Tatkal Assistant] Passenger form detected while assistant active! Autofilling...');
              this.fillPassengerForm();
            }
          }

          // If payment page reached, stop automated actions immediately
          if (newPage === PAGE_STATE.PAYMENT) {
            this._notify('Payment Page Reached', 'Automated assistant stopped. Please select payment manually.', 'warning');
            this.stop();
          }
        }
      }, 500);
    });

    this.observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  _disconnectObserver() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  // ── Message Dispatcher ─────────────────────────────────────────────────────


  // ── Auto-Pilot Automation Engine ──────────────────────────────────────────

  async startAutoPilot() {
    this.state.isAutoPilot = true;
    this.state.isActive = true;
    chrome.storage.local.set({ autoPilotActive: true });
    console.log('[IRCTC Tatkal Assistant] Auto-Pilot initiated and saved to storage!');
    this._notify('Auto-Pilot Activated 🚀', 'Starting hands-free Tatkal booking pipeline...', 'info');
    await this.runCurrentStageAction();
  }

  async runCurrentStageAction() {
    const page = this._detectPage();
    this.state.currentPage = page;
    console.log(`[IRCTC Tatkal Assistant] Auto-Pilot processing page: ${page}`);

    if (page === PAGE_STATE.SEARCH) {
      await this.handleAutoPilotSearch();
    } else if (page === PAGE_STATE.TRAIN_LIST) {
      await this.handleAutoPilotTrainList();
    } else if (page === PAGE_STATE.PASSENGER_FORM) {
      await this.handleAutoPilotPassengerForm();
    } else if (page === PAGE_STATE.REVIEW) {
      await this.handleAutoPilotReview();
    } else if (page === PAGE_STATE.PAYMENT) {
      this._notify('Payment Page Reached', 'Automation safely halted. Complete payment manually.', 'warning');
      this.stop();
    }
  }

  async handleAutoPilotSearch() {
    this._notify('Step 1: Filling Search', 'Filling station, date, quota, and class...', 'info');
    await this.fillJourneyDetails();
    await this._delay(600);

    // Auto-click Search Trains
    const searchBtnSelectors = [
      'button.search_btn',
      'button[type="submit"]',
      '.train-search-btn',
      'button.btnDefault[type="submit"]',
      'button[label="Find Trains"]',
      'button[label="Search"]',
      '#searchTrains'
    ];

    let searchBtn = null;
    for (const sel of searchBtnSelectors) {
      searchBtn = document.querySelector(sel);
      if (searchBtn) break;
    }
    if (!searchBtn) {
      const allBtns = document.querySelectorAll('button');
      for (const b of allBtns) {
        if ((b.textContent || '').trim().toLowerCase().includes('search')) {
          searchBtn = b;
          break;
        }
      }
    }

    if (searchBtn) {
      this._notify('Searching Trains 🔍', 'Auto-clicking Search Trains button...', 'info');
      searchBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      searchBtn.click();
    } else {
      this._notify('Ready to Search', 'Click "Search Trains" to continue Auto-Pilot.', 'info');
    }
  }

  async handleAutoPilotTrainList() {
    this._notify('Train Selection 🚆', 'Scanning for your configured train and class...', 'info');

    let config = null;
    if (window.IRCTCStorage) {
      config = await window.IRCTCStorage.getJourneyConfig();
    } else {
      const stored = await chrome.storage.local.get(['journeyConfig']);
      config = stored.journeyConfig;
    }

    const trainQuery = ((config && (config.trainNumber || config.trainName)) || '').trim().toUpperCase();
    const rawClass = ((config && config.travelClass) || 'All Classes').trim();

    // Helper: Normalize class to standard code (e.g. "Sleeper (SL)" -> "SL", "3A" -> "3A")
    const getClassCode = (str) => {
      if (!str) return 'ALL';
      const s = str.toUpperCase().trim();
      if (s.includes('ALL')) return 'ALL';
      const m = s.match(/\b(1A|2A|3A|3E|SL|CC|2S|EC|EA)\b/);
      if (m) return m[1];
      if (s.includes('SLEEPER')) return 'SL';
      if (s.includes('FIRST')) return '1A';
      if (s.includes('3 TIER') || s.includes('3-TIER') || s.includes('3TIER')) return '3A';
      if (s.includes('2 TIER') || s.includes('2-TIER') || s.includes('2TIER')) return '2A';
      if (s.includes('ECONOMY')) return '3E';
      if (s.includes('CHAIR')) return 'CC';
      return s;
    };

    const targetClassCode = getClassCode(rawClass);

    // Parse target date components (day & month, e.g. 18 Nov)
    let targetDay = '';
    let targetMonth = '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (config && config.date) {
      const dStr = config.date.trim();
      if (dStr.includes('-')) {
        const parts = dStr.split('-');
        if (parts.length === 3) {
          targetDay = String(parseInt(parts[2], 10));
          const mIdx = parseInt(parts[1], 10) - 1;
          targetMonth = months[mIdx] || '';
        }
      } else if (dStr.includes('/')) {
        const parts = dStr.split('/');
        if (parts.length === 3) {
          targetDay = String(parseInt(parts[0], 10));
          const mIdx = parseInt(parts[1], 10) - 1;
          targetMonth = months[mIdx] || '';
        }
      }
    }

    // Standard DOM click helper - 100% CSP compliant, no inline scripts!
    const triggerClick = (el) => {
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try { el.focus(); } catch (e) {}
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evt) => {
        try {
          const isDown = evt.includes('down');
          el.dispatchEvent(new MouseEvent(evt, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: isDown ? 1 : 0,
            button: 0
          }));
        } catch (e) {}
      });
      try {
        el.click();
      } catch (e) {}
    };

    // 1. Wait for train cards to appear on page (up to 15s)
    let trainCards = [];
    for (let i = 0; i < 30; i++) {
      trainCards = Array.from(document.querySelectorAll('app-train-avl-enq, .train_avl_border_div, .bull-back'));
      if (trainCards.length > 0) break;

      const headings = Array.from(document.querySelectorAll('.train-heading, strong, [class*="train-heading"]'));
      if (headings.length > 0) {
        trainCards = headings.map((h) => {
          let curr = h;
          while (curr && curr !== document.body) {
            if (curr.querySelector && (curr.querySelector('.pre-avail') || curr.querySelector('button') || curr.textContent.includes('Book Now'))) {
              return curr;
            }
            curr = curr.parentElement;
          }
          return h.parentElement;
        }).filter(Boolean);
        if (trainCards.length > 0) break;
      }
      await this._delay(500);
    }

    if (trainCards.length === 0) {
      this._notify('Waiting for Trains...', 'Train list is still loading, please wait...', 'info');
      return { success: false, error: 'No trains on page' };
    }

    // 2. Locate Target Train Card
    let targetCard = null;
    if (trainQuery) {
      for (const card of trainCards) {
        const text = (card.textContent || '').toUpperCase();
        if (text.includes(trainQuery)) {
          targetCard = card;
          break;
        }
      }
    }

    if (!targetCard) {
      targetCard = trainCards[0];
      if (trainQuery) {
        this._notify('Train Fallback', `Train "${trainQuery}" not matched. Selecting first available train.`, 'info');
      }
    }

    if (!targetCard) {
      this._notify('Train Card Error', 'Could not access train card elements.', 'error');
      return { success: false, error: 'Target card null' };
    }

    // Highlight and scroll train card
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const headingEl = targetCard.querySelector('.train-heading, strong, h4, h5, [class*="train-heading"]');
    const trainTitle = (headingEl ? headingEl.textContent : targetCard.textContent.slice(0, 50)).trim().replace(/\s+/g, ' ');
    console.log('[IRCTC Tatkal Assistant] Target train selected:', trainTitle);
    this._notify('Train Located 🚆', `${trainTitle}`, 'info');

    // If targetDay or targetMonth were not parsed from config, infer from train card or header
    if (!targetDay || !targetMonth) {
      const headerText = targetCard.textContent || document.body.textContent;
      const m = headerText.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)?[,\s]*(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i);
      if (m) {
        targetDay = String(parseInt(m[2], 10));
        targetMonth = m[3];
        console.log(`[IRCTC Tatkal Assistant] Inferred target date from page: ${targetDay} ${targetMonth}`);
      }
    }

    // Helper: Find target date availability card
    // MUST have availability status (WL, AVAILABLE, RAC, etc.) so departure time headers are NEVER matched!
    const findTargetDateCard = () => {
      const scope = targetCard || document;
      const statusRegex = /(WL\d*|AVAILABLE|CURR_AVBL|RAC\d*|NOT AVAILABLE|REGRET)/i;
      const dayRe = targetDay ? new RegExp('\\b' + targetDay + '\\b') : null;
      const monthRe = targetMonth ? new RegExp(targetMonth, 'i') : null;
      const timeRegex = /\d{1,2}:\d{2}/;

      // 1. Search known IRCTC date card classes first
      const knownCards = Array.from(scope.querySelectorAll('.train_avl_enq_box, [class*="avl_enq_box"], .date-card'));
      for (const card of knownCards) {
        const txt = (card.textContent || '').trim();
        if (dayRe && monthRe && dayRe.test(txt) && monthRe.test(txt)) {
          return card;
        }
      }

      // 2. Search all container elements that contain target date AND status
      const candidates = [];
      const allEls = Array.from(scope.querySelectorAll('*'));
      for (const el of allEls) {
        const txt = (el.textContent || '').trim();
        if (txt.length < 5 || txt.length > 80 || timeRegex.test(txt) || txt.toUpperCase().includes('RESULTS FOR')) {
          continue;
        }

        const hasDate = dayRe && monthRe ? (dayRe.test(txt) && monthRe.test(txt)) : false;
        const hasStatus = statusRegex.test(txt);

        // ONLY match elements with BOTH date and status
        if (hasDate && hasStatus) {
          candidates.push({ el, len: txt.length });
        }
      }

      if (candidates.length > 0) {
        candidates.sort((a, b) => a.len - b.len);
        return candidates[0].el;
      }

      return null;
    };

    // Helper: Find the class box matching user's travel class on targetCard
    const findClassBox = () => {
      // Collect candidate class boxes
      let candidates = Array.from(
        targetCard.querySelectorAll('.pre-avail, [class*="avail"], div.white-back, div[tabindex], div.col-xs-12, td')
      );

      candidates = candidates.filter((el) => {
        const txt = (el.textContent || '').trim().toUpperCase();
        return (
          /\b(SL|1A|2A|3A|3E|CC|2S|EC|EA)\b/.test(txt) &&
          (txt.includes('REFRESH') || txt.includes('🔄') || /\([0-9A-Z]{2}\)/.test(txt) || txt.includes('AVL') || txt.includes('WL'))
        );
      });

      // Keep innermost candidates
      candidates = candidates.filter((el) => !candidates.some((other) => other !== el && el.contains(other)));

      if (candidates.length === 0) {
        const allDivs = Array.from(targetCard.querySelectorAll('div, td, a')).filter((el) => {
          const txt = (el.textContent || '').trim().toUpperCase();
          return (
            /\b(SL|1A|2A|3A|3E|CC|2S)\b/.test(txt) &&
            (txt.includes('REFRESH') || txt.includes('🔄') || /\([0-9A-Z]{2}\)/.test(txt))
          );
        });
        candidates = allDivs.filter((el) => !allDivs.some((other) => other !== el && el.contains(other)));
      }

      if (candidates.length === 0) return null;

      if (!targetClassCode || targetClassCode === 'ALL') {
        return candidates[0];
      }

      const codeRegex = new RegExp('\\b' + targetClassCode + '\\b', 'i');
      const parenCode = `(${targetClassCode})`;

      for (const box of candidates) {
        const txt = (box.textContent || '').toUpperCase();
        if (txt.includes(parenCode) || codeRegex.test(txt)) {
          return box;
        }
      }

      return candidates[0];
    };

    // 3. Check if target date cards are already open with availability status
    let targetDateCard = findTargetDateCard();

    if (!targetDateCard) {
      // Locate and click the class box to fetch availability
      const classBox = findClassBox();

      if (!classBox) {
        this._notify('Class Box Not Found', `No class boxes found for ${rawClass}.`, 'warning');
        return { success: false, error: 'No class boxes found' };
      }

      const classBoxText = (classBox.textContent || '').trim().replace(/\s+/g, ' ');
      console.log(`[IRCTC Tatkal Assistant] Selecting class box for "${targetClassCode}":`, classBoxText);
      this._notify('Checking Availability 🔄', `Clicking ${classBoxText}...`, 'info');

      // Click the class box and any refresh button/icon inside it
      triggerClick(classBox);
      const innerRefresh = classBox.querySelector('span, a, .fa-repeat, .pi-refresh, .fa-refresh, strong');
      if (innerRefresh) {
        triggerClick(innerRefresh);
      }

      // Wait up to 12s for date cards to load (polling every 400ms)
      for (let wait = 0; wait < 30; wait++) {
        await this._delay(400);
        targetDateCard = findTargetDateCard();
        if (targetDateCard) {
          console.log('[IRCTC Tatkal Assistant] Date availability loaded:', (targetDateCard.textContent || '').trim().replace(/\s+/g, ' '));
          break;
        }

        // If not loaded after 4s (attempt 10) or 8s (attempt 20), re-click class box
        if (wait === 10 || wait === 20) {
          console.log('[IRCTC Tatkal Assistant] Re-clicking class box to ensure enquiry triggers...');
          triggerClick(classBox);
          if (innerRefresh) triggerClick(innerRefresh);
        }
      }
    }

    if (!targetDateCard) {
      this._notify('Availability Pending', 'Availability slots are still loading. Please wait...', 'warning');
    }

    // 4. Actively find and click the target date slot, then wait for Book Now to highlight
    this._notify('Selecting Date Slot 📅', `Clicking ${targetDay} ${targetMonth}...`, 'info');
    console.log(`[IRCTC Tatkal Assistant] Activating date slot for ${targetDay} ${targetMonth}`);

    let bookNowBtn = null;
    let cardClicked = false;

    for (let attempt = 0; attempt < 30; attempt++) {
      const currentCard = findTargetDateCard() || targetDateCard;
      if (currentCard && (!cardClicked || attempt % 6 === 0)) {
        const cardText = (currentCard.textContent || '').trim().replace(/\s+/g, ' ');
        console.log(`[IRCTC Tatkal Assistant] (Attempt ${attempt}) Clicking date slot: ${cardText}`);

        triggerClick(currentCard);
        const innerTextEl = currentCard.querySelector('strong, span, div, a');
        if (innerTextEl) {
          triggerClick(innerTextEl);
        }
        cardClicked = true;
      }

      await this._delay(300);

      // Check if "Book Now" button is present and enabled
      const allButtons = Array.from(
        (targetCard || document).querySelectorAll('button, .btnDefault, [class*="train_Search"], [class*="book-now"]')
      ).concat(
        Array.from(document.querySelectorAll('button.btnDefault.train_Search, button.train_Search, button'))
      );

      for (const b of allButtons) {
        const text = (b.textContent || '').trim().toLowerCase();
        if (text.includes('book now')) {
          const isDisabled =
            b.disabled ||
            b.classList.contains('disabled') ||
            b.classList.contains('disable-book') ||
            b.classList.contains('btn-disabled') ||
            b.getAttribute('aria-disabled') === 'true' ||
            b.getAttribute('disabled') !== null;

          if (!isDisabled) {
            bookNowBtn = b;
            break;
          }
        }
      }

      if (bookNowBtn) {
        console.log('[IRCTC Tatkal Assistant] "Book Now" is enabled & highlighted!');
        break;
      }

      await this._delay(200);
    }

    // Fallback if not marked enabled by class, but button is present after clicking date
    if (!bookNowBtn && cardClicked) {
      const fallbackBtns = Array.from(
        (targetCard || document).querySelectorAll('button.btnDefault.train_Search, button.train_Search, button')
      );
      for (const b of fallbackBtns) {
        const text = (b.textContent || '').trim().toLowerCase();
        if (text.includes('book now')) {
          console.log('[IRCTC Tatkal Assistant] Using fallback Book Now button after date selection');
          bookNowBtn = b;
          break;
        }
      }
    }

    // 5. Click Book Now
    if (bookNowBtn) {
      this._notify('Booking Seat 🎟️', 'Clicking "Book Now"...', 'success');
      triggerClick(bookNowBtn);
      await this._delay(600);

      // 6. Check for Confirmation Dialog (e.g. Waitlist confirmation or "Yes" button)
      for (let d = 0; d < 15; d++) {
        const confirmBtn = document.querySelector(
          'p-confirmdialog button.ui-button-success, .ui-confirmdialog-acceptbutton, p-confirmdialog button:not(.ui-button-secondary), .ui-dialog-footer button, .p-dialog-footer button'
        );
        if (confirmBtn) {
          triggerClick(confirmBtn);
          break;
        }
        const dialogButtons = document.querySelectorAll('.ui-dialog button, p-confirmdialog button, .modal button, .p-dialog button');
        for (const db of dialogButtons) {
          const txt = (db.textContent || '').trim().toLowerCase();
          if (txt === 'yes' || txt === 'i agree' || txt.includes('continue')) {
            triggerClick(db);
            break;
          }
        }
        await this._delay(300);
      }

      // Keep auto-pilot active for passenger form
      chrome.storage.local.set({ autoPilotActive: true });
      return { success: true };
    } else {
      this._notify('Action Needed', 'Selected date! Click "Book Now" to proceed.', 'warning');
      return { success: false, error: 'Book Now not enabled' };
    }
  }

      async handleAutoPilotPassengerForm() {
    this._notify('Step 3: Autofilling Passengers', 'Entering passenger details...', 'info');

    // Fill passengers
    await this.fillPassengerForm();
    await this._delay(400);

    let config = null;
    if (window.IRCTCStorage) {
      config = await window.IRCTCStorage.getJourneyConfig();
    } else {
      const stored = await chrome.storage.local.get(['journeyConfig']);
      config = stored.journeyConfig;
    }

    // 1. Check "Book only if confirm berths are allotted"
    if (config && config.bookOnlyConfirm !== false) {
      const confirmBerthSelectors = [
        'label[for="confirmberths"]',
        'input#confirmberths',
        'p-radiobutton[name="reservationChoice"] input[value="1"]',
        'p-checkbox[formcontrolname="autoUpgradation"]'
      ];
      for (const sel of confirmBerthSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          el.click();
          break;
        }
      }
      // Also match by label text
      const labels = document.querySelectorAll('label, span, div');
      for (const l of labels) {
        if ((l.textContent || '').includes('Book only if confirm berths are allotted')) {
          l.click();
          break;
        }
      }
    }

    // 2. Check "Consider for Auto Upgradation"
    if (config && config.autoUpgrade !== false) {
      const autoUpgrade = document.querySelector('label[for="autoUpgradation"], input#autoUpgradation');
      if (autoUpgrade) autoUpgrade.click();
    }

    // 3. Select Payment Type (BHIM/UPI or Cards)
    if (config && config.paymentPreference === 'UPI') {
      const upiRadio = document.querySelector(
        'p-radiobutton[formcontrolname="paymentType"] input[value="2"], input[name="paymentType"][value="2"], label[for="2"]'
      );
      if (upiRadio) {
        upiRadio.click();
      } else {
        const pLabels = document.querySelectorAll('label, span');
        for (const pl of pLabels) {
          if ((pl.textContent || '').includes('BHIM/UPI')) {
            pl.click();
            break;
          }
        }
      }
    }

    await this._delay(500);

    // Auto-click Continue button to proceed to Review page
    const continueBtn = document.querySelector(
      'button.train_Search[type="submit"], button.btnDefault.train_Search, button#psgnContinue'
    );
    if (continueBtn) {
      this._notify('Submitting Passengers', 'Auto-clicking Continue to Review & CAPTCHA...', 'success');
      continueBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      continueBtn.click();
    } else {
      this._notify('Ready for Review', 'Click Continue to proceed to CAPTCHA.', 'info');
    }
  }

  async handleAutoPilotReview() {
    // Focus the CAPTCHA field and alert user
    const captchaInput = document.querySelector(
      'input[formcontrolname="captcha"], #captcha, input[name="captcha"], input[placeholder*="Captcha"], input[placeholder*="CAPTCHA"]'
    );

    if (captchaInput) {
      captchaInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      captchaInput.focus();
      captchaInput.style.border = '3px solid #f59e0b';
      captchaInput.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.7)';
      captchaInput.style.transition = 'all 0.3s ease';
    }

    // Beep sound alert
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, 350);
    } catch (e) {}

    this._notify(
      '⚠️ CAPTCHA REQUIRED',
      'Please type the CAPTCHA above and press Enter or click Continue!',
      'warning'
    );
  }

  async _handleMessage(message, sender, sendResponse) {
    const { action, data } = message;

    switch (action) {
      case 'SELECT_TRAIN': {
        const res = await this.handleAutoPilotTrainList();
        sendResponse(res);
        break;
      }

      case 'START_AUTOPILOT': {
        await this.startAutoPilot();
        sendResponse({ success: true, pageState: this.state.currentPage });
        break;
      }

      case 'START_AUTOFILL': {
        await this.start();
        sendResponse({ success: true, pageState: this.state.currentPage });
        break;
      }

      case 'STOP_AUTOFILL': {
        this.stop();
        sendResponse({ success: true });
        break;
      }

      case 'FILL_PASSENGERS': {
        const res = await this.fillPassengerForm();
        sendResponse(res);
        break;
      }

      case 'FILL_JOURNEY': {
        const res = await this.fillJourneyDetails();
        sendResponse(res);
        break;
      }

      case 'VALIDATE_FORM': {
        const val = this.validateForm();
        sendResponse({ success: true, ...val });
        break;
      }

      case 'GET_PAGE_STATE': {
        sendResponse(this.getPageState());
        break;
      }

      default:
        sendResponse({ success: false, error: `Unknown action: ${action}` });
    }
    return true;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _notify(title, message, type = 'info') {
    if (window.IRCTCUtils && typeof window.IRCTCUtils.showNotification === 'function') {
      window.IRCTCUtils.showNotification(`<b>${title}</b><br>${message}`, type);
    } else {
      console.log(`[IRCTC Assistant] [${type.toUpperCase()}] ${title} - ${message}`);
    }
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ── Instantiate Autofill Controller ──────────────────────────────────────────
if (!window.__irctcAutofillInstance) {
  window.__irctcAutofillInstance = new IRCTCAutofill();
}

/**
 * IRCTC Tatkal Booking Assistant - Utility Functions
 * Provides DOM manipulation, validation, notification, and page detection utilities.
 * Exposes all functions on window.IRCTCUtils object.
 */

(function () {
  'use strict';

  // ── waitForElement ──────────────────────────────────────────────────────────
  /**
   * Wait for a single element to appear in the DOM using MutationObserver.
   * @param {string} selector - CSS selector for the target element.
   * @param {number} [timeout=10000] - Maximum wait time in ms.
   * @returns {Promise<Element>} Resolves with the found element.
   */
  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }

      let observer;
      const timer = setTimeout(() => {
        if (observer) observer.disconnect();
        reject(new Error(`Timeout: Element "${selector}" not found within ${timeout}ms`));
      }, timeout);

      observer = new MutationObserver((mutations, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          clearTimeout(timer);
          obs.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  }

  // ── waitForElements ─────────────────────────────────────────────────────────
  /**
   * Wait for multiple elements matching a selector to appear in the DOM.
   * @param {string} selector - CSS selector.
   * @param {number} [timeout=10000] - Maximum wait time in ms.
   * @returns {Promise<NodeList>} Resolves with the matching elements.
   */
  function waitForElements(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelectorAll(selector);
      if (existing.length > 0) {
        resolve(existing);
        return;
      }

      let observer;
      const timer = setTimeout(() => {
        if (observer) observer.disconnect();
        reject(new Error(`Timeout: Elements "${selector}" not found within ${timeout}ms`));
      }, timeout);

      observer = new MutationObserver((mutations, obs) => {
        const els = document.querySelectorAll(selector);
        if (els.length > 0) {
          clearTimeout(timer);
          obs.disconnect();
          resolve(els);
        }
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  }

  // ── setNativeValue ──────────────────────────────────────────────────────────
  /**
   * Set value on an Angular/React-managed input element with proper event dispatching.
   * @param {HTMLElement} element - The input element.
   * @param {string} value - The value to set.
   */
  function setNativeValue(element, value) {
    if (!element) {
      console.warn('[IRCTC Assistant] setNativeValue: element is null');
      return;
    }

    element.focus();

    // Use native setter to bypass framework getters/setters
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    );
    const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    );

    if (element instanceof HTMLInputElement && nativeInputValueSetter && nativeInputValueSetter.set) {
      nativeInputValueSetter.set.call(element, value);
    } else if (element instanceof HTMLTextAreaElement && nativeTextareaValueSetter && nativeTextareaValueSetter.set) {
      nativeTextareaValueSetter.set.call(element, value);
    } else {
      element.value = value;
    }

    // Dispatch events that Angular/React listen for
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // ── formatToIRCTCDate ───────────────────────────────────────────────────────
  /**
   * Format any date string (e.g. YYYY-MM-DD from HTML date picker) into DD/MM/YYYY for IRCTC.
   * @param {string} dateStr - Date string.
   * @returns {string} Date formatted as DD/MM/YYYY.
   */
  function formatToIRCTCDate(dateStr) {
    if (!dateStr) return '';
    // If already in DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
    // If in YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const [year, month, day] = parts;
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    // Try Date parsing
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  }

  // ── selectDropdownOption ────────────────────────────────────────────────────
  /**
   * Select an option in a dropdown (native <select>, PrimeNG <p-dropdown>, mat-select, or ng-select).
   * Robust against Angular PrimeNG custom DOM wrappers used by IRCTC.
   * @param {HTMLElement} selectElement - The dropdown element or container.
   * @param {string} value - The value to select (e.g. 'Tatkal', 'SL', '3A').
   * @returns {Promise<boolean>} True if selection was successful.
   */
  async function selectDropdownOption(selectElement, value) {
    if (!selectElement || !value) return false;

    const targetVal = String(value).trim();
    const targetLower = targetVal.toLowerCase();
    const targetUpper = targetVal.toUpperCase();

    // 1. Native <select>
    if (selectElement.tagName === 'SELECT') {
      const options = Array.from(selectElement.options);
      const option = options.find((opt) => {
        const oVal = (opt.value || '').trim().toLowerCase();
        const oText = (opt.textContent || '').trim().toLowerCase();
        return oVal === targetLower || oText === targetLower || oText.includes(targetLower);
      });

      if (option) {
        selectElement.value = option.value;
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        selectElement.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    }

    // 2. PrimeNG <p-dropdown> (used extensively on IRCTC for Quota, Class, Gender, etc.)
    const isPrimeNG =
      selectElement.tagName === 'P-DROPDOWN' ||
      selectElement.classList.contains('p-dropdown') ||
      selectElement.classList.contains('ui-dropdown') ||
      selectElement.querySelector('.p-dropdown-trigger, .ui-dropdown-trigger, .p-dropdown, .ui-dropdown') !== null;

    if (isPrimeNG) {
      // Find the clickable trigger inside PrimeNG
      const trigger =
        selectElement.querySelector('.p-dropdown-trigger, .ui-dropdown-trigger, .p-dropdown-label, .ui-dropdown-label, .p-dropdown, .ui-dropdown') ||
        selectElement;

      trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
      trigger.click();
      await delay(350);

      // Look for the floating dropdown panel
      const items = document.querySelectorAll(
        '.p-dropdown-panel li, .ui-dropdown-panel li, p-dropdownitem li, .p-dropdown-item, .ui-dropdown-item, [role="option"]'
      );

      // First pass: Exact match or option contains target
      for (const item of items) {
        const itemText = (item.textContent || '').trim();
        const itemLower = itemText.toLowerCase();
        const itemUpper = itemText.toUpperCase();

        if (
          itemLower === targetLower ||
          itemUpper === targetUpper ||
          itemText === targetVal ||
          itemLower.includes(targetLower) ||
          itemUpper.includes(targetUpper)
        ) {
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          item.click();
          await delay(150);
          return true;
        }
      }

      // Second pass: Class codes like "(3A)", "(SL)", "(2A)"
      for (const item of items) {
        const itemText = (item.textContent || '').trim().toUpperCase();
        if (itemText.includes(`(${targetUpper})`) || itemText.includes(` ${targetUpper} `)) {
          item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          item.click();
          await delay(150);
          return true;
        }
      }

      // Close dropdown if option not found
      document.body.click();
      return false;
    }

    // 3. Angular Material mat-select
    if (selectElement.classList.contains('mat-select') || selectElement.tagName === 'MAT-SELECT') {
      selectElement.click();
      await delay(300);

      const overlay = document.querySelector('.cdk-overlay-container');
      if (overlay) {
        const matOptions = overlay.querySelectorAll('mat-option');
        for (const opt of matOptions) {
          const text = opt.textContent.trim().toLowerCase();
          if (text === targetLower || text.includes(targetLower)) {
            opt.click();
            await delay(100);
            return true;
          }
        }
      }
      document.body.click();
      return false;
    }

    // 4. ng-select
    if (selectElement.classList.contains('ng-select')) {
      selectElement.click();
      await delay(300);

      const items = document.querySelectorAll('.ng-option');
      for (const item of items) {
        const text = item.textContent.trim().toLowerCase();
        if (text === targetLower || text.includes(targetLower)) {
          item.click();
          await delay(100);
          return true;
        }
      }
      document.body.click();
      return false;
    }

    // 5. Generic Fallback
    selectElement.click();
    await delay(300);
    const listItems = document.querySelectorAll('[role="option"], [role="listbox"] li, .dropdown-item');
    for (const item of listItems) {
      if (item.textContent.trim().toLowerCase().includes(targetLower)) {
        item.click();
        return true;
      }
    }

    return false;
  }

  // ── clickElement ────────────────────────────────────────────────────────────
  /**
   * Safely click an element after scrolling it into view.
   * @param {HTMLElement} element - The element to click.
   */
  function clickElement(element) {
    if (!element) {
      console.warn('[IRCTC Assistant] clickElement: element is null');
      return;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // 1. Dispatch full pointer and mouse events
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((evt) => {
      try {
        element.dispatchEvent(new MouseEvent(evt, { bubbles: true, cancelable: true, view: window, buttons: 1 }));
      } catch (e) {}
    });

    // 2. ALWAYS execute native DOM element.click()
    try {
      element.click();
    } catch (e) {}
  }

  // ── Page Detection Functions ────────────────────────────────────────────────

  /**
   * Check if current URL is an IRCTC booking page.
   * @returns {boolean}
   */
  function isIRCTCBookingPage() {
    const url = window.location.href;
    return url.includes('irctc.co.in') || url.includes('localhost') || url.includes('127.0.0.1');
  }

  /**
   * Check if the passenger entry form is visible on the page.
   * @returns {boolean}
   */
  function isPassengerFormPage() {
    const url = window.location.href;
    if (url.includes('/nget/booking/psgninput') || url.includes('/nget/psgninput') || url.includes('/psgninput')) {
      return true;
    }
    const selectors = [
      'app-passenger',
      'app-passenger-details',
      '.passenger-form',
      '.psgn-row',
      'input[formcontrolname="passengerName"]',
      'p-autocomplete[formcontrolname="passengerName"]',
      '.passenger-container',
      '.psgn-header',
      '#passenger-form-section'
    ];
    return selectors.some((sel) => document.querySelector(sel) !== null);
  }

  /**
   * Check if the payment selection page is visible.
   * @returns {boolean}
   */
  function isPaymentPage() {
    const selectors = [
      '.payment-opt',
      '.bank-list',
      'app-payment-options',
      '.payment-container',
      '.pay-opt',
      '#payment-section'
    ];
    const url = window.location.href;
    return (
      url.includes('payment') ||
      selectors.some((sel) => document.querySelector(sel) !== null)
    );
  }

  /**
   * Check if the booking review page is visible.
   * @returns {boolean}
   */
  function isReviewPage() {
    const selectors = [
      '.review-container',
      'app-booking-summary',
      '.booking-summary',
      '.review-booking',
      '#review-section'
    ];
    return selectors.some((sel) => document.querySelector(sel) !== null);
  }

  // ── showNotification ────────────────────────────────────────────────────────
  /**
   * Show a floating notification on the IRCTC page.
   * @param {string} message - The message text.
   * @param {string} [type='info'] - Type: 'info', 'success', 'error', 'warning'.
   * @param {number} [duration=6000] - Display duration in ms.
   */
  function showNotification(message, type = 'info', duration = 6000) {
    const existing = document.getElementById('irctc-assistant-notification');
    if (existing) existing.remove();

    const colors = {
      info: { bg: '#1a73e8', text: '#ffffff', icon: 'ℹ️' },
      success: { bg: '#2e7d32', text: '#ffffff', icon: '✅' },
      error: { bg: '#d32f2f', text: '#ffffff', icon: '❌' },
      warning: { bg: '#e65100', text: '#ffffff', icon: '⚠️' },
    };

    const style = colors[type] || colors.info;

    const notification = document.createElement('div');
    notification.id = 'irctc-assistant-notification';
    notification.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 2147483647;
      background: ${style.bg};
      color: ${style.text};
      padding: 14px 22px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      font-weight: 500;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
      max-width: 440px;
      word-wrap: break-word;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      animation: irctc-slide-in 0.3s ease-out;
      cursor: pointer;
    `;

    if (!document.getElementById('irctc-assistant-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'irctc-assistant-styles';
      styleEl.textContent = `
        @keyframes irctc-slide-in {
          from { transform: translateX(110%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes irctc-slide-out {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(110%); opacity: 0; }
        }
      `;
      document.head.appendChild(styleEl);
    }

    notification.innerHTML = `
      <span style="font-size: 18px; line-height: 1;">${style.icon}</span>
      <div style="flex: 1;">${message}</div>
      <span style="cursor: pointer; font-size: 20px; line-height: 1; opacity: 0.8;" title="Dismiss">&times;</span>
    `;

    notification.addEventListener('click', () => {
      notification.style.animation = 'irctc-slide-out 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    });

    document.body.appendChild(notification);

    if (duration > 0) {
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'irctc-slide-out 0.3s ease-in forwards';
          setTimeout(() => notification.remove(), 300);
        }
      }, duration);
    }
  }

  // ── validatePassengerData ───────────────────────────────────────────────────
  function validatePassengerData(passenger) {
    const errors = [];

    if (!passenger) {
      return { valid: false, errors: ['Passenger data is empty'] };
    }

    if (!passenger.name || passenger.name.trim().length < 2) {
      errors.push('Name must be at least 2 characters');
    } else if (!/^[a-zA-Z\s]+$/.test(passenger.name.trim())) {
      errors.push('Name must contain only letters and spaces');
    } else if (passenger.name.trim().length > 60) {
      errors.push('Name must not exceed 60 characters');
    }

    const age = parseInt(passenger.age, 10);
    if (isNaN(age) || age < 1 || age > 125) {
      errors.push('Age must be between 1 and 125');
    }

    const validGenders = ['male', 'female', 'transgender'];
    if (!passenger.gender || !validGenders.includes(passenger.gender.toLowerCase())) {
      errors.push('Gender must be Male, Female, or Transgender');
    }

    return { valid: errors.length === 0, errors };
  }

  // ── delay ───────────────────────────────────────────────────────────────────
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ── debounce ────────────────────────────────────────────────────────────────
  function debounce(fn, wait) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  // ── getPageState ────────────────────────────────────────────────────────────
  function getPageState() {
    const url = window.location.href;

    if (
      url.includes('/nget/login') ||
      document.querySelector('.loginCont') ||
      document.querySelector('#userId') ||
      document.querySelector('app-login')
    ) {
      return 'login';
    }

    if (isPaymentPage()) {
      return 'payment';
    }

    if (
      url.includes('/nget/booking/pnr') ||
      url.includes('/confirm') ||
      document.querySelector('.pnr-container') ||
      document.querySelector('app-pnr')
    ) {
      return 'confirmation';
    }

    if (isReviewPage()) {
      return 'review';
    }

    if (isPassengerFormPage()) {
      return 'passengerForm';
    }

    if (
      url.includes('/nget/train-list') ||
      document.querySelector('.train-list') ||
      document.querySelector('.bull-back') ||
      document.querySelector('app-train-list')
    ) {
      return 'trainList';
    }

    if (
      url.includes('/nget/train-search') ||
      url.includes('/nget') ||
      document.querySelector('.city-icon') ||
      document.querySelector('app-jp-input') ||
      document.querySelector('#origin') ||
      document.querySelector('#sourceStation')
    ) {
      return 'search';
    }

    return 'unknown';
  }

  // ── Expose on window ───────────────────────────────────────────────────────
  window.IRCTCUtils = {
    waitForElement,
    waitForElements,
    setNativeValue,
    formatToIRCTCDate,
    selectDropdownOption,
    clickElement,
    isIRCTCBookingPage,
    isPassengerFormPage,
    isPaymentPage,
    isReviewPage,
    showNotification,
    validatePassengerData,
    delay,
    debounce,
    getPageState,
  };
})();

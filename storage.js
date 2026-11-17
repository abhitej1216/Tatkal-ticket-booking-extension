/**
 * IRCTC Tatkal Booking Assistant - Storage Utility Module
 * Uses Chrome Storage API (chrome.storage.local) for persistent data storage.
 * Exposes all functions on window.IRCTCStorage object.
 */

(function () {
  'use strict';

  // ── Helper: UUID Generator ──────────────────────────────────────────────────
  /**
   * Generate a RFC4122-compliant v4 UUID.
   * @returns {string} A unique identifier string.
   */
  function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // ── Internal Storage Helpers ────────────────────────────────────────────────

  /**
   * Read a single key from chrome.storage.local.
   * @param {string} key - The storage key to read.
   * @returns {Promise<*>} The stored value, or undefined if not found.
   */
  function _get(key) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result[key]);
        }
      });
    });
  }

  /**
   * Write a key-value pair to chrome.storage.local.
   * @param {string} key - The storage key.
   * @param {*} value - The value to store.
   * @returns {Promise<void>}
   */
  function _set(key, value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  // ── Passenger Functions ─────────────────────────────────────────────────────

  /**
   * Save a passenger object to storage.
   * Generates a UUID if the passenger does not have an id.
   * @param {Object} passenger - Passenger data.
   * @param {string} [passenger.id] - Unique ID (auto-generated if absent).
   * @param {string} passenger.name - Full name.
   * @param {number|string} passenger.age - Age.
   * @param {string} passenger.gender - Gender (Male/Female/Transgender).
   * @param {string} passenger.berthPreference - Preferred berth.
   * @param {string} passenger.foodPreference - Food choice.
   * @param {string} passenger.nationality - Nationality.
   * @param {string} passenger.idType - ID proof type.
   * @param {string} passenger.idNumber - ID proof number.
   * @returns {Promise<Object>} The saved passenger (with id).
   */
  async function savePassenger(passenger) {
    const passengers = (await _get('passengers')) || [];
    const record = { ...passenger };
    if (!record.id) {
      record.id = generateId();
    }
    passengers.push(record);
    await _set('passengers', passengers);
    return record;
  }

  /**
   * Get all saved passengers.
   * @returns {Promise<Object[]>} Array of passenger objects.
   */
  async function getPassengers() {
    return (await _get('passengers')) || [];
  }

  /**
   * Update a passenger by id.
   * @param {string} id - Passenger id to update.
   * @param {Object} updates - Fields to merge into the passenger.
   * @returns {Promise<Object|null>} The updated passenger, or null if not found.
   */
  async function updatePassenger(id, updates) {
    const passengers = (await _get('passengers')) || [];
    const index = passengers.findIndex((p) => p.id === id);
    if (index === -1) {
      return null;
    }
    passengers[index] = { ...passengers[index], ...updates, id };
    await _set('passengers', passengers);
    return passengers[index];
  }

  /**
   * Delete a passenger by id.
   * @param {string} id - Passenger id to delete.
   * @returns {Promise<boolean>} True if deleted, false if not found.
   */
  async function deletePassenger(id) {
    const passengers = (await _get('passengers')) || [];
    const filtered = passengers.filter((p) => p.id !== id);
    if (filtered.length === passengers.length) {
      return false;
    }
    await _set('passengers', filtered);
    return true;
  }

  // ── Group Functions ─────────────────────────────────────────────────────────

  /**
   * Save a passenger group to storage.
   * @param {Object} group - Group data.
   * @param {string} [group.id] - Unique ID (auto-generated if absent).
   * @param {string} group.name - Group name.
   * @param {string[]} group.passengerIds - Array of passenger IDs in this group.
   * @returns {Promise<Object>} The saved group (with id).
   */
  async function saveGroup(group) {
    const groups = (await _get('groups')) || [];
    const record = { ...group };
    if (!record.id) {
      record.id = generateId();
    }
    if (!Array.isArray(record.passengerIds)) {
      record.passengerIds = [];
    }
    groups.push(record);
    await _set('groups', groups);
    return record;
  }

  /**
   * Get all saved groups.
   * @returns {Promise<Object[]>} Array of group objects.
   */
  async function getGroups() {
    return (await _get('groups')) || [];
  }

  /**
   * Update a group by id.
   * @param {string} id - Group id to update.
   * @param {Object} updates - Fields to merge into the group.
   * @returns {Promise<Object|null>} The updated group, or null if not found.
   */
  async function updateGroup(id, updates) {
    const groups = (await _get('groups')) || [];
    const index = groups.findIndex((g) => g.id === id);
    if (index === -1) {
      return null;
    }
    groups[index] = { ...groups[index], ...updates, id };
    await _set('groups', groups);
    return groups[index];
  }

  /**
   * Delete a group by id.
   * @param {string} id - Group id to delete.
   * @returns {Promise<boolean>} True if deleted, false if not found.
   */
  async function deleteGroup(id) {
    const groups = (await _get('groups')) || [];
    const filtered = groups.filter((g) => g.id !== id);
    if (filtered.length === groups.length) {
      return false;
    }
    await _set('groups', filtered);
    return true;
  }

  // ── Journey Config Functions ────────────────────────────────────────────────

  /**
   * Save journey configuration.
   * @param {Object} config - Journey config.
   * @param {string} config.source - Source station.
   * @param {string} config.destination - Destination station.
   * @param {string} config.date - Travel date.
   * @param {string} config.trainNumber - Train number.
   * @param {string} config.travelClass - Class of travel.
   * @param {string} config.quota - Booking quota (General/Tatkal/Premium Tatkal).
   * @returns {Promise<void>}
   */
  async function saveJourneyConfig(config) {
    await _set('journeyConfig', config);
  }

  /**
   * Get saved journey configuration.
   * @returns {Promise<Object|null>} The journey config, or null if not saved.
   */
  async function getJourneyConfig() {
    return (await _get('journeyConfig')) || null;
  }

  // ── Settings Functions ──────────────────────────────────────────────────────

  /**
   * Save extension settings.
   * @param {Object} settings - Settings object.
   * @returns {Promise<void>}
   */
  async function saveSettings(settings) {
    await _set('settings', settings);
  }

  /**
   * Get extension settings.
   * @returns {Promise<Object>} The settings object with defaults.
   */
  async function getSettings() {
    const defaults = {
      autoFillEnabled: true,
      autoSubmitEnabled: false,
      notificationsEnabled: true,
      fillDelay: 100,
      highlightFields: true,
    };
    const stored = (await _get('settings')) || {};
    return { ...defaults, ...stored };
  }

  // ── Active Group Functions ──────────────────────────────────────────────────

  /**
   * Get the currently active group id.
   * @returns {Promise<string|null>} The active group id, or null.
   */
  async function getActiveGroup() {
    return (await _get('activeGroupId')) || null;
  }

  /**
   * Set the active group id.
   * @param {string} groupId - The group id to set as active.
   * @returns {Promise<void>}
   */
  async function setActiveGroup(groupId) {
    await _set('activeGroupId', groupId);
  }

  // ── Clear All ───────────────────────────────────────────────────────────────

  /**
   * Clear all stored data.
   * @returns {Promise<void>}
   */
  function clearAll() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  // ── Expose on window ───────────────────────────────────────────────────────

  window.IRCTCStorage = {
    generateId,
    savePassenger,
    getPassengers,
    updatePassenger,
    deletePassenger,
    saveGroup,
    getGroups,
    updateGroup,
    deleteGroup,
    saveJourneyConfig,
    getJourneyConfig,
    saveSettings,
    getSettings,
    getActiveGroup,
    setActiveGroup,
    clearAll,
  };
})();

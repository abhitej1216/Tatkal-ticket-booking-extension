/**
 * IRCTC Tatkal Booking Assistant - Popup Script (popup.js)
 * Manages the UI, tabs, Passenger Profiles CRUD, Groups, Journey Configuration,
 * and communicates with the background service worker.
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  // ── State ──────────────────────────────────────────────────────────────────
  let state = {
    passengers: [],
    groups: [],
    activeGroupId: null,
    journeyConfig: null,
    settings: { isEnabled: true },
    currentTab: 'dashboard',
    logs: [],
  };

  // ── DOM Elements ───────────────────────────────────────────────────────────
  const statusIndicator = document.getElementById('statusIndicator');
  const statusDot = document.getElementById('statusDot');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Dashboard elements
  const extensionToggle = document.getElementById('extensionToggle');
  const extensionStatusText = document.getElementById('extensionStatusText');
  const selectedGroupInfo = document.getElementById('selectedGroupInfo');
  const journeySummary = document.getElementById('journeySummary');
  const quickFillDetails = document.getElementById('quickFillDetails');
  const quickValidate = document.getElementById('quickValidate');
  const quickStartAssistant = document.getElementById('quickStartAssistant');

  // Passenger elements
  const passengerList = document.getElementById('passengerList');
  const addPassengerBtn = document.getElementById('addPassengerBtn');
  const passengerFormContainer = document.getElementById('passengerFormContainer');
  const passengerForm = document.getElementById('passengerForm');
  const passengerFormTitle = document.getElementById('passengerFormTitle');
  const passengerIdInput = document.getElementById('passengerId');
  const passengerNameInput = document.getElementById('passengerName');
  const passengerAgeInput = document.getElementById('passengerAge');
  const passengerGenderInput = document.getElementById('passengerGender');
  const passengerBerthInput = document.getElementById('passengerBerth');
  const passengerFoodInput = document.getElementById('passengerFood');
  const passengerNationalityInput = document.getElementById('passengerNationality');
  const passengerIdTypeInput = document.getElementById('passengerIdType');
  const passengerIdNumberInput = document.getElementById('passengerIdNumber');
  const cancelPassengerBtn = document.getElementById('cancelPassengerBtn');

  // Group elements
  const groupList = document.getElementById('groupList');
  const createGroupBtn = document.getElementById('createGroupBtn');
  const groupFormContainer = document.getElementById('groupFormContainer');
  const groupForm = document.getElementById('groupForm');
  const groupFormTitle = document.getElementById('groupFormTitle');
  const groupIdInput = document.getElementById('groupId');
  const groupNameInput = document.getElementById('groupName');
  const groupPassengerCheckboxes = document.getElementById('groupPassengerCheckboxes');
  const cancelGroupBtn = document.getElementById('cancelGroupBtn');

  // Journey elements
  const journeyForm = document.getElementById('journeyForm');
  const sourceStationInput = document.getElementById('sourceStation');
  const destStationInput = document.getElementById('destStation');
  const journeyDateInput = document.getElementById('journeyDate');
  const trainNumberInput = document.getElementById('trainNumber');
  const travelClassInput = document.getElementById('travelClass');
  const quotaInput = document.getElementById('quota');
  const fillJourneyIRCTCBtn = document.getElementById('fillJourneyIRCTCBtn');
  const bookOnlyConfirmCheck = document.getElementById('bookOnlyConfirmCheck');
  const autoUpgradationCheck = document.getElementById('autoUpgradationCheck');
  const paymentPreference = document.getElementById('paymentPreference');
  const dashStartAutoPilot = document.getElementById('dashStartAutoPilot');
  const dashStopAutoPilot = document.getElementById('dashStopAutoPilot');
  const startAutoPilotBtn = document.getElementById('startAutoPilotBtn');
  const autoPilotBadge = document.getElementById('autoPilotBadge');
  const quickFillJourney = document.getElementById('quickFillJourney');
  const quickSelectTrain = document.getElementById('quickSelectTrain');
  const selectTrainBookBtn = document.getElementById('selectTrainBookBtn');

  // Assistant elements
  const assistantBadge = document.getElementById('assistantBadge');
  const startAssistantBtn = document.getElementById('startAssistantBtn');
  const fillPassengersBtn = document.getElementById('fillPassengersBtn');
  const fillJourneyBtn = document.getElementById('fillJourneyBtn');
  const validateFormBtn = document.getElementById('validateFormBtn');
  const stopAssistantBtn = document.getElementById('stopAssistantBtn');
  const activityLog = document.getElementById('activityLog');
  const clearLogBtn = document.getElementById('clearLogBtn');

  // Common elements
  const inlineMessage = document.getElementById('inlineMessage');
  const messageText = document.getElementById('messageText');
  const messageClose = document.getElementById('messageClose');
  const clearAllDataBtn = document.getElementById('clearAllDataBtn');

  // ── Initialization ─────────────────────────────────────────────────────────
  await loadAllData();
  setupEventListeners();
  renderDashboard();
  renderPassengers();
  renderGroups();
  renderJourneyConfig();
  await checkExtensionStatus();

  // Set default minimum date for journey to today
  const today = new Date().toISOString().split('T')[0];
  if (journeyDateInput) {
    journeyDateInput.min = today;
  }

  // ── Data Loading & Storage Sync ────────────────────────────────────────────

  async function loadAllData() {
    try {
      const data = await chrome.storage.local.get([
        'passengers',
        'groups',
        'activeGroupId',
        'journeyConfig',
        'settings',
        'activityLogs',
      ]);

      state.passengers = data.passengers || [];
      state.groups = data.groups || [];
      state.activeGroupId = data.activeGroupId || null;
      state.journeyConfig = data.journeyConfig || null;
      state.settings = data.settings || { isEnabled: true };
      state.logs = data.activityLogs || [];
    } catch (err) {
      console.error('[Popup] Error loading data:', err);
      showBanner('Failed to load saved settings', 'danger');
    }
  }

  // ── Tab Navigation ─────────────────────────────────────────────────────────

  function switchTab(targetTab) {
    state.currentTab = targetTab;
    tabButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === targetTab);
    });
    tabPanes.forEach((pane) => {
      pane.classList.toggle('active', pane.id === `tab-${targetTab}`);
    });

    if (targetTab === 'dashboard') renderDashboard();
    if (targetTab === 'passengers') {
      renderPassengers();
      renderGroups();
    }
    if (targetTab === 'journey') renderJourneyConfig();
    if (targetTab === 'assistant') renderActivityLog();
  }

  // ── Event Listeners Setup ──────────────────────────────────────────────────

  function setupEventListeners() {
    // Tabs
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Toggle switch
    if (extensionToggle) {
      extensionToggle.addEventListener('change', async (e) => {
        state.settings.isEnabled = e.target.checked;
        await chrome.storage.local.set({ settings: state.settings });
        updateStatusDisplay(state.settings.isEnabled);
        addLog(state.settings.isEnabled ? 'Extension enabled' : 'Extension disabled');
      });
    }

    // Quick Actions
    if (quickFillDetails) {
      quickFillDetails.addEventListener('click', () => handleFillPassengers());
    }
    if (quickValidate) {
      quickValidate.addEventListener('click', () => handleValidateForm());
    }
    if (quickStartAssistant) {
      quickStartAssistant.addEventListener('click', () => handleStartAssistant());
    }

    // Passengers CRUD
    if (addPassengerBtn) {
      addPassengerBtn.addEventListener('click', () => openPassengerForm());
    }
    if (cancelPassengerBtn) {
      cancelPassengerBtn.addEventListener('click', () => closePassengerForm());
    }
    if (passengerForm) {
      passengerForm.addEventListener('submit', handleSavePassenger);
    }

    // Groups CRUD
    if (createGroupBtn) {
      createGroupBtn.addEventListener('click', () => openGroupForm());
    }
    if (cancelGroupBtn) {
      cancelGroupBtn.addEventListener('click', () => closeGroupForm());
    }
    if (groupForm) {
      groupForm.addEventListener('submit', handleSaveGroup);
    }

    // Journey Config (Immediate auto-save on input/change + explicit submit)
    if (journeyForm) {
      journeyForm.addEventListener('submit', handleSaveJourney);
      journeyForm.addEventListener('change', syncAndSaveJourneyFromInputs);
    }
    if (journeyDateInput) {
      journeyDateInput.addEventListener('change', syncAndSaveJourneyFromInputs);
      journeyDateInput.addEventListener('input', syncAndSaveJourneyFromInputs);
    }
    if (sourceStationInput) {
      sourceStationInput.addEventListener('input', syncAndSaveJourneyFromInputs);
    }
    if (destStationInput) {
      destStationInput.addEventListener('input', syncAndSaveJourneyFromInputs);
    }
    if (trainNumberInput) {
      trainNumberInput.addEventListener('input', syncAndSaveJourneyFromInputs);
    }
    if (travelClassInput) {
      travelClassInput.addEventListener('change', syncAndSaveJourneyFromInputs);
    }
    if (quotaInput) {
      quotaInput.addEventListener('change', syncAndSaveJourneyFromInputs);
    }
    if (fillJourneyIRCTCBtn) {
      fillJourneyIRCTCBtn.addEventListener('click', handleFillJourney);
    }

    // Auto-Pilot triggers
    if (dashStartAutoPilot) {
      dashStartAutoPilot.addEventListener('click', handleStartAutoPilot);
    }
    if (dashStopAutoPilot) {
      dashStopAutoPilot.addEventListener('click', handleStopAssistant);
    }
    if (startAutoPilotBtn) {
      startAutoPilotBtn.addEventListener('click', handleStartAutoPilot);
    }
    if (quickFillJourney) {
      quickFillJourney.addEventListener('click', handleFillJourney);
    }
    if (quickSelectTrain) {
      quickSelectTrain.addEventListener('click', handleSelectTrainAndBook);
    }
    if (selectTrainBookBtn) {
      selectTrainBookBtn.addEventListener('click', handleSelectTrainAndBook);
    }

    // Assistant Tab Actions
    if (startAssistantBtn) {
      startAssistantBtn.addEventListener('click', handleStartAssistant);
    }
    if (fillPassengersBtn) {
      fillPassengersBtn.addEventListener('click', handleFillPassengers);
    }
    if (fillJourneyBtn) {
      fillJourneyBtn.addEventListener('click', handleFillJourney);
    }
    if (validateFormBtn) {
      validateFormBtn.addEventListener('click', handleValidateForm);
    }
    if (stopAssistantBtn) {
      stopAssistantBtn.addEventListener('click', handleStopAssistant);
    }
    if (clearLogBtn) {
      clearLogBtn.addEventListener('click', () => {
        state.logs = [];
        chrome.storage.local.set({ activityLogs: [] });
        renderActivityLog();
      });
    }

    // Banner close
    if (messageClose) {
      messageClose.addEventListener('click', () => {
        inlineMessage.classList.add('hidden');
      });
    }

    // Clear All Data
    if (clearAllDataBtn) {
      clearAllDataBtn.addEventListener('click', handleClearAllData);
    }
  }

  // ── Dashboard Rendering ────────────────────────────────────────────────────

  function renderDashboard() {
    // 1. Toggle & Status
    const isEnabled = state.settings.isEnabled !== false;
    if (extensionToggle) extensionToggle.checked = isEnabled;
    updateStatusDisplay(isEnabled);

    // 2. Selected Group Card
    if (selectedGroupInfo) {
      if (!state.activeGroupId || state.groups.length === 0) {
        selectedGroupInfo.innerHTML = `
          <p class="empty-text">No active group selected. Defaulting to all saved passengers (${state.passengers.length}).</p>
          <button class="btn btn-sm btn-secondary" style="margin-top: 6px;" id="dashManageGroups">Manage Groups</button>
        `;
        const btn = document.getElementById('dashManageGroups');
        if (btn) btn.addEventListener('click', () => switchTab('passengers'));
      } else {
        const group = state.groups.find((g) => g.id === state.activeGroupId);
        if (group) {
          const count = (group.passengerIds || []).length;
          selectedGroupInfo.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>${escapeHtml(group.name)}</strong>
              <span class="badge">${count} Passenger${count === 1 ? '' : 's'}</span>
            </div>
          `;
        }
      }
    }

    // 3. Journey Summary Card
    if (journeySummary) {
      if (!state.journeyConfig || !state.journeyConfig.source) {
        journeySummary.innerHTML = `
          <p class="empty-text">No journey configured yet.</p>
          <button class="btn btn-sm btn-secondary" style="margin-top: 6px;" id="dashConfigJourney">Configure Journey</button>
        `;
        const btn = document.getElementById('dashConfigJourney');
        if (btn) btn.addEventListener('click', () => switchTab('journey'));
      } else {
        const j = state.journeyConfig;
        journeySummary.innerHTML = `
          <div style="font-size: 13px; line-height: 1.5;">
            <div><strong>${escapeHtml(j.source)}</strong> ➔ <strong>${escapeHtml(j.destination)}</strong></div>
            <div style="color: var(--text-secondary); margin-top: 2px;">
              Date: <b style="color: #2563eb; font-weight: bold;">${escapeHtml(j.date || 'Any')}</b> | Class: <b>${escapeHtml(j.travelClass || 'SL')}</b> | Quota: <b>${escapeHtml(j.quota || 'Tatkal')}</b>
            </div>
            ${j.trainNumber ? `<div style="color: var(--text-secondary);">Train: <b>${escapeHtml(j.trainNumber)}</b></div>` : ''}
          </div>
        `;
      }
    }
  }

  function updateStatusDisplay(isActive) {
    if (statusDot) {
      statusDot.className = `status-dot ${isActive ? 'active' : 'inactive'}`;
    }
    if (statusIndicator) {
      statusIndicator.title = isActive ? 'Extension Active' : 'Extension Inactive';
    }
    if (extensionStatusText) {
      extensionStatusText.textContent = isActive ? 'Active & Ready' : 'Inactive';
      extensionStatusText.style.color = isActive ? 'var(--success)' : 'var(--text-secondary)';
    }
  }

  // ── Passenger CRUD ─────────────────────────────────────────────────────────

  function renderPassengers() {
    if (!passengerList) return;

    if (state.passengers.length === 0) {
      passengerList.innerHTML = '<p class="empty-text">No passengers saved. Click "+ Add Passenger" to add.</p>';
      return;
    }

    passengerList.innerHTML = state.passengers
      .map(
        (p) => `
        <div class="item-card" data-id="${p.id}">
          <div class="item-info">
            <div class="item-title">${escapeHtml(p.name)}</div>
            <div class="item-meta">
              ${p.age} yrs • ${escapeHtml(p.gender)} • Berth: ${escapeHtml(p.berthPreference || 'No Preference')}
              ${p.foodPreference && p.foodPreference !== 'No Food' ? ` • ${escapeHtml(p.foodPreference)}` : ''}
            </div>
          </div>
          <div class="item-actions">
            <button class="btn btn-sm btn-secondary edit-psgn-btn" data-id="${p.id}">Edit</button>
            <button class="btn btn-sm btn-danger delete-psgn-btn" data-id="${p.id}">Delete</button>
          </div>
        </div>
      `
      )
      .join('');

    // Attach edit/delete listeners
    passengerList.querySelectorAll('.edit-psgn-btn').forEach((btn) => {
      btn.addEventListener('click', () => editPassenger(btn.dataset.id));
    });
    passengerList.querySelectorAll('.delete-psgn-btn').forEach((btn) => {
      btn.addEventListener('click', () => deletePassenger(btn.dataset.id));
    });
  }

  function openPassengerForm(passenger = null) {
    if (!passengerFormContainer) return;
    passengerForm.reset();

    if (passenger) {
      passengerFormTitle.textContent = 'Edit Passenger';
      passengerIdInput.value = passenger.id;
      passengerNameInput.value = passenger.name;
      passengerAgeInput.value = passenger.age;
      passengerGenderInput.value = passenger.gender;
      passengerBerthInput.value = passenger.berthPreference || 'No Preference';
      passengerFoodInput.value = passenger.foodPreference || 'No Food';
      passengerNationalityInput.value = passenger.nationality || 'Indian';
      passengerIdTypeInput.value = passenger.idType || '';
      passengerIdNumberInput.value = passenger.idNumber || '';
    } else {
      passengerFormTitle.textContent = 'Add Passenger';
      passengerIdInput.value = '';
      passengerNationalityInput.value = 'Indian';
      passengerBerthInput.value = 'No Preference';
      passengerFoodInput.value = 'No Food';
    }

    passengerFormContainer.classList.remove('hidden');
    passengerFormContainer.scrollIntoView({ behavior: 'smooth' });
    passengerNameInput.focus();
  }

  function closePassengerForm() {
    if (passengerFormContainer) {
      passengerFormContainer.classList.add('hidden');
      passengerForm.reset();
    }
  }

  async function handleSavePassenger(e) {
    e.preventDefault();

    const name = passengerNameInput.value.trim();
    const age = parseInt(passengerAgeInput.value, 10);
    const gender = passengerGenderInput.value;

    // Validate
    if (!name || name.length < 2) {
      showBanner('Passenger name must be at least 2 characters', 'danger');
      return;
    }
    if (isNaN(age) || age < 1 || age > 125) {
      showBanner('Please enter a valid age (1-125)', 'danger');
      return;
    }
    if (!gender) {
      showBanner('Please select a gender', 'danger');
      return;
    }

    const passengerData = {
      id: passengerIdInput.value || generateUUID(),
      name,
      age,
      gender,
      berthPreference: passengerBerthInput.value,
      foodPreference: passengerFoodInput.value,
      nationality: passengerNationalityInput.value.trim() || 'Indian',
      idType: passengerIdTypeInput.value,
      idNumber: passengerIdNumberInput.value.trim(),
    };

    const existingIndex = state.passengers.findIndex((p) => p.id === passengerData.id);
    if (existingIndex >= 0) {
      state.passengers[existingIndex] = passengerData;
      addLog(`Updated passenger: ${name}`);
    } else {
      state.passengers.push(passengerData);
      addLog(`Added passenger: ${name}`);
    }

    await chrome.storage.local.set({ passengers: state.passengers });
    closePassengerForm();
    renderPassengers();
    renderDashboard();
    showBanner(`Passenger "${name}" saved!`, 'success');
  }

  function editPassenger(id) {
    const p = state.passengers.find((item) => item.id === id);
    if (p) openPassengerForm(p);
  }

  async function deletePassenger(id) {
    const p = state.passengers.find((item) => item.id === id);
    const name = p ? p.name : 'Passenger';

    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    state.passengers = state.passengers.filter((item) => item.id !== id);
    // Remove from any groups
    state.groups.forEach((g) => {
      g.passengerIds = (g.passengerIds || []).filter((pid) => pid !== id);
    });

    await chrome.storage.local.set({
      passengers: state.passengers,
      groups: state.groups,
    });

    addLog(`Deleted passenger: ${name}`);
    renderPassengers();
    renderGroups();
    renderDashboard();
    showBanner(`Deleted ${name}`, 'info');
  }

  // ── Groups CRUD ────────────────────────────────────────────────────────────

  function renderGroups() {
    if (!groupList) return;

    if (state.groups.length === 0) {
      groupList.innerHTML = '<p class="empty-text">No passenger groups. Click "+ Create Group" to organize.</p>';
      return;
    }

    groupList.innerHTML = state.groups
      .map((g) => {
        const isActive = g.id === state.activeGroupId;
        const count = (g.passengerIds || []).length;
        return `
        <div class="item-card ${isActive ? 'active-group-card' : ''}" data-id="${g.id}">
          <div class="item-info">
            <div style="display: flex; align-items: center; gap: 8px;">
              <input type="radio" name="activeGroupRadio" value="${g.id}" ${isActive ? 'checked' : ''} class="group-radio">
              <strong class="item-title">${escapeHtml(g.name)}</strong>
              ${isActive ? '<span class="badge">ACTIVE</span>' : ''}
            </div>
            <div class="item-meta" style="margin-left: 24px;">
              ${count} passenger${count === 1 ? '' : 's'} included
            </div>
          </div>
          <div class="item-actions">
            <button class="btn btn-sm btn-secondary edit-group-btn" data-id="${g.id}">Edit</button>
            <button class="btn btn-sm btn-danger delete-group-btn" data-id="${g.id}">Delete</button>
          </div>
        </div>
      `;
      })
      .join('');

    // Radio select handlers
    groupList.querySelectorAll('.group-radio').forEach((radio) => {
      radio.addEventListener('change', async (e) => {
        state.activeGroupId = e.target.value;
        await chrome.storage.local.set({ activeGroupId: state.activeGroupId });
        const g = state.groups.find((x) => x.id === state.activeGroupId);
        addLog(`Selected active group: ${g ? g.name : 'Unknown'}`);
        renderGroups();
        renderDashboard();
      });
    });

    groupList.querySelectorAll('.edit-group-btn').forEach((btn) => {
      btn.addEventListener('click', () => editGroup(btn.dataset.id));
    });
    groupList.querySelectorAll('.delete-group-btn').forEach((btn) => {
      btn.addEventListener('click', () => deleteGroup(btn.dataset.id));
    });
  }

  function openGroupForm(group = null) {
    if (!groupFormContainer) return;
    groupForm.reset();

    // Render passenger checkboxes
    if (state.passengers.length === 0) {
      groupPassengerCheckboxes.innerHTML = '<p class="empty-text">Please add passengers before creating a group.</p>';
    } else {
      groupPassengerCheckboxes.innerHTML = state.passengers
        .map((p) => {
          const isChecked = group && (group.passengerIds || []).includes(p.id);
          return `
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; cursor: pointer;">
            <input type="checkbox" value="${p.id}" ${isChecked ? 'checked' : ''} class="group-psgn-cb">
            <span>${escapeHtml(p.name)} (${p.age}, ${p.gender})</span>
          </label>
        `;
        })
        .join('');
    }

    if (group) {
      groupFormTitle.textContent = 'Edit Group';
      groupIdInput.value = group.id;
      groupNameInput.value = group.name;
    } else {
      groupFormTitle.textContent = 'Create Group';
      groupIdInput.value = '';
    }

    groupFormContainer.classList.remove('hidden');
    groupFormContainer.scrollIntoView({ behavior: 'smooth' });
    groupNameInput.focus();
  }

  function closeGroupForm() {
    if (groupFormContainer) {
      groupFormContainer.classList.add('hidden');
      groupForm.reset();
    }
  }

  async function handleSaveGroup(e) {
    e.preventDefault();

    const name = groupNameInput.value.trim();
    if (!name) {
      showBanner('Group name is required', 'danger');
      return;
    }

    const selectedIds = Array.from(
      groupPassengerCheckboxes.querySelectorAll('.group-psgn-cb:checked')
    ).map((cb) => cb.value);

    if (selectedIds.length === 0) {
      showBanner('Select at least one passenger for this group', 'warning');
      return;
    }

    const groupData = {
      id: groupIdInput.value || generateUUID(),
      name,
      passengerIds: selectedIds,
    };

    const existingIndex = state.groups.findIndex((g) => g.id === groupData.id);
    if (existingIndex >= 0) {
      state.groups[existingIndex] = groupData;
      addLog(`Updated group: ${name}`);
    } else {
      state.groups.push(groupData);
      if (!state.activeGroupId) {
        state.activeGroupId = groupData.id;
      }
      addLog(`Created group: ${name}`);
    }

    await chrome.storage.local.set({
      groups: state.groups,
      activeGroupId: state.activeGroupId,
    });

    closeGroupForm();
    renderGroups();
    renderDashboard();
    showBanner(`Group "${name}" saved!`, 'success');
  }

  function editGroup(id) {
    const g = state.groups.find((item) => item.id === id);
    if (g) openGroupForm(g);
  }

  async function deleteGroup(id) {
    const g = state.groups.find((item) => item.id === id);
    const name = g ? g.name : 'Group';

    if (!confirm(`Delete group "${name}"?`)) return;

    state.groups = state.groups.filter((item) => item.id !== id);
    if (state.activeGroupId === id) {
      state.activeGroupId = state.groups.length > 0 ? state.groups[0].id : null;
    }

    await chrome.storage.local.set({
      groups: state.groups,
      activeGroupId: state.activeGroupId,
    });

    addLog(`Deleted group: ${name}`);
    renderGroups();
    renderDashboard();
    showBanner(`Deleted group "${name}"`, 'info');
  }

  // ── Journey Configuration ──────────────────────────────────────────────────

  function renderJourneyConfig() {
    if (!state.journeyConfig) return;

    const j = state.journeyConfig;
    if (sourceStationInput && j.source) sourceStationInput.value = j.source;
    if (destStationInput && j.destination) destStationInput.value = j.destination;
    if (journeyDateInput && j.date) journeyDateInput.value = j.date;
    if (trainNumberInput && j.trainNumber) trainNumberInput.value = j.trainNumber;
    if (travelClassInput && j.travelClass) travelClassInput.value = j.travelClass;
    if (quotaInput && j.quota) quotaInput.value = j.quota;
    if (bookOnlyConfirmCheck) bookOnlyConfirmCheck.checked = j.bookOnlyConfirm !== false;
    if (autoUpgradationCheck) autoUpgradationCheck.checked = j.autoUpgrade !== false;
    if (paymentPreference && j.paymentPreference) paymentPreference.value = j.paymentPreference;
  }

  function syncAndSaveJourneyFromInputs() {
    if (!sourceStationInput || !destStationInput || !journeyDateInput) return;

    const source = sourceStationInput.value.trim().toUpperCase();
    const destination = destStationInput.value.trim().toUpperCase();
    const date = journeyDateInput.value;
    const trainNumber = trainNumberInput ? trainNumberInput.value.trim() : '';
    const travelClass = travelClassInput ? travelClassInput.value : 'All Classes';
    const quota = quotaInput ? quotaInput.value : 'Tatkal';
    const bookOnlyConfirm = bookOnlyConfirmCheck ? bookOnlyConfirmCheck.checked : true;
    const autoUpgrade = autoUpgradationCheck ? autoUpgradationCheck.checked : true;
    const paymentPref = paymentPreference ? paymentPreference.value : 'UPI';

    if (source || destination || date) {
      state.journeyConfig = {
        source,
        destination,
        date,
        trainNumber,
        travelClass,
        quota,
        bookOnlyConfirm,
        autoUpgrade,
        paymentPreference: paymentPref,
      };

      chrome.storage.local.set({ journeyConfig: state.journeyConfig });
      renderDashboard();
    }
  }

  async function handleSaveJourney(e) {
    e.preventDefault();

    const source = sourceStationInput.value.trim().toUpperCase();
    const destination = destStationInput.value.trim().toUpperCase();
    const date = journeyDateInput.value;
    const trainNumber = trainNumberInput.value.trim();
    const travelClass = travelClassInput.value;
    const quota = quotaInput.value;

    if (!source || !destination) {
      showBanner('Source and Destination stations are required', 'danger');
      return;
    }

    const bookOnlyConfirm = bookOnlyConfirmCheck ? bookOnlyConfirmCheck.checked : true;
    const autoUpgrade = autoUpgradationCheck ? autoUpgradationCheck.checked : true;
    const paymentPref = paymentPreference ? paymentPreference.value : 'UPI';

    state.journeyConfig = {
      source,
      destination,
      date,
      trainNumber,
      travelClass,
      quota,
      bookOnlyConfirm,
      autoUpgrade,
      paymentPreference: paymentPref,
    };

    await chrome.storage.local.set({ journeyConfig: state.journeyConfig });
    addLog(`Journey saved: ${source} ➔ ${destination} (${quota})`);
    renderDashboard();
    showBanner('Journey configuration saved successfully!', 'success');
  }

  // ── Assistant Controls & Communication ─────────────────────────────────────

  async function handleStartAutoPilot() {
    syncAndSaveJourneyFromInputs();
    if (!state.journeyConfig || !state.journeyConfig.source || !state.journeyConfig.destination) {
      showBanner('Please configure and save your Journey details first!', 'danger');
      switchTab('journey');
      return;
    }
    if (state.passengers.length === 0) {
      showBanner('Please add at least one passenger first!', 'danger');
      switchTab('passengers');
      return;
    }

    if (autoPilotBadge) {
      autoPilotBadge.textContent = 'RUNNING 🚀';
      autoPilotBadge.style.background = '#22c55e';
    }
    setAssistantStatus('Auto-Pilot', 'var(--success)');
    addLog('🚀 Launching Auto-Pilot: Hands-Free Tatkal Booking activated!');
    showBanner('Auto-Pilot Launched! Auto-Searching ➔ Auto-Booking Train ➔ Auto-Filling Passengers!', 'success');

    const res = await sendActionToBackground('START_AUTOPILOT', { config: state.journeyConfig });
    if (!res || !res.success) {
      addLog('Auto-Pilot Note: ' + (res && res.error ? res.error : 'Active'));
    }
  }

  async function handleStartAssistant() {
    setAssistantStatus('Running...', 'var(--success)');
    addLog('Assistant started: checking booking page...');
    showBanner('Assistant started. Communicating with IRCTC tab...', 'info');

    const res = await sendActionToBackground('START_AUTOFILL');
    if (res && res.success) {
      setAssistantStatus('Active', 'var(--success)');
      const page = res.pageState || 'detected';
      if (page === 'search') {
        addLog('Step 1 complete: Journey details filled. Click "Search Trains", pick your train & class, then click "Book Now".');
        showBanner('Journey details entered! 👉 Click "Search Trains", pick train/class, and click "Book Now". Passengers will auto-fill on the booking page!', 'success');
      } else if (page === 'trainList') {
        addLog('Step 2: Train results found. Automatically selecting train & class...');
        showBanner('Train results detected! Selecting train and clicking Book Now...', 'info');
        handleSelectTrainAndBook();
      } else if (page === 'passengerForm') {
        addLog('Step 2 complete: Passenger details filled!');
        showBanner('Passenger details filled on booking form!', 'success');
      } else {
        addLog(`Assistant active on ${page} page`);
        showBanner(`Assistant active on ${page} page`, 'success');
      }
    } else {
      setAssistantStatus('Error', 'var(--danger)');
      const err = res?.error || 'Could not communicate with IRCTC page';
      addLog(`Error: ${err}`);
      showBanner(err, 'danger');
    }
  }

  async function handleSelectTrainAndBook() {
    addLog('Requesting Train & Class selection...');
    showBanner('Locating train, checking class availability, and clicking Book Now...', 'info');
    setAssistantStatus('Selecting Train', 'var(--warning)');

    const res = await sendActionToBackground('SELECT_TRAIN');
    if (res && res.success) {
      addLog('Train and class selected! Book Now clicked.');
      showBanner('Train and class selected! Proceeding to passenger details...', 'success');
      setAssistantStatus('Booked', 'var(--success)');
    } else {
      const err = (res && res.error) ? res.error : 'Could not find train or Book Now button';
      addLog('Train selection note: ' + err);
      showBanner(err, 'warning');
      setAssistantStatus('Action Required', 'var(--warning)');
    }
  }

  async function handleStopAssistant() {
    setAssistantStatus('Stopped', 'var(--text-secondary)');
    addLog('Assistant stopped by user');

    const res = await sendActionToBackground('STOP_AUTOFILL');
    if (res && res.success) {
      showBanner('Assistant stopped', 'info');
    }
  }

  async function handleFillPassengers() {
    addLog('Requesting passenger autofill...');
    showBanner('Filling passenger details...', 'info');

    const res = await sendActionToBackground('FILL_PASSENGERS');
    if (res && res.success) {
      const count = res.filledPassengers || 0;
      addLog(`Filled ${count} passenger(s) on booking form`);
      showBanner(`Successfully filled ${count} passenger(s)!`, 'success');
    } else {
      const err = res?.error || 'Passenger fields not found on page';
      addLog(`Passenger fill: ${err}`);
      showBanner('Passenger fields are on the booking page! Click "Search Trains" ➔ select train & class ➔ "Book Now". Passengers will fill there.', 'warning');
    }
  }

  async function handleFillJourney() {
    syncAndSaveJourneyFromInputs();
    addLog('Requesting journey details autofill...');
    showBanner('Filling journey details on search page...', 'info');

    const res = await sendActionToBackground('FILL_JOURNEY');
    if (res && res.success) {
      addLog('Journey details populated (Source, Destination, Date, Quota, Class)');
      showBanner('Journey details entered! 👉 Click "Search Trains" to view trains.', 'success');
    } else {
      const err = res?.error || 'Search form fields not found';
      addLog(`Journey fill failed: ${err}`);
      showBanner(err, 'warning');
    }
  }

  async function handleValidateForm() {
    addLog('Validating passenger form fields...');
    const res = await sendActionToBackground('VALIDATE_FORM');

    if (res && res.success) {
      if (res.valid) {
        addLog(`Form validated successfully! (${res.validatedRows || 0} rows verified)`);
        showBanner(`Validation passed! All ${res.validatedRows || 0} passenger rows are valid.`, 'success');
      } else {
        const issues = (res.errors || []).join(', ');
        addLog(`Validation issues: ${issues}`);
        showBanner(`Validation warnings: ${issues}`, 'warning');
      }
    } else {
      const err = res?.error || 'No form found to validate';
      addLog(`Validation failed: ${err}`);
      showBanner(err, 'danger');
    }
  }

  async function sendActionToBackground(action, data = {}) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, data }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: false, error: 'No response' });
        }
      });
    });
  }

  async function checkExtensionStatus() {
    const res = await sendActionToBackground('GET_STATUS');
    if (res && res.success && res.state) {
      const isRunning = res.state.assistantRunning;
      if (isRunning) {
        setAssistantStatus('Running', 'var(--success)');
      }
    }
  }

  function setAssistantStatus(text, color) {
    if (assistantBadge) {
      assistantBadge.textContent = text;
      assistantBadge.style.backgroundColor = color;
      assistantBadge.style.color = '#fff';
    }
  }

  // ── Activity Logging ───────────────────────────────────────────────────────

  function addLog(msg) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    state.logs.unshift({ time, msg });
    if (state.logs.length > 50) state.logs.pop();

    chrome.storage.local.set({ activityLogs: state.logs });
    renderActivityLog();
  }

  function renderActivityLog() {
    if (!activityLog) return;
    if (state.logs.length === 0) {
      activityLog.innerHTML = '<p class="log-empty">No activity recorded yet.</p>';
      return;
    }

    activityLog.innerHTML = state.logs
      .map(
        (entry) => `
        <div style="margin-bottom: 4px; font-family: monospace; font-size: 11px;">
          <span style="color: var(--text-muted);">[${entry.time}]</span>
          <span>${escapeHtml(entry.msg)}</span>
        </div>
      `
      )
      .join('');
  }

  // ── Reset / Clear All ──────────────────────────────────────────────────────

  async function handleClearAllData() {
    if (!confirm('Are you sure you want to delete ALL saved passengers, groups, journey configurations, and logs?')) {
      return;
    }

    await chrome.storage.local.clear();
    state = {
      passengers: [],
      groups: [],
      activeGroupId: null,
      journeyConfig: null,
      settings: { isEnabled: true },
      currentTab: 'dashboard',
      logs: [],
    };

    renderDashboard();
    renderPassengers();
    renderGroups();
    if (journeyForm) journeyForm.reset();
    renderActivityLog();
    showBanner('All extension data has been reset.', 'info');
  }

  // ── Banner Messages ────────────────────────────────────────────────────────

  function showBanner(text, type = 'info') {
    if (!inlineMessage || !messageText) return;

    messageText.textContent = text;
    inlineMessage.className = `inline-message ${type}`;
    inlineMessage.classList.remove('hidden');

    setTimeout(() => {
      inlineMessage.classList.add('hidden');
    }, 5500);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});

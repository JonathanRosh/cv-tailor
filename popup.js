import { CONFIG } from './config.js';
import { getGoogleDriveCVs } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('login-btn');
  const authSection = document.getElementById('auth-section');
  const mainSection = document.getElementById('main-section');
  const statusMsg = document.getElementById('status-msg');
  const cvSelect = document.getElementById('cv-select');
  const refreshBtn = document.getElementById('refresh-cv-btn');
  const tailorBtn = document.getElementById('tailor-btn');
  const tailorSpinner = document.getElementById('tailor-spinner');
  const tailorBtnText = document.getElementById('tailor-btn-text');
  const geminiKeyInput = document.getElementById('gemini-key');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const apiKeyInputContainer = document.getElementById('api-key-input-container');
  const apiKeyStatusContainer = document.getElementById('api-key-status-container');
  const clearKeyBtn = document.getElementById('clear-key-btn');

  let authToken = null;
  let savedApiKey = CONFIG.API_KEYS.GEMINI || null;

  // Load saved API key and tailoring state
  chrome.storage.local.get(['geminiApiKey', 'isTailoring'], function (result) {
    if (result.geminiApiKey) {
      savedApiKey = result.geminiApiKey;
      showApiKeySetUI();
    }
    if (result.isTailoring) {
      setTailoringUI(true);
    }
  });

  function setTailoringUI(isTailoring) {
    if (isTailoring) {
      tailorBtn.disabled = true;
      tailorSpinner.classList.remove('hidden');
      tailorBtnText.textContent = "Tailoring...";
      statusMsg.textContent = "Sending to AI for tailoring. This might take a minute...";
    } else {
      tailorBtn.disabled = false;
      tailorSpinner.classList.add('hidden');
      tailorBtnText.textContent = "Tailor CV to this Job";
    }
  }

  // Listen to storage changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.isTailoring !== undefined) {
      if (changes.isTailoring.newValue === true) {
        setTailoringUI(true);
      } else {
        setTailoringUI(false);
        if (changes.isTailoring.newValue === false && statusMsg.textContent.includes("Sending to AI")) {
          statusMsg.textContent = "Process finished! Check your new Google Docs tab or notifications.";
        }
      }
    }
  });

  saveKeyBtn.addEventListener('click', () => {
    const key = geminiKeyInput.value.trim();
    if (key) {
      chrome.storage.local.set({ geminiApiKey: key }, () => {
        savedApiKey = key;
        showApiKeySetUI();
        statusMsg.textContent = "API Key saved!";
        setTimeout(() => { statusMsg.textContent = ""; }, 2000);
      });
    }
  });

  clearKeyBtn.addEventListener('click', () => {
    chrome.storage.local.remove('geminiApiKey', () => {
      savedApiKey = null;
      geminiKeyInput.value = '';
      apiKeyInputContainer.classList.remove('hidden');
      apiKeyStatusContainer.classList.add('hidden');
      statusMsg.textContent = "API Key cleared.";
      setTimeout(() => { statusMsg.textContent = ""; }, 2000);
    })
  });

  function showApiKeySetUI() {
    apiKeyInputContainer.classList.add('hidden');
    apiKeyStatusContainer.classList.remove('hidden');
  }

  // Check if we already have a token
  chrome.identity.getAuthToken({ interactive: false }, function (token) {
    if (token) {
      authToken = token;
      showMainSection(token);
    }
  });

  loginBtn.addEventListener('click', () => {
    statusMsg.textContent = "Connecting...";
    chrome.runtime.sendMessage({ action: 'login' }, (response) => {
      if (response && response.success) {
        authToken = response.token;
        showMainSection(authToken);
      } else {
        statusMsg.textContent = "Login failed: " + (response ? response.error : "Unknown error");
      }
    });
  });

  refreshBtn.addEventListener('click', () => {
    if (authToken) {
      statusMsg.textContent = "Refreshing CV list...";
      fetchCVs(authToken);
    }
  });

  function showMainSection(token) {
    authSection.classList.add('hidden');
    mainSection.classList.remove('hidden');
    statusMsg.textContent = "Fetching your CVs...";
    fetchCVs(token);
  }

  function fetchCVs(token) {
    getGoogleDriveCVs(token)
      .then(data => {
        if (data.error) {
          if (data.error.code === 401) {
            handleAuthError(token);
          } else {
            statusMsg.textContent = "Error fetching files: " + data.error.message;
          }
          return;
        }

        cvSelect.innerHTML = '<option value="">Select a document...</option>';

        if (data.files && data.files.length > 0) {
          data.files.forEach(file => {
            const option = document.createElement('option');
            option.value = file.id;
            option.textContent = file.name;
            cvSelect.appendChild(option);
          });

          chrome.storage.local.get(['selectedCvId'], function (result) {
            if (result.selectedCvId) {
              // Restore selection if document still exists
              const found = Array.from(cvSelect.options).find(opt => opt.value === result.selectedCvId);
              if (found) {
                cvSelect.value = result.selectedCvId;
                statusMsg.textContent = "Base CV restored. Ready to tailor!";
              } else {
                chrome.storage.local.remove('selectedCvId');
                statusMsg.textContent = "Please select your Base CV.";
              }
            } else {
              statusMsg.textContent = "Please select your Base CV.";
            }
          });

        } else {
          statusMsg.textContent = "No document files found in your Drive.";
        }
      })
      .catch(error => {
        console.error('Error fetching files:', error);
        statusMsg.textContent = "Error fetching files from Google Drive.";
      });
  }

  function handleAuthError(token) {
    console.warn("Auth token invalid (401). Revoking and clearing cache...");
    // 1. Force Google to revoke the token on their end
    fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
      .finally(() => {
        // 2. Remove the token from Chrome's cache so it asks again
        if (chrome.identity.clearAllCachedAuthTokens) {
          chrome.identity.clearAllCachedAuthTokens(() => {
            resetToLoginScreen();
          });
        } else {
          chrome.identity.removeCachedAuthToken({ token: token }, () => {
            resetToLoginScreen();
          });
        }
      });
  }

  function resetToLoginScreen() {
    authToken = null;
    mainSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    statusMsg.textContent = "Session expired. Please click Connect to log back in.";
  }

  cvSelect.addEventListener('change', (e) => {
    if (e.target.value) {
      chrome.storage.local.set({ selectedCvId: e.target.value });
      statusMsg.textContent = "Base CV selected. Ready to tailor!";
    }
  });

  tailorBtn.addEventListener('click', () => {
    const selectedCvId = cvSelect.value;
    const geminiKey = savedApiKey || geminiKeyInput.value.trim();

    if (!selectedCvId) {
      statusMsg.textContent = "Please select a Base CV first.";
      return;
    }
    if (!geminiKey) {
      statusMsg.textContent = "Please enter your Gemini API Key.";
      return;
    }

    statusMsg.textContent = "Extracting job description...";
    tailorBtn.disabled = true;
    tailorSpinner.classList.remove('hidden');
    tailorBtnText.textContent = "Tailoring...";

    // Get active tab and extract text
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) {
        statusMsg.textContent = "Cannot access the active tab.";
        tailorBtn.disabled = false;
        return;
      }

      // Execute script to get page text
      chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => document.body.innerText
      }, (injectionResults) => {
        if (chrome.runtime.lastError || !injectionResults || !injectionResults[0]) {
          statusMsg.textContent = "Failed to extract page text.";
          console.error(chrome.runtime.lastError);
          tailorBtn.disabled = false;
          tailorSpinner.classList.add('hidden');
          tailorBtnText.textContent = "Tailor CV to this Job";
          return;
        }

        const jobDescription = injectionResults[0].result;
        statusMsg.textContent = "Sending to AI for tailoring. This might take a minute...";

        // Send to background for processing. Wait to save jobDescription first for retry functionality.
        chrome.storage.local.set({ lastJobDescription: jobDescription, isTailoring: true }, () => {
          chrome.runtime.sendMessage({
            action: 'tailor_cv',
            data: {
              cvId: selectedCvId,
              apiKey: geminiKey,
              jobDescription: jobDescription,
              authToken: authToken
            }
          }, (response) => {
            tailorBtn.disabled = false;
            tailorSpinner.classList.add('hidden');
            tailorBtnText.textContent = "Tailor CV to this Job";

            if (response && response.success) {
              statusMsg.textContent = "Tailoring Complete! Check your new Google Docs tab.";
            } else {
              if (response && response.error && response.error.includes("401")) {
                handleAuthError(authToken);
              } else {
                statusMsg.textContent = "Error: " + (response ? response.error : "Unknown Error");
              }
            }
          });
        });
      });
    });
  });
});

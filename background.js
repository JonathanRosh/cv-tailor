import { handleRetryTailor, handleDownloadPdf, handleTailorCV } from './services.js';

// Function to fetch auth token with a retry mechanism for interactive stuck states
function fetchAuthTokenWithRetry(interactive, sendResponse) {
    chrome.identity.getAuthToken({ interactive: interactive }, function (token) {
        if (chrome.runtime.lastError) {
            const error = chrome.runtime.lastError;
            console.error("Error getting auth token:", error);

            if (error.message && (error.message.includes("401") || error.message.includes("OAuth2") || error.message.includes("Interactive") || error.message.includes("invalid"))) {
                console.warn("Auth stuck on 401. Clearing cached tokens and retrying.");
                if (chrome.identity.clearAllCachedAuthTokens) {
                    chrome.identity.clearAllCachedAuthTokens(function () {
                        if (chrome.runtime.lastError) {
                            sendResponse({ success: false, error: chrome.runtime.lastError.message });
                        } else {
                            chrome.identity.getAuthToken({ interactive: interactive }, function (retryToken) {
                                if (chrome.runtime.lastError) {
                                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                                } else if (retryToken) {
                                    sendResponse({ success: true, token: retryToken });
                                } else {
                                    sendResponse({ success: false, error: "Failed to obtain token without error." });
                                }
                            });
                        }
                    });
                } else {
                    sendResponse({ success: false, error: error.message });
                }
            } else {
                sendResponse({ success: false, error: error.message });
            }
        } else if (token) {
            sendResponse({ success: true, token: token });
        } else {
            sendResponse({ success: false, error: "Failed to obtain token without an error." });
        }
    });
}

// Background service worker
chrome.runtime.onInstalled.addListener(() => {
    console.log("CV Tailor Extension Installed");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'login') {
        fetchAuthTokenWithRetry(true, sendResponse);
        return true;
    }

    if (request.action === 'tailor_cv') {
        handleTailorCV(request.data, sendResponse);
        return true;
    }

    if (request.action === 'download_pdf') {
        handleDownloadPdf(request.data, sender, sendResponse);
        return true;
    }

    if (request.action === 'retry_tailor') {
        handleRetryTailor(request.data, sender, sendResponse);
        return true;
    }
});

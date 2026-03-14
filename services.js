import { CONFIG } from './config.js';
import { exportGoogleDocText, askGeminiToTailor, getUserProfile, duplicateGoogleDoc, applyBatchUpdateToDoc } from './api.js';

export async function handleRetryTailor(data, sender, sendResponse) {
    const { docId } = data;
    chrome.storage.local.set({ isTailoring: true });

    // First, delete the current document the user didn't like
    chrome.identity.getAuthToken({ interactive: false }, async function (token) {
        if (token) {
            try {
                await fetch(`${CONFIG.URLS.DRIVE_API}/${docId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            } catch (e) {
                console.error("Failed to delete old rejected CV", e);
            }
        }
    });

    // Re-run the tailor process
    chrome.storage.local.get(['selectedCvId', 'geminiApiKey', 'lastJobDescription'], (result) => {
        if (!result.selectedCvId || !result.geminiApiKey || !result.lastJobDescription) {
            sendResponse({ success: false, error: "Missing required data to retry. Please use the popup again." });
            chrome.storage.local.set({ isTailoring: false });
            return;
        }

        chrome.identity.getAuthToken({ interactive: false }, (token) => {
            if (!token) {
                sendResponse({ success: false, error: "Authentication failed during retry." });
                chrome.storage.local.set({ isTailoring: false });
                return;
            }

            handleTailorCV({
                cvId: result.selectedCvId,
                apiKey: result.geminiApiKey,
                jobDescription: result.lastJobDescription,
                authToken: token,
                isRetry: true
            }, sendResponse);
        });
    });
}

export async function handleDownloadPdf(data, sender, sendResponse) {
    chrome.identity.getAuthToken({ interactive: false }, async function (token) {
        if (!token) {
            sendResponse({ success: false, error: "No auth token found." });
            return;
        }

        try {
            const safeTitle = data.jobTitle.replace(/[/\?<>\\:\*\|":]/g, '').trim();
            const safeCompany = data.company.replace(/[/\?<>\\:\*\|":]/g, '').trim();
            const safeCvName = data.cvName.replace(/[/\?<>\\:\*\|":]/g, '').trim();

            const pdfUrl = `${CONFIG.URLS.DRIVE_API}/${data.docId}/export?mimeType=application/pdf`;

            chrome.downloads.download({
                url: pdfUrl,
                filename: `CVs/${safeTitle} - ${safeCompany}/${safeCvName}.pdf`,
                saveAs: false,
                headers: [{ name: 'Authorization', value: `Bearer ${token}` }]
            }, async (downloadId) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true, downloadId });

                    // Auto-delete the tailored CV from user's Google Drive
                    try {
                        const deleteResponse = await fetch(`${CONFIG.URLS.DRIVE_API}/${data.docId}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (!deleteResponse.ok) console.error("Failed to delete tailored CV.");
                    } catch (e) {
                        console.error("Error deleting from Drive:", e);
                    }

                    if (sender && sender.tab && sender.tab.id) {
                        chrome.tabs.remove(sender.tab.id);
                    }
                }
            });
        } catch (err) {
            console.error(err);
            sendResponse({ success: false, error: err.message });
        }
    });
}

export async function handleTailorCV(data, sendResponse) {
    try {
        const { cvId, apiKey, jobDescription, authToken, isRetry } = data;

        console.log("Fetching Base CV text...");
        const baseCvText = await exportGoogleDocText(cvId, authToken);
        console.log("Base CV loaded, length: ", baseCvText.length);

        console.log("Calling Gemini API for intelligent find & replace...");
        const geminiData = await askGeminiToTailor(baseCvText, jobDescription, apiKey);

        let replacementsJsonString = geminiData.candidates[0].content.parts[0].text.trim();
        if (replacementsJsonString.startsWith('```')) {
            replacementsJsonString = replacementsJsonString.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        }

        const parsedResult = JSON.parse(replacementsJsonString);
        const replacements = parsedResult.replacements || [];
        const jobTitle = parsedResult.jobTitle || "Job";
        const company = parsedResult.company || "Company";

        console.log(`Gemini tailoring complete. Generated ${replacements.length} replacements for ${jobTitle} at ${company}.`);

        console.log("Fetching user profile for name...");
        const profileData = await getUserProfile(authToken);
        const userName = profileData.name || "User";
        const newDocName = `CV for ${jobTitle} - ${company}`;
        const downloadBaseName = `${userName} CV`;

        console.log(`Duplicating Base CV as '${newDocName}'...`);
        const newDoc = await duplicateGoogleDoc(cvId, newDocName, authToken);

        if (replacements && replacements.length > 0) {
            console.log("Applying text replacements to new document...");
            await applyBatchUpdateToDoc(newDoc.id, replacements, authToken);
            console.log("Replacements applied successfully!");
        }

        const queryParams = new URLSearchParams({
            cv_tailor: "true",
            jobTitle: jobTitle,
            company: company,
            cvName: downloadBaseName
        });

        if (!isRetry) {
            chrome.tabs.create({ url: `https://docs.google.com/document/d/${newDoc.id}/edit?${queryParams.toString()}` });
        }

        try {
            sendResponse({
                success: true,
                newDocId: newDoc.id,
                cvName: downloadBaseName,
                jobTitle: jobTitle,
                company: company
            });
        } catch (e) {
            console.log("Popup was closed before response could be sent.");
        }

    } catch (error) {
        console.error("Tailor CV Error:", error);

        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'CV Tailor Error',
            message: `Failed to tailor CV: ${error.message}`
        });

        try {
            sendResponse({ success: false, error: error.message });
        } catch (e) {
            console.log("Popup was closed before error response could be sent.");
        }
    } finally {
        chrome.storage.local.set({ isTailoring: false });
    }
}

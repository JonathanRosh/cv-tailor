import { CONFIG } from './config.js';

export async function exportGoogleDocText(docId, authToken) {
    const response = await fetch(`${CONFIG.URLS.DRIVE_API}/${docId}/export?mimeType=text/plain`, {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    });
    if (!response.ok) throw new Error("Failed to read Base CV content. Status: " + response.status);
    return await response.text();
}

export async function askGeminiToTailor(baseCvText, jobDescription, apiKey) {
    const promptText = `${CONFIG.PROMPTS.TAILOR_SUMMARY.INSTRUCTIONS}\n\n${CONFIG.PROMPTS.TAILOR_SUMMARY.CONSTRAINTS}\n\n--- BASE CV ---\n${baseCvText}\n\n--- JOB DESCRIPTION ---\n${jobDescription.substring(0, 10000)}`;

    const requestBody = {
        contents: [{ parts: [{ text: promptText }] }]
    };

    const response = await fetch(`${CONFIG.URLS.GEMINI_BASE}${CONFIG.URLS.GEMINI_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error("Gemini API Error: " + errorText);
    }

    return await response.json();
}

export async function getUserProfile(authToken) {
    const response = await fetch(CONFIG.URLS.USER_INFO, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    });
    return await response.json();
}

export async function duplicateGoogleDoc(docId, newDocName, authToken) {
    const response = await fetch(`${CONFIG.URLS.DRIVE_API}/${docId}/copy`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newDocName })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Failed to duplicate Base CV. Status: ${response.status}, Error: ${errText}`);
    }
    return await response.json();
}

export async function applyBatchUpdateToDoc(docId, replacements, authToken) {
    const requests = replacements.map(rep => ({
        replaceAllText: {
            containsText: {
                text: rep.oldText,
                matchCase: true
            },
            replaceText: rep.newText
        }
    }));

    const response = await fetch(`${CONFIG.URLS.DOCS_API}/${docId}:batchUpdate`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
    });

    if (!response.ok) {
        const errText = await response.text();
        console.warn(`Doc update had issues, but file was created. Error: ${errText}`);
    }
}

export async function getGoogleDriveCVs(token) {
    const query = encodeURIComponent("(mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document') and trashed=false");
    const response = await fetch(`${CONFIG.URLS.DRIVE_API}?q=${query}&fields=files(id,name)&orderBy=modifiedTime desc&pageSize=20`, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/json'
        }
    });
    return await response.json();
}

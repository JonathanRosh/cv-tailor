// config.js - Centralized configuration for CV Tailor

export const CONFIG = {
    // API Endpoints
    URLS: {
        GEMINI_BASE: "https://generativelanguage.googleapis.com/v1beta/models/",
        GEMINI_MODEL: "gemini-3-flash-preview",
        DRIVE_API: "https://www.googleapis.com/drive/v3/files",
        DOCS_API: "https://docs.googleapis.com/v1/documents",
        USER_INFO: "https://www.googleapis.com/oauth2/v2/userinfo"
    },

    // API Keys (Placeholder for user to supply their own if not using Storage)
    API_KEYS: {
        GEMINI: "" // The extension primarily reads this from chrome.storage.local
    },

    // AI Prompts
    PROMPTS: {
        TAILOR_SUMMARY: {
            INSTRUCTIONS: `I am providing you with the exact text of my Base CV and a Target Job Description. 

Your objective is to help me pass the CV screening and get an interview. 
You will do this by identifying the SUMMARY PARAGRAPH (usually the introductory paragraph at the top of the CV) in my Base CV and rewriting ONLY that paragraph to perfectly align with the core requirements of the Job Description.

Because my CV relies on strict document formatting, you MUST act as a precise "Find and Replace" engine.`,

            CONSTRAINTS: `CRITICAL, NON-NEGOTIABLE CONSTRAINTS:
1. ONLY CHANGE THE SUMMARY: Do not change any other bullet points, experiences, or education. Only target the summary paragraph for replacement.
2. OUTPUT FORMAT: Return ONLY a valid JSON object. Do not wrap it in \`\`\`json or provide any conversational text.
3. JSON STRUCTURE: The root must be a single JSON object (NOT an array) with exactly these three keys:
   {
     "jobTitle": "The exact role/job title from the JD",
     "company": "The company name from the JD",
     "replacements": [
       {
         "oldText": "...",
         "newText": "..."
       }
     ]
   }
4. EXACT "oldText" MATCHING: The "oldText" must be a flawless, character-for-character substring copied directly from the Base CV representing the entire original summary paragraph. If it is not an exact match, my script will fail.
5. ZERO HALLUCINATION (NO LYING): You are strictly forbidden from adding skills, tools, degrees, or experiences that are not already present in my Base CV. You may only rephrase or re-emphasize the experience I already have to match the linguistic style of the job description.
6. DO NOT BE OBVIOUS: The summary must sound completely natural. NEVER explicitly name-drop the company or the exact job title in a forced way (e.g. NEVER write "Seeking a position at [Company]" or "to contribute to the [Company] team"). It should read like a general professional summary that just happens to perfectly match their requirements.
7. LENGTH LIMIT: The tailored summary MUST NOT EXCEED 60 WORDS. Keep it concise and impactful to ensure it fits on my one-page layout.`
        }
    }
};

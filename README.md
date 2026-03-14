# CV Tailor
A Google Chrome extension that leverages the Gemini API to automatically tailor the summary section of your Google Docs CV to any job description you are currently viewing online. Designed and developed with the assistance of AntiGravity IDE.

## Features
*   **Google Drive Integration**: Fetches your base `.docx` / Google Doc CV directly from your Google Drive.
*   **Context-Aware AI**: Reads the job description directly from your active browser tab.
*   **Smart Replacement**: Precisely targets your CV's summary paragraph and replaces it with a highly-tailored version of up to 60 words based on the job description.
*   **Google Docs Injection**: Automatically duplicates your base CV and injects the new AI-tailored text, opening it in a new tab for your review.
*   **PDF Export**: Approving the CV allows instant download as a clean `.pdf` file to your computer's default `Downloads` folder.
*   **Secure API Handling**: Uses Google OAuth 2.0 for secure account connection, and stores your Gemini API key strictly in your local Chrome browser storage.

## How to Install (Developer Mode)
This extension runs entirely locally on your machine.

1.  Clone or download this repository to a folder on your computer.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  In the top right corner, toggle **Developer mode** to **ON**.
4.  Click the **Load unpacked** button in the top left.
5.  Select the folder containing this code.
6.  Pin the CV Tailor icon to your Chrome toolbar for easy access!

## Setup Prerequisites
To use the extension, you will need two things:

1.  **Google OAuth Client ID**: You must set up a project in the [Google Cloud Console](https://console.cloud.google.com/), enable the **Google Drive API** and **Google Docs API**, and generate an OAuth 2.0 Client ID for a "Chrome App". Paste this Client ID into the `manifest.json` file.
2.  **Gemini API Key**: Get a free API key from [Google AI Studio](https://aistudio.google.com/). You will paste this directly into the extension's popup UI on your first run.

## Tech Stack
*   Vanilla JavaScript (ES Modules)
*   HTML/CSS
*   Chrome Extension API (Manifest V3)
*   Google Drive & Google Docs REST APIs
*   Gemini API (`gemini-3-flash-preview`)

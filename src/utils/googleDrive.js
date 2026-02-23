// Google Drive Integration
// To use this, you need to:
// 1. Create a Google Cloud project at https://console.cloud.google.com
// 2. Enable the Google Drive API
// 3. Create OAuth 2.0 credentials (Web application)
// 4. Add your domain to authorized origins
// 5. Replace CLIENT_ID below with your client ID

const CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com'
const API_KEY = 'YOUR_API_KEY' // Optional, for public files only
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

let tokenClient
let gapiInited = false
let gisInited = false

// Load the Google API client library
export async function loadGoogleApi() {
  return new Promise((resolve, reject) => {
    // Load GAPI
    const gapiScript = document.createElement('script')
    gapiScript.src = 'https://apis.google.com/js/api.js'
    gapiScript.onload = () => {
      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: [DISCOVERY_DOC]
          })
          gapiInited = true
          checkAndResolve()
        } catch (err) {
          reject(err)
        }
      })
    }
    document.body.appendChild(gapiScript)

    // Load GIS (Google Identity Services)
    const gisScript = document.createElement('script')
    gisScript.src = 'https://accounts.google.com/gsi/client'
    gisScript.onload = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '' // Set later
      })
      gisInited = true
      checkAndResolve()
    }
    document.body.appendChild(gisScript)

    function checkAndResolve() {
      if (gapiInited && gisInited) {
        resolve()
      }
    }
  })
}

// Sign in to Google
export function signIn() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google API not initialized'))
      return
    }

    tokenClient.callback = (response) => {
      if (response.error) {
        reject(response)
      } else {
        resolve(response)
      }
    }

    if (window.gapi.client.getToken() === null) {
      tokenClient.requestAccessToken({ prompt: 'consent' })
    } else {
      tokenClient.requestAccessToken({ prompt: '' })
    }
  })
}

// Sign out
export function signOut() {
  const token = window.gapi.client.getToken()
  if (token !== null) {
    window.google.accounts.oauth2.revoke(token.access_token)
    window.gapi.client.setToken('')
  }
}

// Check if signed in
export function isSignedIn() {
  return window.gapi?.client?.getToken() !== null
}

// Save file to Google Drive
export async function saveToGoogleDrive(fileName, content) {
  if (!isSignedIn()) {
    await signIn()
  }

  const file = new Blob([JSON.stringify(content)], { type: 'application/json' })

  const metadata = {
    name: fileName + '.json',
    mimeType: 'application/json'
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${window.gapi.client.getToken().access_token}`
    },
    body: form
  })

  return response.json()
}

// List survey files from Google Drive
export async function listSurveyFiles() {
  if (!isSignedIn()) {
    await signIn()
  }

  const response = await window.gapi.client.drive.files.list({
    pageSize: 50,
    fields: 'files(id, name, modifiedTime)',
    q: "mimeType='application/json' and name contains '.json'"
  })

  return response.result.files
}

// Load file from Google Drive
export async function loadFromGoogleDrive(fileId) {
  if (!isSignedIn()) {
    await signIn()
  }

  const response = await window.gapi.client.drive.files.get({
    fileId: fileId,
    alt: 'media'
  })

  return response.result
}

// Update existing file on Google Drive
export async function updateOnGoogleDrive(fileId, content) {
  if (!isSignedIn()) {
    await signIn()
  }

  const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${window.gapi.client.getToken().access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(content)
  })

  return response.json()
}

// Delete file from Google Drive
export async function deleteFromGoogleDrive(fileId) {
  if (!isSignedIn()) {
    await signIn()
  }

  await window.gapi.client.drive.files.delete({
    fileId: fileId
  })
}

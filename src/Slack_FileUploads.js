/******************************************************
 *
 * IZA
 * File: Slack_FileUploads.gs
 *
 * Purpose:
 * Handles Slack file_shared events.
 *
 * Responsibilities:
 * - First check whether the file belongs to an active
 *   invoice upload flow.
 * - Otherwise save approved channel uploads to Drive.
 *
 ******************************************************/


/************************************
 * SLACK FILE ENTRY POINT
 ************************************/

function saveSlackFileToDrive(fileId) {
  if (handlePendingInvoiceUploadFromSlackFile_(fileId)) {
    return;
  }

  const props = PropertiesService.getScriptProperties();

  const processedKey = `PROCESSED_${fileId}`;
  if (props.getProperty(processedKey)) return;

  const token = props.getProperty("SLACK_BOT_TOKEN");

  if (!token) {
    throw new Error("Missing SLACK_BOT_TOKEN script property.");
  }

  const fileInfo = getSlackFileInfo_(fileId, token);

  if (!fileInfo.ok) {
    throw new Error(`files.info failed: ${fileInfo.error}`);
  }

  const file = fileInfo.file;

  if (!isFileFromAllowedChannel_(file)) {
    return;
  }

  const savedFile = saveSlackFileBlobToDrive_(file, token);

  props.setProperty(processedKey, savedFile.getId());

  sendSlackMessage(
    ALLOWED_CHANNEL,
    `✅ *${file.name}* has been saved to Google Drive.\n${savedFile.getUrl()}`
  );
}


/************************************
 * FILE INFO
 ************************************/

function getSlackFileInfo_(fileId, token) {
  const response = UrlFetchApp.fetch(
    `https://slack.com/api/files.info?file=${fileId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      },
      muteHttpExceptions: true
    }
  );

  return JSON.parse(response.getContentText());
}

function isFileFromAllowedChannel_(file) {
  const channels = [
    ...(file.channels || []),
    ...(file.groups || [])
  ];

  return channels.includes(ALLOWED_CHANNEL);
}


/************************************
 * SAVE TO DRIVE
 ************************************/

function saveSlackFileBlobToDrive_(file, token) {
  const fileName = file.name;
  const parentFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

  const uploaderName = getSlackUserName_(file.user);
  const folder = getOrCreateSubfolder_(parentFolder, uploaderName);

  const existingFiles = folder.getFilesByName(fileName);

  if (existingFiles.hasNext()) {
    PropertiesService.getScriptProperties()
      .setProperty(`PROCESSED_${file.id}`, "duplicate_filename");

    sendSlackMessage(
      ALLOWED_CHANNEL,
      `⚠️ Duplicate file not uploaded: *${fileName}*\nA file with this name already exists in Google Drive.`
    );

    throw new Error(`Duplicate file not uploaded: ${fileName}`);
  }

  const downloadUrl = file.url_private_download || file.url_private;

  if (!downloadUrl) {
    throw new Error("No download URL found.");
  }

  const fileResponse = UrlFetchApp.fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    muteHttpExceptions: true
  });

  if (fileResponse.getResponseCode() !== 200) {
    throw new Error(`Download failed (${fileResponse.getResponseCode()})`);
  }

  const blob = fileResponse.getBlob();
  blob.setName(fileName);

  return folder.createFile(blob);
}


/************************************
 * SLACK USER NAME
 ************************************/

function getSlackUserName_(userId) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SLACK_BOT_TOKEN");

  const response = UrlFetchApp.fetch(
    `https://slack.com/api/users.info?user=${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      },
      muteHttpExceptions: true
    }
  );

  const data = JSON.parse(response.getContentText());

  if (!data.ok) {
    return userId;
  }

  const user = data.user;

  return (
    user.profile?.display_name ||
    user.profile?.real_name ||
    user.real_name ||
    user.name ||
    userId
  );
}


/************************************
 * DRIVE FOLDER HELPERS
 ************************************/

function getOrCreateSubfolder_(parentFolder, folderName) {
  const cleanName = String(folderName || "Unknown User")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim();

  const folders = parentFolder.getFoldersByName(cleanName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parentFolder.createFolder(cleanName);
}
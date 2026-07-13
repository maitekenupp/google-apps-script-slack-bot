function saveSlackFileToDrive(fileId) {
  const props = PropertiesService.getScriptProperties();

  const processedKey = `PROCESSED_${fileId}`;
  if (props.getProperty(processedKey)) return;

  const token = props.getProperty('SLACK_BOT_TOKEN');

  const fileInfoResponse = UrlFetchApp.fetch(
    `https://slack.com/api/files.info?file=${fileId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true
    }
  );

  const fileInfo = JSON.parse(fileInfoResponse.getContentText());

  if (!fileInfo.ok) {
    throw new Error(`files.info failed: ${fileInfo.error}`);
  }

  const file = fileInfo.file;

  const channels = [
    ...(file.channels || []),
    ...(file.groups || [])
  ];

  if (!channels.includes(ALLOWED_CHANNEL)) return;

  const fileName = file.name;
  const parentFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);

  const uploaderName = getSlackUserName_(file.user);
  const folder = getOrCreateSubfolder_(parentFolder, uploaderName);

  const existingFiles = folder.getFilesByName(fileName);

  if (existingFiles.hasNext()) {
    props.setProperty(processedKey, 'duplicate_filename');

    sendSlackMessage(
      ALLOWED_CHANNEL,
      `⚠️ Duplicate file not uploaded: *${fileName}*\nA file with this name already exists in Google Drive.`
    );

    return;
  }

  const downloadUrl = file.url_private_download || file.url_private;

  if (!downloadUrl) {
    throw new Error('No download URL found');
  }

  const fileResponse = UrlFetchApp.fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true
  });

  if (fileResponse.getResponseCode() !== 200) {
    throw new Error(`Download failed (${fileResponse.getResponseCode()})`);
  }

  const blob = fileResponse.getBlob();
  blob.setName(fileName);

  const savedFile = folder.createFile(blob);

  props.setProperty(processedKey, savedFile.getId());

  sendSlackMessage(
    ALLOWED_CHANNEL,
    `✅ *${fileName}* has been saved to Google Drive.\n${savedFile.getUrl()}`
  );
}

function getSlackUserName_(userId) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('SLACK_BOT_TOKEN');

  const response = UrlFetchApp.fetch(
    `https://slack.com/api/users.info?user=${userId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      muteHttpExceptions: true
    }
  );

  const data = JSON.parse(response.getContentText());

  if (!data.ok) {
    return userId; // fallback
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

function getOrCreateSubfolder_(parentFolder, folderName) {
  const cleanName = folderName.replace(/[\\/:*?"<>|]/g, '').trim();

  const folders = parentFolder.getFoldersByName(cleanName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parentFolder.createFolder(cleanName);
}
/******************************************************
 *
 * IZA
 * File: SOW_HelloSign_Scanner.gs
 *
 * Purpose:
 * Scans the HelloSign / Requested signatures folder,
 * detects manually signed documents, copies final signed
 * files to the official signed folder, and links them
 * back into Notion.
 *
 * Supports:
 * - SOW
 * - Amendment
 *
 ******************************************************/


/************************************
 * SCHEDULED SCAN
 ************************************/

function runScheduledSowSignatureFolderScan() {
  const result = scanHelloSignRequestedSignatures_();

  if (!isSowSignatureNotificationHours_()) {
    return result;
  }

  if (result.signed.length) {
    result.signed.forEach(item => {
      postSlackMessage_(
        CONTRACTOR_CLAIMS_CHANNEL,
        buildSignedSowReceivedBlocks_(item),
        "Signed document received"
      );
    });
  }

  if (result.pendingToSend.length || result.awaitingSignature.length) {
    postSlackMessage_(
      CONTRACTOR_CLAIMS_CHANNEL,
      buildSowSignatureFolderSummaryBlocks_(result),
      "Signature Summary"
    );
  }

  return result;
}

function setupSowSignatureScanTrigger() {
  const functionName = "runScheduledSowSignatureFolderScan";

  ScriptApp
    .getProjectTriggers()
    .forEach(trigger => {
      if (trigger.getHandlerFunction() === functionName) {
        ScriptApp.deleteTrigger(trigger);
      }
    });

  ScriptApp
    .newTrigger(functionName)
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
}

function isSowSignatureNotificationHours_() {
  const hour = Number(
    Utilities.formatDate(
      new Date(),
      "America/Los_Angeles",
      "H"
    )
  );

  return hour >= 9 && hour < 21;
}


/************************************
 * SCAN FOLDERS
 ************************************/

function scanHelloSignRequestedSignatures_() {
  const pendingItems = loadPendingSignatureSows_();
  const helloSignFiles = loadHelloSignRequestedSignatureFiles_();

  const result = {
    signed: [],
    pendingToSend: [],
    awaitingSignature: []
  };

  pendingItems.forEach(item => {
    const match = findHelloSignMatchForSow_(item, helloSignFiles);

    if (!match) {
      result.pendingToSend.push(item);
      return;
    }

    if (match.status === "awaiting") {
      result.awaitingSignature.push({
        ...item,
        helloSignFileName: match.file.name,
        helloSignFileUrl: match.file.url,
        documentType:
          getSignatureDocumentTypeFromTitle_(
            match.file.name || item.pendingFileName
          )
      });
      return;
    }

    if (match.status === "signed") {
      const signedFile = copyHelloSignSignedSowToOfficialFolder_(
        match.file,
        item
      );

      updateSowContractorFileForAssignments_(
        item.assignmentIds,
        signedFile
      );

      trashOldPendingSowFile_(item.pendingFileUrl);

      result.signed.push({
        ...item,
        signedFileName: signedFile.name,
        signedFileUrl: signedFile.url,
        documentType:
          getSignatureDocumentTypeFromTitle_(
            match.file.name || item.pendingFileName
          )
      });
    }
  });

  return result;
}

function loadHelloSignRequestedSignatureFiles_() {
  const folder = DriveApp.getFolderById(
    HELLOSIGN_REQUESTED_SIGNATURES_FOLDER_ID
  );

  const files = folder.getFiles();
  const items = [];

  while (files.hasNext()) {
    const file = files.next();

    items.push({
      id: file.getId(),
      name: file.getName(),
      url: file.getUrl(),
      mimeType: file.getMimeType(),
      documentType: getSignatureDocumentTypeFromTitle_(file.getName())
    });
  }

  return items;
}


/************************************
 * PENDING SIGNATURE ITEMS FROM NOTION
 ************************************/

function loadPendingSignatureSows_() {
  const assignmentRows =
    queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);

  const projectsById = loadSowProjectsById_();
  const groups = {};

  assignmentRows.forEach(row => {
    const p = row.properties;

    const contractorName = getText_(p["Contractor"]);
    if (!contractorName) return;

    const projectId =
      p["Projects 1 related to"]?.relation?.[0]?.id || "";

    const project = projectsById[projectId];
    if (!project) return;

    const signatureFile =
      getSowContractorFirstFile_(p["SOW Contractor"]);

    if (!signatureFile || !signatureFile.url) return;

    const fileName = String(signatureFile.name || "");

    if (fileName.toLowerCase().indexOf("pending signature") === -1) {
      return;
    }

    const role =
      getSowAssignmentRole_(p) || "Role";

    const fileId =
      extractGoogleDriveFileId_(signatureFile.url) ||
      row.id;

    const key =
      `${projectId.substring(0, 8)}_${contractorName.substring(0, 20)}_${fileId.substring(0, 12)}`
        .replace(/[^a-zA-Z0-9_-]/g, "");

    if (!groups[key]) {
      groups[key] = {
        key,
        projectId,
        projectName: project.name || "Project",
        contractorName,
        pendingFileName: signatureFile.name,
        pendingFileUrl: signatureFile.url,
        documentType: getSignatureDocumentTypeFromTitle_(signatureFile.name),
        roles: [],
        assignmentIds: []
      };
    }

    groups[key].roles.push(role);
    groups[key].assignmentIds.push(row.id);
  });

  return Object.keys(groups)
    .map(key => {
      const item = groups[key];

      item.roleSummary = item.roles
        .filter((role, index, array) => array.indexOf(role) === index)
        .join(", ");

      return item;
    })
    .sort((a, b) =>
      a.projectName.localeCompare(b.projectName) ||
      a.contractorName.localeCompare(b.contractorName)
    );
}


/************************************
 * MATCHING LOGIC
 ************************************/

function findHelloSignMatchForSow_(pendingItem, helloSignFiles) {
  const projectKey = normalizeSowMatchText_(pendingItem.projectName);
  const contractorKey = normalizeSowMatchText_(pendingItem.contractorName);

  const candidates = helloSignFiles
    .map(file => ({
      file,
      normalizedName: normalizeSowMatchText_(file.name)
    }))
    .filter(item =>
      item.normalizedName.indexOf(projectKey) !== -1 &&
      item.normalizedName.indexOf(contractorKey) !== -1
    );

  if (!candidates.length) {
    return null;
  }

  const signed = candidates.find(item =>
    isHelloSignSignedFile_(item.file)
  );

  if (signed) {
    return {
      status: "signed",
      file: signed.file
    };
  }

  const awaiting = candidates.find(item =>
    isHelloSignAwaitingFile_(item.file)
  );

  if (awaiting) {
    return {
      status: "awaiting",
      file: awaiting.file
    };
  }

  return null;
}

function isHelloSignAwaitingFile_(file) {
  const name = String(file.name || "").toLowerCase();

  return (
    name.indexOf("awaiting signature") !== -1 ||
    name.indexOf("awaiting") !== -1
  );
}

function isHelloSignSignedFile_(file) {
  const name = String(file.name || "").toLowerCase();

  if (isHelloSignAwaitingFile_(file)) {
    return false;
  }

  return (
    name.endsWith(".pdf") ||
    file.mimeType === MimeType.PDF
  );
}

function normalizeSowMatchText_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.pdf$/g, "")
    .replace(/\bpending signature\b/g, "")
    .replace(/\bawaiting signature\b/g, "")
    .replace(/\bsigned amendment\b/g, "")
    .replace(/\bsigned sow\b/g, "")
    .replace(/\bamendment\b/g, "")
    .replace(/\bamend\b/g, "")
    .replace(/\bsow\b/g, "")
    .replace(/\battachment\b/g, "")
    .replace(/\b[a-z]{3},?\s+\d{1,2}\s+[a-z]{3,9}\s+\d{4}.*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


/************************************
 * SIGNED FILE COPY
 ************************************/

function copyHelloSignSignedSowToOfficialFolder_(helloSignFile, item) {
  const sourceFile = DriveApp.getFileById(helloSignFile.id);
  const folder = DriveApp.getFolderById(CONTRACTOR_SIGNED_SOW_FOLDER_ID);

  const documentType =
    getSignatureDocumentTypeFromTitle_(
      helloSignFile.name || item.pendingFileName
    );

  const signedFileName = sowSafeFileName_(
    `Signed ${documentType} - ${item.projectName} - ${item.contractorName}.pdf`
  );

  const copiedFile = sourceFile.makeCopy(
    signedFileName,
    folder
  );

  return {
    id: copiedFile.getId(),
    name: copiedFile.getName(),
    url: copiedFile.getUrl()
  };
}

function trashOldPendingSowFile_(fileUrl) {
  const fileId = extractGoogleDriveFileId_(fileUrl);

  if (!fileId) {
    return;
  }

  try {
    DriveApp
      .getFileById(fileId)
      .setTrashed(true);
  } catch (err) {
    Logger.log(`Could not trash old pending signature file: ${err.message}`);
  }
}


/************************************
 * SLACK MESSAGES
 ************************************/

function buildSignedSowReceivedBlocks_(item) {
  const documentType =
    item.documentType ||
    getSignatureDocumentTypeFromTitle_(
      item.signedFileName || item.pendingFileName
    );

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `✅ *Signed ${documentType} received*\n\n` +
          `*Project:* ${item.projectName}\n` +
          `*Contractor:* ${item.contractorName}\n` +
          `*Roles:* ${item.roleSummary || "-"}\n\n` +
          `The signed ${documentType.toLowerCase()} was saved and linked in Notion.`
      }
    }
  ];
}

function buildSowSignatureFolderSummaryBlocks_(result) {
  const folderUrl =
    `https://drive.google.com/drive/folders/${CONTRACTOR_SOW_FOLDER_ID}`;

  let text =
    "📄 *Signature Summary*\n\n";

  if (result.pendingToSend.length) {
    text +=
      `🔴 *Pending to send (${result.pendingToSend.length})* | <${folderUrl}|Review folder>\n`;

    result.pendingToSend.forEach(item => {
      text += buildSignatureSummaryItemLine_(item);
    });

    text += "\n";
  }

  if (result.awaitingSignature.length) {
    text +=
      `🟡 *Awaiting signature (${result.awaitingSignature.length})*\n`;

    result.awaitingSignature.forEach(item => {
      text += buildSignatureSummaryItemLine_(item);
    });

    text += "\n";
  }

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: text.trim()
      }
    }
  ];
}

function buildSignatureSummaryItemLine_(item) {
  const documentType =
    item.documentType ||
    getSignatureDocumentTypeFromTitle_(
      item.helloSignFileName ||
      item.pendingFileName ||
      item.signedFileName
    );

  return (
    `• ${documentType} — ` +
    `${item.projectName} — ${item.contractorName}` +
    (item.roleSummary ? ` — ${item.roleSummary}` : "") +
    "\n"
  );
}


/************************************
 * DOCUMENT TYPE
 ************************************/

function getSignatureDocumentTypeFromTitle_(title) {
  const text =
    String(title || "").toLowerCase();

  if (
    text.indexOf("amendment") !== -1 ||
    text.indexOf("amend") !== -1
  ) {
    return "Amendment";
  }

  if (text.indexOf("sow") !== -1) {
    return "SOW";
  }

  return "Document";
}
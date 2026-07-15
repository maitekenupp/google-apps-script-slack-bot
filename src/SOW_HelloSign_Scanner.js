/******************************************************
 *
 * IZA
 * File: SOW_HelloSign_Scanner.gs
 *
 * Purpose:
 * Scans HelloSign / Requested signatures folder and syncs
 * signed SOW PDFs back into Notion.
 *
 ******************************************************/

function runScheduledSowSignatureFolderScan() {
  const result = scanHelloSignRequestedSignatures_();

  if (result.signed.length) {
    result.signed.forEach(item => {
      postSlackMessage_(
        CONTRACTOR_CLAIMS_CHANNEL,
        buildSignedSowReceivedBlocks_(item),
        "Signed SOW received"
      );
    });
  }

  if (result.pendingToSend.length || result.awaitingSignature.length) {
    postSlackMessage_(
      CONTRACTOR_CLAIMS_CHANNEL,
      buildSowSignatureFolderSummaryBlocks_(result),
      "SOW Signature Summary"
    );
  }

  return result;
}

function scanHelloSignRequestedSignatures_() {
  const pendingSows = loadPendingSignatureSows_();
  const helloSignFiles = loadHelloSignRequestedSignatureFiles_();

  const result = {
    signed: [],
    pendingToSend: [],
    awaitingSignature: []
  };

  pendingSows.forEach(sow => {
    const match = findHelloSignMatchForSow_(sow, helloSignFiles);

    if (!match) {
      result.pendingToSend.push(sow);
      return;
    }

    if (match.status === "awaiting") {
      result.awaitingSignature.push({
        ...sow,
        helloSignFileName: match.file.name,
        helloSignFileUrl: match.file.url
      });
      return;
    }

    if (match.status === "signed") {
      const signedFile = copyHelloSignSignedSowToOfficialFolder_(
        match.file,
        sow
      );

      updateSowContractorFileForAssignments_(
        sow.assignmentIds,
        signedFile
      );

      trashOldPendingSowFile_(sow.pendingFileUrl);

      result.signed.push({
        ...sow,
        signedFileName: signedFile.name,
        signedFileUrl: signedFile.url
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
      mimeType: file.getMimeType()
    });
  }

  return items;
}

function findHelloSignMatchForSow_(sow, helloSignFiles) {
  const projectKey = normalizeSowMatchText_(sow.projectName);
  const contractorKey = normalizeSowMatchText_(sow.contractorName);

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

function copyHelloSignSignedSowToOfficialFolder_(helloSignFile, sow) {
  const sourceFile = DriveApp.getFileById(helloSignFile.id);
  const folder = DriveApp.getFolderById(CONTRACTOR_SIGNED_SOW_FOLDER_ID);

  const signedFileName = sowSafeFileName_(
    `Signed SOW - ${sow.projectName} - ${sow.contractorName}.pdf`
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

function normalizeSowMatchText_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.pdf$/g, "")
    .replace(/\bpending signature\b/g, "")
    .replace(/\bawaiting signature\b/g, "")
    .replace(/\bsigned sow\b/g, "")
    .replace(/\bsow\b/g, "")
    .replace(/\battachment\b/g, "")
    .replace(/\b[a-z]{3},?\s+\d{1,2}\s+[a-z]{3,9}\s+\d{4}.*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSignedSowReceivedBlocks_(item) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "✅ *Signed SOW received*\n\n" +
          `*Project:* ${item.projectName}\n` +
          `*Contractor:* ${item.contractorName}\n` +
          `*Roles:* ${item.roleSummary || "-"}\n\n` +
          "The signed SOW was saved and linked in Notion."
      }
    }
  ];
}

function buildSowSignatureFolderSummaryBlocks_(result) {
  const folderUrl =
    `https://drive.google.com/drive/folders/${CONTRACTOR_SOW_FOLDER_ID}`;

  let text =
    "📄 *SOW Signature Summary*\n\n";

  if (result.pendingToSend.length) {
    text +=
    `🔴 *Pending to send (${result.pendingToSend.length})* | <${folderUrl}|Review folder>\n`;

    result.pendingToSend.forEach(item => {
      text +=
        `• ${item.projectName} — ${item.contractorName}` +
        (item.roleSummary ? ` — ${item.roleSummary}` : "") +
        "\n";
    });

    text += "\n";
  }

  if (result.awaitingSignature.length) {
    text += `🟡 *Awaiting signature (${result.awaitingSignature.length})*\n`;

    result.awaitingSignature.forEach(item => {
      text +=
        `• ${item.projectName} — ${item.contractorName}` +
        (item.roleSummary ? ` — ${item.roleSummary}` : "") +
        "\n";
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

    const sowFile = getSowContractorFirstFile_(p["SOW Contractor"]);
    if (!sowFile || !sowFile.url) return;

    const fileName = String(sowFile.name || "");

    if (fileName.indexOf("Pending Signature") === -1) {
      return;
    }

    const role = getSowAssignmentRole_(p) || "Role";

    const fileId =
      extractGoogleDriveFileId_(sowFile.url) ||
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
        pendingFileName: sowFile.name,
        pendingFileUrl: sowFile.url,
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
    Logger.log(`Could not trash old pending SOW file: ${err.message}`);
  }
}
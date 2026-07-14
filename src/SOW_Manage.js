/******************************************************
 *
 * IZA
 * File: SOW_Manage.gs
 *
 * Purpose:
 * Manage manually signed SOW PDFs.
 *
 ******************************************************/

function handleSowManageStart_(channelId, messageTs, userId) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildSowLoadingBlocks_(
      "📄 *Manage SOWs*\n\nLoading pending signature SOWs..."
    ),
    "Loading SOWs"
  );

  const pendingSows = loadPendingSignatureSows_();

  const session = {
    pendingSows,
    selectedKey: ""
  };

  saveSowManageSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowManageBlocks_(session),
    "Manage SOWs"
  );
}

function handleSowManageSelect_(payload, channelId, messageTs, userId) {
  const selectedKey =
    payload.actions?.[0]?.selected_option?.value || "";

  const session = getSowManageSession_(userId);

  if (!session) {
    handleSowManageStart_(channelId, messageTs, userId);
    return;
  }

  session.selectedKey = selectedKey;
  saveSowManageSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowManageBlocks_(session),
    "Manage SOWs"
  );
}

function openSignedSowModal_(payload, channelId, messageTs, userId) {
  const session = getSowManageSession_(userId);

  if (!session || !session.selectedKey) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildSowMessageBlocks_(
        "📄 *Manage SOWs*\n\nPlease select a pending SOW first.",
        "sow_manage_start"
      ),
      "Manage SOWs"
    );
    return;
  }

  const selected = session.pendingSows.find(item =>
    item.key === session.selectedKey
  );

  if (!selected) {
    handleSowManageStart_(channelId, messageTs, userId);
    return;
  }

  const metadata = JSON.stringify({
    userId,
    channelId,
    messageTs,
    selectedKey: selected.key
  });

  openSlackModal_(payload.trigger_id, {
    type: "modal",
    callback_id: "sow_signed_submit",
    title: {
      type: "plain_text",
      text: "Signed SOW",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Save",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true
    },
    private_metadata: metadata,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*Replace Pending SOW with Signed SOW*\n\n" +
            `*Project:* ${selected.projectName}\n` +
            `*Contractor:* ${selected.contractorName}\n\n` +
            "Paste the Google Drive link for the signed PDF."
        }
      },
      {
        type: "input",
        block_id: "signed_sow_link_block",
        label: {
          type: "plain_text",
          text: "Signed PDF Link",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "signed_sow_link_value",
          placeholder: {
            type: "plain_text",
            text: "Paste Google Drive PDF link"
          }
        }
      }
    ]
  });
}

function handleSignedSowModalSubmission_(payload) {
  const metadata = JSON.parse(payload.view.private_metadata || "{}");

  const signedFileUrl =
    payload.view.state.values
      .signed_sow_link_block
      .signed_sow_link_value
      .value || "";

  const errors = {};

  if (!signedFileUrl.trim()) {
    errors.signed_sow_link_block = "Please paste the signed PDF link.";
  }

  if (Object.keys(errors).length) {
    return {
      response_action: "errors",
      errors
    };
  }

  const session = getSowManageSession_(metadata.userId);

  if (!session) {
    return { response_action: "clear" };
  }

  const selected = session.pendingSows.find(item =>
    item.key === metadata.selectedKey
  );

  if (!selected) {
    return { response_action: "clear" };
  }

  try {
    const signedFile = copySignedSowToFolder_(
      signedFileUrl,
      selected
    );

    updateSowContractorFileForAssignments_(
      selected.assignmentIds,
      signedFile
    );

    clearSowManageSession_(metadata.userId);

    updateIzaMenu(
      metadata.channelId,
      metadata.messageTs,
      buildSignedSowSavedBlocks_(selected, signedFile),
      "Signed SOW Saved"
    );

  } catch (err) {
    updateIzaMenu(
      metadata.channelId,
      metadata.messageTs,
      buildSowMessageBlocks_(
        "❌ *I had trouble saving the signed SOW.*\n\n" +
        `Error: ${err.message}`,
        "sow_manage_start"
      ),
      "Signed SOW Failed"
    );
  }

  return { response_action: "clear" };
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
    const fileId = extractGoogleDriveFileId_(sowFile.url) || row.id;

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

function copySignedSowToFolder_(signedFileUrl, selected) {
  const fileId = extractGoogleDriveFileId_(signedFileUrl);

  if (!fileId) {
    throw new Error("Could not read the Google Drive file ID from the signed SOW link.");
  }

  const sourceFile = DriveApp.getFileById(fileId);
  const folder = DriveApp.getFolderById(CONTRACTOR_SOW_FOLDER_ID);

  const signedFileName = sowSafeFileName_(
    `Signed SOW - ${selected.projectName} - ${selected.contractorName}.pdf`
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

function buildSowManageBlocks_(session) {
  const pendingSows = session.pendingSows || [];

  if (!pendingSows.length) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "📄 *Manage SOWs*\n\n" +
            "There are no SOWs pending signature right now."
        }
      },
      {
        type: "actions",
        elements: [
          button_("⬅️ Back", "projects_admin_menu")
        ]
      }
    ];
  }

  const selected = pendingSows.find(item =>
    item.key === session.selectedKey
  );

  if (selected) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "📄 *Manage SOWs*\n\n" +
            `*Project:* ${selected.projectName}\n` +
            `*Contractor:* ${selected.contractorName}\n` +
            `*Roles:* ${selected.roleSummary || "-"}\n\n` +
            `<${selected.pendingFileUrl}|Open pending SOW>`
        }
      },
      {
        type: "actions",
        elements: [
          button_("⬅️ Back", "sow_manage_start"),
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✅ Add Signed SOW",
              emoji: true
            },
            action_id: "sow_manage_open_modal",
            value: selected.key
          }
        ]
      }
    ];
  }

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "📄 *Manage SOWs*\n\n" +
          "Select a SOW that has been signed manually."
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "static_select",
          action_id: "sow_manage_select",
          placeholder: {
            type: "plain_text",
            text: "Select pending SOW",
            emoji: true
          },
          options: pendingSows.slice(0, 100).map(item => ({
            text: {
              type: "plain_text",
              text: sowManageOptionText_(item),
              emoji: true
            },
            value: item.key
          }))
        }
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "projects_admin_menu")
      ]
    }
  ];
}

function buildSignedSowSavedBlocks_(selected, signedFile) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "✅ *Signed SOW Saved*\n\n" +
          `*Project:* ${selected.projectName}\n` +
          `*Contractor:* ${selected.contractorName}\n` +
          `*Roles:* ${selected.roleSummary || "-"}\n\n` +
          `<${signedFile.url}|Open signed SOW>`
      }
    },
    {
      type: "actions",
      elements: [
        button_("📄 Manage SOWs", "sow_manage_start"),
        button_("⬅️ Admin", "projects_admin_menu")
      ]
    }
  ];
}

function sowManageOptionText_(item) {
  const text =
    `${item.projectName} - ${item.contractorName}`;

  return text.length > 75
    ? text.substring(0, 72) + "..."
    : text;
}

function saveSowManageSession_(userId, session) {
  PropertiesService.getScriptProperties()
    .setProperty(
      `SOW_MANAGE_SESSION_${userId}`,
      JSON.stringify(session)
    );
}

function getSowManageSession_(userId) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(`SOW_MANAGE_SESSION_${userId}`);

  return raw ? JSON.parse(raw) : null;
}

function clearSowManageSession_(userId) {
  PropertiesService.getScriptProperties()
    .deleteProperty(`SOW_MANAGE_SESSION_${userId}`);
}

function runScheduledSowPendingSignatureCheck() {
  const pendingSows = loadPendingSignatureSows_();

  if (!pendingSows.length) {
    return;
  }

  postSlackMessage_(
    CONTRACTOR_CLAIMS_CHANNEL,
    buildPendingSowSignatureReminderBlocks_(pendingSows),
    "Pending SOW Signatures"
  );
}

function buildPendingSowSignatureReminderBlocks_(pendingSows) {
  const projectGroups = {};

  pendingSows.forEach(item => {
    const projectName = item.projectName || "Project";

    if (!projectGroups[projectName]) {
      projectGroups[projectName] = [];
    }

    projectGroups[projectName].push(item);
  });

  let text =
    "📄 *Quick follow-up*\n\n" +
    "These contracts are still pending signature. Please review and upload the signed contracts in IZA.\n\n";

  Object.keys(projectGroups)
    .sort()
    .forEach(projectName => {
      text += `*${projectName}*\n`;

      projectGroups[projectName]
        .sort((a, b) => a.contractorName.localeCompare(b.contractorName))
        .forEach(item => {
          text +=
            `• ${item.contractorName}` +
            (item.roleSummary ? ` — ${item.roleSummary}` : "") +
            "\n";
        });

      text += "\n";
    });

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
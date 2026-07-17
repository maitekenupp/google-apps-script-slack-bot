/******************************************************
 *
 * IZA
 * File: SOW_Flow.gs
 *
 * Purpose:
 * Creates SOW Google Doc drafts, finalizes SOW PDFs,
 * and links pending-signature files back to Notion.
 *
 * Admin usage:
 * Usually launched after contractor assignment or after
 * a role claim announcement is closed.
 *
 ******************************************************/


/************************************
 * LEGACY MANUAL ADMIN FLOW
 * Kept for compatibility with old buttons/routes.
 ************************************/

function handleSowAdminStart_(channelId, messageTs, userId) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildSowLoadingBlocks_(
      "🖨️ *Generate SOW*\n\nLoading contractor assignments..."
    ),
    "Loading SOW Assignments"
  );

  const assignments = loadSowAssignments_();

  if (!assignments.length) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildSowMessageBlocks_(
        "🖨️ *Generate SOW*\n\nI could not find contractor assignments available for SOW generation.",
        "admin_projects_menu"
      ),
      "Generate SOW"
    );
    return;
  }

  const session = {
    assignments,
    selectedAssignmentId: null
  };

  saveSowSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowAssignmentSelectBlocks_(session),
    "Generate SOW"
  );
}

function handleSowAssignmentSelect_(payload, channelId, messageTs, userId) {
  const selectedAssignmentId =
    payload.actions?.[0]?.selected_option?.value || "";

  const session = getSowSession_(userId);

  if (!session) {
    handleSowAdminStart_(channelId, messageTs, userId);
    return;
  }

  session.selectedAssignmentId = selectedAssignmentId;
  saveSowSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowAssignmentSelectBlocks_(session),
    "Generate SOW"
  );
}

function handleSowCreateConfirm_(channelId, messageTs, userId) {
  const session = getSowSession_(userId);

  if (!session || !session.selectedAssignmentId) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildSowMessageBlocks_(
        "🖨️ *Generate SOW*\n\nI could not find the selected assignment. Please start again.",
        "admin_projects_menu"
      ),
      "Generate SOW"
    );
    return;
  }

  const assignment = session.assignments.find(item =>
    item.id === session.selectedAssignmentId
  );

  if (!assignment) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildSowMessageBlocks_(
        "🖨️ *Generate SOW*\n\nThis assignment is no longer available.",
        "admin_projects_menu"
      ),
      "Generate SOW"
    );
    return;
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowLoadingBlocks_(
      "🖨️ *Generate SOW*\n\nCreating the SOW draft..."
    ),
    "Creating SOW"
  );

  const result = autoGenerateSowForProjectContractor_(
    assignment.projectId,
    assignment.contractorName
  );

  clearSowSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowCreatedBlocks_(assignment, result.draftFile),
    "SOW Created"
  );
}

function handleSowCancel_(channelId, messageTs, userId) {
  clearSowSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowMessageBlocks_(
      "🖨️ *Generate SOW*\n\nSOW generation canceled.",
      "admin_projects_menu"
    ),
    "SOW Canceled"
  );
}


/************************************
 * PROJECT SOW FLOW
 ************************************/

function handleSowGenerateForProject_(payload, channelId, messageTs, userId) {
  const projectId = payload.actions?.[0]?.value || "";

  if (!projectId) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildSowMessageBlocks_(
        "🖨️ *Generate SOWs*\n\nI could not find the project ID.",
        "admin_projects_menu"
      ),
      "Generate SOWs"
    );
    return;
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowLoadingBlocks_(
      "🖨️ *Generate SOWs*\n\nCreating SOW draft documents..."
    ),
    "Creating SOW Drafts"
  );

  const results = generateSowsForProject_(projectId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowProjectResultsBlocks_(projectId, results),
    "SOW Drafts Created"
  );
}

function handleSowFinalizeForProject_(payload, channelId, messageTs, userId) {
  const projectId = payload.actions?.[0]?.value || "";

  if (!projectId) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildSowMessageBlocks_(
        "✅ *Finalize SOWs*\n\nI could not find the project ID.",
        "admin_projects_menu"
      ),
      "Finalize SOWs"
    );
    return;
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowLoadingBlocks_(
      "✅ *Finalize SOWs*\n\nCreating final PDF files..."
    ),
    "Finalizing SOWs"
  );

  const results = finalizeSowsForProject_(projectId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowFinalizeResultsBlocks_(projectId, results),
    "SOWs Finalized"
  );
}


/************************************
 * BLOCKS
 ************************************/

function buildSowAssignmentSelectBlocks_(session) {
  const selected = session.assignments.find(item =>
    item.id === session.selectedAssignmentId
  );

  if (selected) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "🖨️ *Review SOW Data*\n\n" +
            `*Contractor:* ${selected.contractorName}\n` +
            `*Project:* ${selected.projectName}\n` +
            `*Roles:* ${selected.roleSummary}\n` +
            `*Start Date:* ${sowFormatDate_(selected.startDate)}\n` +
            `*End Date:* ${sowFormatDate_(selected.endDate)}\n` +
            `*Email:* ${selected.email || "-"}\n` +
            `*Phone:* ${selected.phone || "-"}\n` +
            `*Total Hours:* ${selected.totalHoursToContractor}\n` +
            `*Rate:* ${sowFormatMoney_(selected.standardRate)}\n` +
            `*Total Cap:* ${sowFormatMoney_(selected.totalCompensationCap)}\n\n` +
            `*Scope:*\n${selected.scopeOfServices || "-"}`
        }
      },
      {
        type: "actions",
        elements: [
          primaryButton_("✅ Create SOW Draft", "sow_create_confirm"),
          button_("⬅️ Back", "sow_admin_start"),
          dangerButton_("❌ Cancel", "sow_cancel")
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
          "🖨️ *Generate SOW*\n\n" +
          "Select the contractor assignment for this SOW."
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "static_select",
          action_id: "sow_assignment_select",
          placeholder: {
            type: "plain_text",
            text: "Select assignment",
            emoji: true
          },
          options: session.assignments.slice(0, 100).map(item => ({
            text: {
              type: "plain_text",
              text: sowOptionText_(item),
              emoji: true
            },
            value: item.id
          }))
        }
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "admin_projects_menu")
      ]
    }
  ];
}

function buildSowCreatedBlocks_(assignment, file) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🖨️ *SOW Draft Created*\n\n" +
          `*Contractor:* ${assignment.contractorName}\n` +
          `*Project:* ${assignment.projectName}\n` +
          `*Roles:* ${assignment.roleSummary || "-"}\n\n` +
          `<${file.url}|Open SOW Draft>`
      }
    },
    {
      type: "actions",
      elements: [
        button_("📁 Projects", "admin_projects_menu")
      ]
    }
  ];
}

function buildSowProjectResultsBlocks_(projectId, results) {
  const created = results.created || [];
  const skipped = results.skipped || [];
  const failed = results.failed || [];

  let text =
    "✅ *SOW Drafts Created*\n\n" +
    "Please review the Google Docs before finalizing.\n\n";

  if (created.length) {
    text += "*Drafts:*";

    created.forEach(item => {
      const file = item.draftFile || {};
      const fileName = file.name || item.fileName || "SOW Draft";
      const fileUrl = file.url || item.url || "";

      text += `\n• ${item.contractorName}: <${fileUrl}|${fileName}>`;
    });
  } else {
    text += "*Drafts:*\nNone";
  }

  if (skipped.length) {
    text += "\n\n*Skipped:*";

    skipped.forEach(item => {
      text +=
        `\n• ${item.contractorName || "Unknown"}: ` +
        `${item.reason || "Skipped"}`;
    });
  }

  if (failed.length) {
    text += "\n\n*Failed:*";

    failed.forEach(item => {
      text +=
        `\n• ${item.contractorName || "Unknown"}: ` +
        `${item.error || "Unknown error"}`;
    });
  }

  const actions = [];

  if (created.length) {
    actions.push({
      type: "button",
      text: {
        type: "plain_text",
        text: "✅ Finalize SOWs",
        emoji: true
      },
      action_id: "sow_finalize_for_project",
      value: projectId
    });
  } else {
    actions.push(button_("📁 Projects", "admin_projects_menu"));
  }

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text
      }
    },
    {
      type: "actions",
      elements: actions
    }
  ];
}

function buildSowFinalizeResultsBlocks_(projectId, results) {
  const finalizedText = results.finalized.length
    ? results.finalized
        .map(item => `• *${item.contractorName}:* <${item.url}|${item.fileName}>`)
        .join("\n")
    : "None";

  const skippedText = results.skipped.length
    ? results.skipped
        .map(item => `• ${item.reason || item}`)
        .join("\n")
    : "";

  const failedText = results.failed.length
    ? results.failed
        .map(item => `• ${item.contractorName}: ${item.error}`)
        .join("\n")
    : "";

  let text =
    "✅ *SOW PDFs Finalized*\n\n" +
    "These files are now ready to be sent for manual signature.\n\n" +
    `*Pending Signature PDFs:*\n${finalizedText}`;

  if (results.skipped.length) {
    text += `\n\n*Skipped:*\n${skippedText}`;
  }

  if (results.failed.length) {
    text += `\n\n*Failed:*\n${failedText}`;
  }

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text
      }
    },
    {
      type: "actions",
      elements: [
        button_("📁 Projects", "admin_projects_menu")
      ]
    }
  ];
}

function buildSowMessageBlocks_(text, backActionId) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text
      }
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", backActionId || "admin_projects_menu")
      ]
    }
  ];
}

function buildSowLoadingBlocks_(text) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text
      }
    }
  ];
}


/************************************
 * LOAD SOW ASSIGNMENTS
 ************************************/

function loadSowAssignments_() {
  const assignmentRows =
    queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);

  const projectsById = loadSowProjectsById_();
  const contractorsByName = loadSowContractorsByName_();

  const groups = {};

  assignmentRows.forEach(row => {
    const p = row.properties;

    if (sowHasExistingFile_(p["SOW Contractor"])) return;

    const contractorName = getText_(p["Contractor"]);
    if (!contractorName) return;

    const projectId =
      p["Projects 1 related to"]?.relation?.[0]?.id || "";

    const project = projectsById[projectId];
    if (!project) return;

    const role = getSowAssignmentRole_(p);
    if (!role) return;

    const hoursToContractor = getNumber_(p["Hours to Contractor"]);
    if (hoursToContractor <= 0) return;

    const contractor =
      contractorsByName[contractorName.toLowerCase()] || {};

    const standardRate =
      contractor.standardRate ||
      getNumber_(p["Rate per Hour"]);

    const groupKey =
      `${projectId}_${contractorName.toLowerCase()}`;

    if (!groups[groupKey]) {
      groups[groupKey] = {
        id: groupKey,
        projectId,
        projectName: project.name,
        startDate: project.startDate,
        endDate: project.endDate,
        shortDescription: project.shortDescription,
        contractorName,
        contractorId: contractor.id || "",
        email: contractor.email || "",
        phone: contractor.phone || "",
        standardRate,
        roles: [],
        assignmentIds: []
      };
    }

    groups[groupKey].roles.push({
      assignmentId: row.id,
      role,
      deliverables: findSowDeliverables_(projectId, role),
      hoursToContractor
    });

    groups[groupKey].assignmentIds.push(row.id);
  });

  return Object.keys(groups)
    .map(key => buildSowGroupSummary_(groups[key]))
    .sort((a, b) =>
      a.projectName.localeCompare(b.projectName) ||
      a.contractorName.localeCompare(b.contractorName)
    );
}

function loadSowProjectsById_() {
  const rows = queryAllDataSourceRows_(PROJECTS_OVERVIEW_DATA_SOURCE_ID);
  const projects = {};

  rows.forEach(row => {
    projects[row.id] = {
      name: getText_(row.properties["Project Name"]),
      shortDescription: getText_(row.properties["Short Description"]),
      startDate: sowGetDateStart_(row.properties["Project Start Date"]),
      endDate: sowGetDateStart_(row.properties["Project End Date"])
    };
  });

  return projects;
}

function loadSowContractorsByName_() {
  const rows = queryAllDataSourceRows_(TEAM_DIRECTORY_DATA_SOURCE_ID);
  const contractors = {};

  rows.forEach(row => {
    const name = getText_(row.properties["Name"]);
    if (!name) return;

    contractors[name.toLowerCase()] = {
      id: row.id,
      name,
      email: getText_(row.properties["Email"]),
      phone: getText_(row.properties["Phone Number"]),
      standardRate:
        getNumber_(row.properties["Standart Rate"]) ||
        getNumber_(row.properties["Standard Rate"])
    };
  });

  return contractors;
}

function findSowDeliverables_(projectId, roleName) {
  const data = notionFetch_(
    `https://api.notion.com/v1/data_sources/${TASKS_DATA_SOURCE_ID}/query`,
    "post",
    {
      filter: {
        property: "Project",
        relation: {
          contains: projectId
        }
      },
      page_size: 100
    }
  );

  const cleanRoleName = String(roleName || "").toLowerCase();

  const match = (data.results || []).find(row => {
    const role = getText_(row.properties["Roles"]);
    return role && cleanRoleName.indexOf(role.toLowerCase()) !== -1;
  });

  if (!match) return "";

  return getText_(match.properties["Deliverables"]);
}


/************************************
 * CREATE DRAFTS
 ************************************/

function generateSowsForProject_(projectId) {
  const assignmentRows =
    queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);

  const contractorNames = [];

  assignmentRows.forEach(row => {
    const p = row.properties;

    if (sowHasExistingFile_(p["SOW Contractor"])) return;

    const rowProjectId =
      p["Projects 1 related to"]?.relation?.[0]?.id || "";

    if (rowProjectId !== projectId) return;

    const contractorName = getText_(p["Contractor"]);
    if (!contractorName) return;

    if (!contractorNames.includes(contractorName)) {
      contractorNames.push(contractorName);
    }
  });

  const created = [];
  const skipped = [];
  const failed = [];

  contractorNames.forEach(contractorName => {
    try {
      const result = autoGenerateSowForProjectContractor_(
        projectId,
        contractorName
      );

      if (result && result.draftFile) {
        created.push({
          contractorName,
          draftFile: result.draftFile,
          fileName: result.draftFile.name || "SOW Draft",
          url: result.draftFile.url || ""
        });
      } else {
        skipped.push({
          contractorName,
          reason: "No SOW draft was created."
        });
      }
    } catch (err) {
      failed.push({
        contractorName,
        error: err.message
      });
    }
  });

  return {
    created,
    skipped,
    failed
  };
}

function autoGenerateSowForProjectContractor_(projectId, contractorName) {
  const assignment = buildSowGroupForProjectContractor_(
    projectId,
    contractorName
  );

  if (!assignment) return null;

  const fileName = sowSafeFileName_(
    `SOW - ${assignment.projectName} - ${assignment.contractorName}`
  );

  const draftFile = createContractorSowDraft_({
    fileName,
    contractorName: assignment.contractorName,
    projectName: assignment.projectName,
    startDate: sowFormatDate_(assignment.startDate),
    endDate: sowFormatDate_(assignment.endDate),
    email: assignment.email,
    phone: assignment.phone,
    shortDescription: assignment.shortDescription,
    roleSummary: assignment.roleSummary,
    deliverablesSummary: assignment.deliverablesSummary,
    scopeOfServices: assignment.scopeOfServices,
    estimatedLevelOfEffort: assignment.estimatedLevelOfEffort,
    totalHoursToContractor: assignment.totalHoursToContractor,
    standardRate: assignment.standardRate,
    totalCompensationCap: assignment.totalCompensationCap,
    date: sowFormatDate_(sowToday_())
  });

  updateSowContractorFileForAssignments_(
    assignment.assignmentIds,
    draftFile
  );

  return {
    assignment,
    draftFile
  };
}

function buildSowGroupForProjectContractor_(projectId, contractorName) {
  const assignmentRows =
    queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);

  const projectsById = loadSowProjectsById_();
  const contractorsByName = loadSowContractorsByName_();

  const project = projectsById[projectId];
  const contractor =
    contractorsByName[String(contractorName || "").toLowerCase()] || {};

  if (!project || !contractorName) return null;

  const group = {
    id: `${projectId}_${String(contractorName).toLowerCase()}`,
    projectId,
    projectName: project.name,
    startDate: project.startDate,
    endDate: project.endDate,
    shortDescription: project.shortDescription,
    contractorName,
    contractorId: contractor.id || "",
    email: contractor.email || "",
    phone: contractor.phone || "",
    standardRate: contractor.standardRate || 0,
    roles: [],
    assignmentIds: []
  };

  assignmentRows.forEach(row => {
    const p = row.properties;

    const rowContractorName = getText_(p["Contractor"]);

    if (
      String(rowContractorName || "").toLowerCase() !==
      String(contractorName || "").toLowerCase()
    ) {
      return;
    }

    const rowProjectId =
      p["Projects 1 related to"]?.relation?.[0]?.id || "";

    if (rowProjectId !== projectId) return;

    const role = getSowAssignmentRole_(p);
    if (!role) return;

    const hoursToContractor = getNumber_(p["Hours to Contractor"]);
    if (hoursToContractor <= 0) return;

    group.roles.push({
      assignmentId: row.id,
      role,
      deliverables: findSowDeliverables_(projectId, role),
      hoursToContractor
    });

    group.assignmentIds.push(row.id);
  });

  if (!group.roles.length) return null;

  return buildSowGroupSummary_(group);
}


/************************************
 * FINALIZE PDFS
 ************************************/

function finalizeSowsForProject_(projectId) {
  const assignmentRows =
    queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);

  const projectsById = loadSowProjectsById_();
  const project = projectsById[projectId] || {};

  const draftGroups = {};

  assignmentRows.forEach(row => {
    const p = row.properties;

    const rowProjectId =
      p["Projects 1 related to"]?.relation?.[0]?.id || "";

    if (rowProjectId !== projectId) return;

    const contractorName = getText_(p["Contractor"]);
    if (!contractorName) return;

    const sowFile = getSowContractorFirstFile_(p["SOW Contractor"]);
    if (!sowFile || !sowFile.url) return;

    const draftDocId = extractGoogleDriveFileId_(sowFile.url);
    if (!draftDocId) return;

    const groupKey =
      `${projectId}_${contractorName.toLowerCase()}_${draftDocId}`;

    if (!draftGroups[groupKey]) {
      draftGroups[groupKey] = {
        projectId,
        projectName: project.name || "Project",
        contractorName,
        draftDocId,
        draftName: sowFile.name || "SOW Draft",
        assignmentIds: []
      };
    }

    draftGroups[groupKey].assignmentIds.push(row.id);
  });

  const finalized = [];
  const skipped = [];
  const failed = [];

  Object.keys(draftGroups).forEach(key => {
    const group = draftGroups[key];

    try {
      const year = Utilities.formatDate(
        new Date(),
        "America/Los_Angeles",
        "yyyy"
      );

      const pdfFileName = sowSafeFileName_(
        `${year} - ${group.projectName} - ${group.contractorName} - Attachment A - Statement of Work (SOW).pdf`
      );

      const notionFileName = sowSafeFileName_(
        `SOW - Pending Signature - ${group.projectName} - ${group.contractorName}.pdf`
      );

      const pdfFile = finalizeContractorSowPdf_(
        group.draftDocId,
        pdfFileName
      );

      updateSowContractorFileForAssignments_(
        group.assignmentIds,
        pdfFile,
        null,
        notionFileName
      );

      DriveApp
        .getFileById(group.draftDocId)
        .setTrashed(true);

      finalized.push({
        contractorName: group.contractorName,
        fileName: notionFileName,
        url: pdfFile.url
      });

    } catch (err) {
      failed.push({
        contractorName: group.contractorName,
        error: err.message
      });
    }
  });

  if (!Object.keys(draftGroups).length) {
    skipped.push({
      reason: "No SOW drafts found for this project."
    });
  }

  return {
    finalized,
    skipped,
    failed
  };
}


/************************************
 * NOTION FILE UPDATE
 ************************************/

function updateSowContractorFileForAssignments_(assignmentIds, fileOrName, fileUrl, notionFileName) {
  if (!assignmentIds || !assignmentIds.length || !fileOrName) return;

  let fileName = "";
  let finalFileUrl = "";

  if (typeof fileOrName === "string") {
    fileName = fileOrName;
    finalFileUrl = fileUrl || "";
  } else {
    fileName =
      typeof fileOrName.getName === "function"
        ? fileOrName.getName()
        : fileOrName.name || "SOW";

    finalFileUrl =
      typeof fileOrName.getUrl === "function"
        ? fileOrName.getUrl()
        : fileOrName.url || "";
  }

  if (!finalFileUrl) {
    throw new Error("Missing SOW file URL.");
  }

  assignmentIds.forEach(assignmentId => {
    notionFetch_(
      `https://api.notion.com/v1/pages/${assignmentId}`,
      "patch",
      {
        properties: {
          "SOW Contractor": {
            files: [
              {
                name: notionFileName || fileName,
                type: "external",
                external: {
                  url: finalFileUrl
                }
              }
            ]
          }
        }
      }
    );
  });
}


/************************************
 * SESSION
 ************************************/

function saveSowSession_(userId, session) {
  PropertiesService.getScriptProperties()
    .setProperty(
      `SOW_SESSION_${userId}`,
      JSON.stringify(session)
    );
}

function getSowSession_(userId) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(`SOW_SESSION_${userId}`);

  return raw ? JSON.parse(raw) : null;
}

function clearSowSession_(userId) {
  PropertiesService.getScriptProperties()
    .deleteProperty(`SOW_SESSION_${userId}`);
}


/************************************
 * HELPERS
 ************************************/

function buildSowGroupSummary_(group) {
  const totalHours = group.roles.reduce((sum, role) => {
    return sum + Number(role.hoursToContractor || 0);
  }, 0);

  group.totalHoursToContractor = totalHours;
  group.totalCompensationCap = totalHours * Number(group.standardRate || 0);

  group.roleSummary = group.roles
    .map(role => role.role)
    .join(", ");

  group.deliverablesSummary = group.roles
    .map(role => `${role.role}: ${role.deliverables || "-"}`)
    .join("\n");

  group.scopeOfServices = group.roles
    .map(role => `• ${role.role}: ${role.deliverables || "-"}`)
    .join("\n");

  group.estimatedLevelOfEffort =
    group.roles
      .map(role =>
        `• Total Estimated Hours: ${role.hoursToContractor} - ${role.role}`
      )
      .join("\n") +
    "\n" +
    `• Hourly Rate: ${sowFormatMoney_(group.standardRate)} USD\n` +
    `• Maximum Compensation: ${sowFormatMoney_(group.totalCompensationCap)} USD, unless amended in writing.`;

  return group;
}

function getSowAssignmentRole_(properties) {
  const roleNames = getMultiSelectNames_(properties["Role"]);

  return roleNames.length
    ? roleNames.join(", ")
    : getText_(properties["Role"]);
}

function sowGetDateStart_(property) {
  return property?.date?.start || "";
}

function sowToday_() {
  return new Date();
}

function sowFormatDate_(value) {
  if (!value) return "";

  let date;

  if (Object.prototype.toString.call(value) === "[object Date]") {
    date = value;
  } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parts = value.split("-");
    date = new Date(
      Number(parts[0]),
      Number(parts[1]) - 1,
      Number(parts[2])
    );
  } else {
    date = new Date(value);
  }

  if (isNaN(date.getTime())) {
    return "";
  }

  return Utilities.formatDate(
    date,
    "America/Los_Angeles",
    "MMMM d, yyyy"
  );
}

function sowOptionText_(item) {
  const text =
    `${item.projectName} - ${item.contractorName}`;

  return text.length > 75
    ? text.substring(0, 72) + "..."
    : text;
}

function sowSafeFileName_(name) {
  return String(name || "SOW.pdf")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function sowHasExistingFile_(property) {
  if (!property) return false;

  if (property.files && property.files.length) {
    return true;
  }

  if (property.url) {
    return true;
  }

  return false;
}

function getSowContractorFirstFile_(property) {
  const files = property?.files || [];

  if (!files.length) {
    return null;
  }

  const file = files[0];

  if (file.external?.url) {
    return {
      name: file.name || "SOW Draft",
      url: file.external.url
    };
  }

  if (file.file?.url) {
    return {
      name: file.name || "SOW Draft",
      url: file.file.url
    };
  }

  return null;
}

function extractGoogleDriveFileId_(url) {
  const text = String(url || "");

  const fileMatch = text.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    return fileMatch[1];
  }

  const idMatch = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  const openMatch = text.match(/\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch && openMatch[1]) {
    return openMatch[1];
  }

  return "";
}
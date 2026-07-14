/******************************************************
 *
 * IZA
 * File: SOW_Flow.gs
 *
 * Purpose:
 * Admin-only SOW generation flow.
 *
 ******************************************************/

function handleSowAdminStart_(channelId, messageTs, userId) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildSowMessageBlocks_(
      "📄 *Generate SOW*\n\nLoading contractor assignments..."
    ),
    "Loading SOW Assignments"
  );

  const assignments = loadSowAssignments_();

  if (!assignments.length) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildSowMessageBlocks_(
        "📄 *Generate SOW*\n\nI could not find contractor assignments available for SOW generation.",
        "projects_admin_menu"
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
        "📄 *Generate SOW*\n\nI could not find the selected assignment. Please start again.",
        "projects_admin_menu"
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
        "📄 *Generate SOW*\n\nThis assignment is no longer available.",
        "projects_admin_menu"
      ),
      "Generate SOW"
    );
    return;
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowMessageBlocks_(
      "📄 *Generate SOW*\n\nCreating the SOW PDF..."
    ),
    "Creating SOW"
  );

  const fileName = sowSafeFileName_(
    `SOW - ${assignment.projectName} - ${assignment.contractorName}.pdf`
  );

  const pdfFile = createContractorSowPdf_({
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
    pdfFile.name,
    pdfFile.url
  );

  clearSowSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowCreatedBlocks_(assignment, pdfFile),
    "SOW Created"
  );
}

function handleSowCancel_(channelId, messageTs, userId) {
  clearSowSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildSowMessageBlocks_(
      "📄 *Generate SOW*\n\nSOW generation canceled.",
      "projects_admin_menu"
    ),
    "SOW Canceled"
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
            "📄 *Review SOW Data*\n\n" +
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
          button_("✅ Create SOW PDF", "sow_create_confirm"),
          button_("⬅️ Back", "sow_admin_start"),
          button_("❌ Cancel", "sow_cancel")
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
          "📄 *Generate SOW*\n\n" +
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
        button_("⬅️ Back", "projects_admin_menu")
      ]
    }
  ];
}

function buildSowCreatedBlocks_(assignment, pdfFile) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "✅ *SOW PDF Created*\n\n" +
          `*Contractor:* ${assignment.contractorName}\n` +
          `*Project:* ${assignment.projectName}\n` +
          `*Roles:* ${assignment.roleSummary || "-"}\n\n` +
          `<${pdfFile.url}|Open SOW PDF>`
      }
    },
    {
      type: "actions",
      elements: [
        button_("📄 Generate Another", "sow_admin_start"),
        button_("⬅️ Back", "projects_admin_menu")
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
        button_(
          backActionId ? "⬅️ Back" : "⬅️ Back",
          backActionId || "projects_admin_menu"
        )
      ]
    }
  ];
}

/************************************
 * DATA
 ************************************/

function loadSowAssignments_() {
  const assignmentRows = queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);
  const projectsById = loadSowProjectsById_();
  const contractorsByName = loadSowContractorsByName_();

  const groups = {};

  assignmentRows.forEach(row => {
    const p = row.properties;

    if (sowHasExistingFile_(p["SOW Contractor"])) {
      return;
    }

    const contractorName = getText_(p["Contractor"]);
    if (!contractorName) return;

    const projectId =
      p["Projects 1 related to"]?.relation?.[0]?.id || "";

    const project = projectsById[projectId];
    if (!project) return;

    const roleNames = getMultiSelectNames_(p["Role"]);
    const role = roleNames.length
      ? roleNames.join(", ")
      : getText_(p["Role"]);

    if (!role) return;

    const hoursToContractor = getNumber_(p["Hours to Contractor"]);
    if (hoursToContractor <= 0) return;

    const standardRate = getNumber_(p["Rate per Hour"]);
    const contractor = contractorsByName[contractorName.toLowerCase()] || {};

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
    .map(key => {
      const group = groups[key];

      const totalHours = group.roles.reduce((sum, role) => {
        return sum + Number(role.hoursToContractor || 0);
      }, 0);

      group.totalHoursToContractor = totalHours;
      group.totalCompensationCap = totalHours * group.standardRate;

      group.roleSummary = group.roles
        .map(role => role.role)
        .join(", ");

      group.deliverablesSummary = group.roles
        .map(role => `${role.role}: ${role.deliverables || "-"}`)
        .join("\n");

      group.scopeOfServices = group.roles
        .map(role => `${role.role}: ${role.deliverables || "-"}`)
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
    })
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
      phone: getText_(row.properties["Phone Number"])
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

function sowGetDateStart_(property) {
  return property?.date?.start || "";
}

function sowToday_() {
  return Utilities.formatDate(
    new Date(),
    "America/Los_Angeles",
    "yyyy-MM-dd"
  );
}

function sowFormatDate_(dateString) {
  if (!dateString) return "-";

  const date = new Date(`${dateString}T12:00:00Z`);

  return Utilities.formatDate(
    date,
    "UTC",
    "MMM-dd-yy"
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

function updateSowContractorFileForAssignments_(assignmentIds, fileName, fileUrl) {
  (assignmentIds || []).forEach(assignmentId => {
    notionFetch_(
      `https://api.notion.com/v1/pages/${assignmentId}`,
      "patch",
      {
        properties: {
          "SOW Contractor": {
            files: [
              {
                name: fileName,
                type: "external",
                external: {
                  url: fileUrl
                }
              }
            ]
          }
        }
      }
    );
  });
}
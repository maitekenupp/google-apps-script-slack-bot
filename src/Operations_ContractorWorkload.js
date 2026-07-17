/******************************************************
 *
 * IZA
 * File: Operations_ContractorWorkload.gs
 *
 * Purpose:
 * Admin contractor workload report based on contractor
 * assignments in Projects by Contractor.
 *
 ******************************************************/


/************************************
 * CONTRACTOR WORKLOAD ENTRY POINT
 ************************************/

function handleContractorWorkloadButton_(channelId, messageTs, userId) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildContractorWorkloadLoadingBlocks_(),
    "Loading Contractor Workload"
  );

  const contractors =
    buildContractorWorkloadData_();

  updateIzaMenu(
    channelId,
    messageTs,
    buildContractorWorkloadSummaryBlocks_(contractors),
    "Contractor Workload"
  );
}

function buildContractorWorkloadLoadingBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "👤 *Contractor Workload*\n\n" +
          "Reviewing contractor assignments..."
      }
    }
  ];
}


/************************************
 * CONTRACTOR WORKLOAD DATA
 ************************************/

function buildContractorWorkloadData_() {
  const assignmentRows =
    queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);

  const projectsById =
    loadContractorWorkloadProjectsById_();

  const contractors = {};

  assignmentRows.forEach(row => {
    const p = row.properties;

    const contractorName =
      getText_(p["Contractor"]);

    if (!contractorName) {
      return;
    }

    const projectId =
      p["Projects 1 related to"]?.relation?.[0]?.id || "";

    const project =
      projectsById[projectId];

    if (!project) {
      return;
    }

    if (!isContractorWorkloadStatusAllowed_(project.status)) {
      return;
    }

    const role =
      getMultiSelectNames_(p["Role"]).join(", ") ||
      getText_(p["Role"]) ||
      "Role";

    const contractedHours =
      getNumber_(p["Hours to Contractor"]);

    const billedHistorical =
      getNumber_(p["Billed Historical"]);

    const billedCurrent =
      getNumber_(p["Billed"]);

    const billedTotal =
      roundHours_(billedHistorical + billedCurrent);

    const isInternalNoHours =
      project.status === "Internal" &&
      contractedHours <= 0;

    const remainingHours =
      isInternalNoHours
        ? 0
        : roundHours_(contractedHours - billedTotal);

    const rate =
      getNumber_(p["Rate per Hour"]);

    if (!contractors[contractorName]) {
      contractors[contractorName] = {
        contractorName,
        totalContracted: 0,
        totalBilled: 0,
        totalRemaining: 0,
        totalValue: 0,
        statusGroups: {}
      };
    }

    if (!isInternalNoHours) {
      contractors[contractorName].totalContracted += contractedHours;
      contractors[contractorName].totalBilled += billedTotal;
      contractors[contractorName].totalRemaining += remainingHours;
      contractors[contractorName].totalValue += contractedHours * rate;
    }

    const displayStatus =
      getContractorWorkloadDisplayStatus_(project.status);

    if (!contractors[contractorName].statusGroups[displayStatus]) {
      contractors[contractorName].statusGroups[displayStatus] = {};
    }

    if (!contractors[contractorName].statusGroups[displayStatus][project.name]) {
      contractors[contractorName].statusGroups[displayStatus][project.name] = {
        projectName: project.name,
        status: displayStatus,
        originalStatus: project.status,
        contractedHours: 0,
        billedTotal: 0,
        remainingHours: 0,
        roles: []
      };
    }

    const projectSummary =
      contractors[contractorName].statusGroups[displayStatus][project.name];

    if (!isInternalNoHours) {
      projectSummary.contractedHours += contractedHours;
      projectSummary.billedTotal += billedTotal;
      projectSummary.remainingHours += remainingHours;
    } else {
      projectSummary.billedTotal += billedTotal;
    }

    projectSummary.roles.push({
      role,
      contractedHours,
      billedHistorical,
      billedCurrent,
      billedTotal,
      remainingHours,
      rate,
      isInternalNoHours
    });
  });

  return contractors;
}


/************************************
 * SUMMARY BLOCKS
 ************************************/

function buildContractorWorkloadSummaryBlocks_(contractors) {
  const contractorNames =
    Object.keys(contractors).sort();

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "👤 *Contractor Workload*\n\n" +
          "_Showing Quotation, Paused, In progress, and Internal projects only._"
      }
    }
  ];

  if (!contractorNames.length) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "No contractor assignments found for those statuses."
      }
    });

    blocks.push({
      type: "actions",
      elements: [
        button_("⬅️ Back", "admin_contractors_menu")
      ]
    });

    return blocks;
  }

  contractorNames.forEach(contractorName => {
    const contractor =
      contractors[contractorName];

    blocks.push(
      buildContractorWorkloadSummarySection_(contractor)
    );
  });

  blocks.push({
    type: "actions",
    elements: [
      button_("⬅️ Back", "admin_contractors_menu")
    ]
  });

  return blocks;
}

function buildContractorWorkloadSummarySection_(contractor) {
  const totalContracted =
    roundHours_(contractor.totalContracted);

  const totalBilled =
    roundHours_(contractor.totalBilled);

  const totalRemaining =
    roundHours_(contractor.totalRemaining);

  const utilization =
    totalContracted > 0
      ? (totalBilled / totalContracted) * 100
      : 0;

  const projectCount =
    getContractorWorkloadProjectCount_(contractor);

  const statusLines =
    getContractorWorkloadStatusOrder_()
      .map(status => {
        const count =
          contractor.statusGroups[status]
            ? Object.keys(contractor.statusGroups[status]).length
            : 0;

        return count
          ? `*${status} (${count})*`
          : null;
      })
      .filter(Boolean)
      .join("\n");

  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        `👷 *${contractor.contractorName} (${projectCount})*\n` +
        `Used: ${totalBilled}/${totalContracted} hrs | ` +
        `Remaining: ${totalRemaining} | ` +
        `Utilization: ${utilization.toFixed(1)}%\n` +
        `${statusLines || "_No matching project statuses._"}`
    },
    accessory: {
      type: "button",
      text: {
        type: "plain_text",
        text: "Details",
        emoji: true
      },
      action_id: "contractor_workload_details",
      value: contractor.contractorName
    }
  };
}


/************************************
 * DETAILS MODAL
 ************************************/

function openContractorWorkloadDetailsModal_(payload, userId) {
  const contractorName =
    payload.actions?.[0]?.value || "";

  const openResult = openSlackModal_(
    payload.trigger_id,
    buildContractorWorkloadLoadingModalView_(contractorName)
  );

  const contractors =
    buildContractorWorkloadData_();

  const contractor =
    contractors[contractorName];

  const view = contractor
    ? buildContractorWorkloadDetailsModalView_(contractor)
    : buildContractorWorkloadNotFoundModalView_(contractorName);

  callSlackApi_("views.update", {
    view_id: openResult.view.id,
    view
  });
}

function buildContractorWorkloadLoadingModalView_(contractorName) {
  return {
    type: "modal",
    callback_id: "contractor_workload_loading_modal",
    title: {
      type: "plain_text",
      text: "Workload Details",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Close",
      emoji: true
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "👷 *Loading contractor workload...*\n\n" +
            `*Contractor:* ${contractorName || "-"}`
        }
      }
    ]
  };
}

function buildContractorWorkloadNotFoundModalView_(contractorName) {
  return {
    type: "modal",
    callback_id: "contractor_workload_not_found_modal",
    title: {
      type: "plain_text",
      text: "Workload Details",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Close",
      emoji: true
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "I could not find workload details for this contractor.\n\n" +
            `*Contractor:* ${contractorName || "-"}`
        }
      }
    ]
  };
}

function buildContractorWorkloadDetailsModalView_(contractor) {
  return {
    type: "modal",
    callback_id: "contractor_workload_details_modal",
    title: {
      type: "plain_text",
      text: "Workload Details",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Close",
      emoji: true
    },
    blocks: buildContractorWorkloadDetailsModalBlocks_(contractor)
  };
}

function buildContractorWorkloadDetailsModalBlocks_(contractor) {
  const blocks = [];

  const totalContracted =
    roundHours_(contractor.totalContracted);

  const totalBilled =
    roundHours_(contractor.totalBilled);

  const totalRemaining =
    roundHours_(contractor.totalRemaining);

  const utilization =
    totalContracted > 0
      ? (totalBilled / totalContracted) * 100
      : 0;

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        `👷 *${contractor.contractorName}*\n` +
        `Used: ${totalBilled}/${totalContracted} hrs | ` +
        `Remaining: ${totalRemaining} | ` +
        `Utilization: ${utilization.toFixed(1)}%`
    }
  });

  getContractorWorkloadStatusOrder_().forEach(status => {
    const projectsByName =
      contractor.statusGroups[status];

    if (!projectsByName) {
      return;
    }

    const projects =
      Object.keys(projectsByName)
        .sort()
        .map(projectName => projectsByName[projectName]);

    blocks.push({
      type: "divider"
    });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${status} (${projects.length})*`
      }
    });

    projects.forEach(project => {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: buildContractorWorkloadProjectDetailText_(project)
        }
      });
    });
  });

  return blocks.slice(0, 100);
}

function buildContractorWorkloadProjectDetailText_(project) {
  const isInternalNoHours =
    project.originalStatus === "Internal" &&
    project.contractedHours <= 0;

  const projectHoursText =
    isInternalNoHours
      ? `${roundHours_(project.billedTotal)}/-`
      : `${roundHours_(project.billedTotal)}/${roundHours_(project.contractedHours)}`;

  const projectRemainingText =
    isInternalNoHours
      ? "-"
      : roundHours_(project.remainingHours);

  let text =
    `*${project.projectName}*\n` +
    `Used: ${projectHoursText} hrs | ` +
    `Remaining: ${projectRemainingText}\n`;

  project.roles
    .sort((a, b) => a.role.localeCompare(b.role))
    .forEach(role => {
      const roleHoursText =
        role.isInternalNoHours
          ? `${roundHours_(role.billedTotal)}/-`
          : `${roundHours_(role.billedTotal)}/${roundHours_(role.contractedHours)}`;

      const roleRemainingText =
        role.isInternalNoHours
          ? "-"
          : `${roundHours_(role.remainingHours)} left`;

      text +=
        `• ${role.role}: ` +
        `${roleHoursText} hrs ` +
        `(${roleRemainingText})\n`;
    });

  return text.trim();
}


/************************************
 * HELPERS
 ************************************/

function loadContractorWorkloadProjectsById_() {
  const rows =
    queryAllDataSourceRows_(PROJECTS_OVERVIEW_DATA_SOURCE_ID);

  const projects = {};

  rows.forEach(row => {
    projects[row.id] = {
      id: row.id,
      name:
        getText_(row.properties["Project Name"]) ||
        "Untitled Project",
      status:
        getText_(row.properties["Project Status"]) ||
        "No Status"
    };
  });

  return projects;
}

function getContractorWorkloadProjectCount_(contractor) {
  let count = 0;

  Object.keys(contractor.statusGroups || {}).forEach(status => {
    count += Object.keys(contractor.statusGroups[status] || {}).length;
  });

  return count;
}

function isContractorWorkloadStatusAllowed_(status) {
  const normalized =
    normalizeContractorWorkloadStatus_(status);

  return [
    "quotation",
    "paused",
    "in progress",
    "internal"
  ].includes(normalized);
}

function getContractorWorkloadDisplayStatus_(status) {
  const normalized =
    normalizeContractorWorkloadStatus_(status);

  if (normalized === "quotation") return "Quotation";
  if (normalized === "paused") return "Paused";
  if (normalized === "in progress") return "In progress";
  if (normalized === "internal") return "Internal";

  return status || "No Status";
}

function normalizeContractorWorkloadStatus_(status) {
  const text =
    String(status || "")
      .trim()
      .toLowerCase();

  if (text === "pause") return "paused";
  if (text === "paused") return "paused";
  if (text === "in progress") return "in progress";
  if (text === "in-progress") return "in progress";

  return text;
}

function getContractorWorkloadStatusOrder_() {
  return [
    "Quotation",
    "Paused",
    "In progress",
    "Internal"
  ];
}

function formatContractorWorkloadMoney_(value) {
  return "$" + Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/************************************
 * MY WORKLOAD
 ************************************/

function handleMyWorkloadButton_(channelId, messageTs, userId) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildMyWorkloadLoadingBlocks_(),
    "Loading My Workload"
  );

  const contractor =
    findInvoiceContractorBySlackId_(userId);

  if (!contractor) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildMyWorkloadMessageBlocks_(
        "👤 *My Workload*\n\nI could not find your contractor profile in Team Directory."
      ),
      "My Workload"
    );
    return;
  }

  const workload =
    buildMyWorkloadData_(contractor);

  updateIzaMenu(
    channelId,
    messageTs,
    buildMyWorkloadBlocks_(contractor, workload),
    "My Workload"
  );
}

function buildMyWorkloadLoadingBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "👤 *My Workload*\n\n" +
          "Loading your active projects..."
      }
    }
  ];
}

function buildMyWorkloadMessageBlocks_(text) {
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
        button_("⬅️ Back", "menu_operations"),
        button_("🐞 Report Bug", "bug_report_open")
      ]
    }
  ];
}

function buildMyWorkloadData_(contractor) {
  const assignmentRows =
    queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);

  const projectsById =
    loadContractorWorkloadProjectsById_();

  const groups = {};

  assignmentRows.forEach(row => {
    const p = row.properties;

    const contractorName =
      getText_(p["Contractor"]);

    if (
      !contractorName ||
      contractorName.toLowerCase() !== contractor.name.toLowerCase()
    ) {
      return;
    }

    const projectId =
      p["Projects 1 related to"]?.relation?.[0]?.id || "";

    const project =
      projectsById[projectId];

    if (!project) {
      return;
    }

    if (!isMyWorkloadStatusAllowed_(project.status)) {
      return;
    }

    const role =
      getMultiSelectNames_(p["Role"]).join(", ") ||
      getText_(p["Role"]) ||
      "Role";

    const contractedHours =
      getNumber_(p["Hours to Contractor"]);

    const billedHistorical =
      getNumber_(p["Billed Historical"]);

    const billedCurrent =
      getNumber_(p["Billed"]);

    const billedTotal =
      roundHours_(billedHistorical + billedCurrent);

    const isInternalNoHours =
      project.status === "Internal" &&
      contractedHours <= 0;

    const remainingHours =
      isInternalNoHours
        ? 0
        : roundHours_(contractedHours - billedTotal);

    const displayStatus =
      getMyWorkloadDisplayStatus_(project.status);

    if (!groups[displayStatus]) {
      groups[displayStatus] = [];
    }

    groups[displayStatus].push({
      assignmentId: row.id,
      projectName: project.name,
      status: displayStatus,
      originalStatus: project.status,
      role,
      contractedHours,
      billedHistorical,
      billedCurrent,
      billedTotal,
      remainingHours,
      rate: getNumber_(p["Rate per Hour"]),
      deliverables:
        getText_(p["Deliverables"]) ||
        getText_(p["Description"]) ||
        "",
      isInternalNoHours
    });
  });

  return groups;
}

function buildMyWorkloadBlocks_(contractor, workload) {
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "👤 *My Workload*\n\n" +
          `*Contractor:* ${contractor.name}`
      }
    }
  ];

  const statuses =
    getMyWorkloadStatusOrder_();

  let hasItems = false;

  statuses.forEach(status => {
    const items =
      workload[status] || [];

    if (!items.length) {
      return;
    }

    hasItems = true;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${status} (${items.length})*`
      }
    });

    items
      .sort((a, b) =>
        a.projectName.localeCompare(b.projectName) ||
        a.role.localeCompare(b.role)
      )
      .forEach(item => {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: buildMyWorkloadItemText_(item)
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Details",
              emoji: true
            },
            action_id: "my_workload_details",
            value: item.assignmentId
          }
        });
      });
  });

  if (!hasItems) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "I could not find active projects assigned to you right now."
      }
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      button_("💵 Submit Invoice", "invoice_start"),
      button_("⏱️ Request Extension", "extension_start")
    ]
  });

  blocks.push({
    type: "actions",
    elements: [
      button_("⬅️ Back", "menu_operations")
    ]
  });

  return blocks;
}

function buildMyWorkloadItemText_(item) {
  const hoursText =
    item.isInternalNoHours
      ? `${roundHours_(item.billedTotal)}/-`
      : `${roundHours_(item.billedTotal)}/${roundHours_(item.contractedHours)}`;

  const remainingText =
    item.isInternalNoHours
      ? "-"
      : roundHours_(item.remainingHours);

  return (
    `*${item.projectName} — ${item.role}*\n` +
    `Used: ${hoursText} hrs | Remaining: ${remainingText}`
  );
}

function isMyWorkloadStatusAllowed_(status) {
  const normalized =
    normalizeContractorWorkloadStatus_(status);

  return [
    "in progress",
    "internal",
    "final billing"
  ].includes(normalized);
}

function getMyWorkloadDisplayStatus_(status) {
  const normalized =
    normalizeContractorWorkloadStatus_(status);

  if (normalized === "in progress") return "🟢 In progress";
  if (normalized === "internal") return "🔵 Internal";
  if (normalized === "final billing") return "🟣 Final Billing";

  return status || "No Status";
}

function getMyWorkloadStatusOrder_() {
  return [
    "🟢 In progress",
    "🟣 Final Billing",
    "🔵 Internal"
  ];
}

function openMyWorkloadDetailsModal_(payload, userId) {
  const assignmentId =
    payload.actions?.[0]?.value || "";

  const openResult =
    openSlackModal_(
      payload.trigger_id,
      buildMyWorkloadDetailsLoadingModalView_()
    );

  const details =
    getMyWorkloadAssignmentDetails_(assignmentId, userId);

  const view =
    details
      ? buildMyWorkloadDetailsModalView_(details)
      : buildMyWorkloadDetailsNotFoundModalView_();

  callSlackApi_("views.update", {
    view_id: openResult.view.id,
    view
  });
}

function buildMyWorkloadDetailsLoadingModalView_() {
  return {
    type: "modal",
    callback_id: "my_workload_details_loading",
    title: {
      type: "plain_text",
      text: "Workload Details",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Close",
      emoji: true
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "👤 *My Workload*\n\n" +
            "Loading assignment details..."
        }
      }
    ]
  };
}

function buildMyWorkloadDetailsNotFoundModalView_() {
  return {
    type: "modal",
    callback_id: "my_workload_details_not_found",
    title: {
      type: "plain_text",
      text: "Workload Details",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Close",
      emoji: true
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "I could not find this assignment."
        }
      }
    ]
  };
}

function getMyWorkloadAssignmentDetails_(assignmentId, userId) {
  const contractor =
    findInvoiceContractorBySlackId_(userId);

  if (!contractor || !assignmentId) {
    return null;
  }

  const assignment =
    notionFetch_(
      `https://api.notion.com/v1/pages/${assignmentId}`,
      "get"
    );

  const p =
    assignment.properties;

  const contractorName =
    getText_(p["Contractor"]);

  if (
    !contractorName ||
    contractorName.toLowerCase() !== contractor.name.toLowerCase()
  ) {
    return null;
  }

  const projectId =
    p["Projects 1 related to"]?.relation?.[0]?.id || "";

  const projectsById =
    loadContractorWorkloadProjectsById_();

  const project =
    projectsById[projectId] || {};

  const role =
    getMultiSelectNames_(p["Role"]).join(", ") ||
    getText_(p["Role"]) ||
    "Role";

  const contractedHours =
    getNumber_(p["Hours to Contractor"]);

  const billedHistorical =
    getNumber_(p["Billed Historical"]);

  const billedCurrent =
    getNumber_(p["Billed"]);

  const billedTotal =
    roundHours_(billedHistorical + billedCurrent);

  const isInternalNoHours =
    project.status === "Internal" &&
    contractedHours <= 0;

  const remainingHours =
    isInternalNoHours
      ? 0
      : roundHours_(contractedHours - billedTotal);

  return {
    projectName:
      project.name || "Project",
    status:
      project.status || "No Status",
    role,
    contractedHours,
    billedHistorical,
    billedCurrent,
    billedTotal,
    remainingHours,
    rate:
      getNumber_(p["Rate per Hour"]),
    deliverables:
      getText_(p["Deliverables"]) ||
      getText_(p["Description"]) ||
      "",
    isInternalNoHours
  };
}

function buildMyWorkloadDetailsModalView_(details) {
  const hoursText =
    details.isInternalNoHours
      ? `${roundHours_(details.billedTotal)}/-`
      : `${roundHours_(details.billedTotal)}/${roundHours_(details.contractedHours)}`;

  const remainingText =
    details.isInternalNoHours
      ? "-"
      : roundHours_(details.remainingHours);

  return {
    type: "modal",
    callback_id: "my_workload_details",
    title: {
      type: "plain_text",
      text: "Workload Details",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Close",
      emoji: true
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*${details.projectName} — ${details.role}*\n\n` +
            `*Status:* ${details.status}\n` +
            `*Used:* ${hoursText} hrs\n` +
            `*Remaining:* ${remainingText}\n` +
            `*Rate:* $${details.rate}/hr`
        }
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*Deliverables:*\n" +
            `${details.deliverables || "-"}`
        }
      }
    ]
  };
}
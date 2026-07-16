/******************************************************
 *
 * IZA
 * File: Extension_Flow.gs
 *
 * Purpose:
 * Contractor hours extension request flow.
 *
 ******************************************************/

function handleExtensionStart_(channelId, messageTs, userId) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildExtensionLoadingBlocks_(),
    "Loading Extension Requests"
  );

  const contractor = findInvoiceContractorBySlackId_(userId);

  if (!contractor) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildExtensionMessageBlocks_(
        "⏱️ *Request Extension*\n\nI could not find your contractor profile in Team Directory."
      ),
      "Request Extension"
    );
    return;
  }

  const history =
    loadExtensionRequestHistoryForContractor_(contractor.id);

  const assignments =
    loadExtensionAssignmentsForContractor_(contractor);

  const session = {
    contractor,
    assignments,
    history,
    selectedAssignmentId: null
  };

  saveExtensionSession_(userId, session);

  if (!assignments.length && !history.length) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildExtensionMessageBlocks_(
        "⏱️ *Request Extension*\n\nI could not find active assignments available for extension."
      ),
      "Request Extension"
    );
    return;
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildExtensionAssignmentSelectBlocks_(session),
    "Request Extension"
  );
}

function handleExtensionAssignmentSelect_(payload, channelId, messageTs, userId) {
  const session = getExtensionSession_(userId);

  if (!session) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildExtensionMessageBlocks_(
        "⏱️ *Request Extension*\n\nI could not find your extension session. Please start again."
      ),
      "Request Extension"
    );
    return;
  }

  const selected =
    payload.actions?.[0]?.selected_option?.value || "";

  session.selectedAssignmentId = selected;
  saveExtensionSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildExtensionAssignmentSelectedBlocks_(session),
    "Request Extension"
  );
}

function loadExtensionAssignmentsForContractor_(contractor) {
  const assignmentRows =
    queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);

  const projectRows =
    queryAllDataSourceRows_(PROJECTS_OVERVIEW_DATA_SOURCE_ID);

  const pendingRequestRows =
    queryAllDataSourceRows_(CONTRACTOR_EXTENSION_REQUESTS_DATA_SOURCE_ID);

  const projectsById = {};

  projectRows.forEach(row => {
    projectsById[row.id] = {
      id: row.id,
      name:
        getText_(row.properties["Project Name"]) ||
        "Project",
      status:
        getText_(row.properties["Project Status"]) ||
        ""
    };
  });

  const pendingAssignmentIds = {};

  pendingRequestRows.forEach(row => {
    const p = row.properties;

    const status =
      getText_(p["Status"]);

    if (status !== "Pending") {
      return;
    }

    const contractorId =
      p["Contractor"]?.relation?.[0]?.id || "";

    if (contractorId !== contractor.id) {
      return;
    }

    const assignmentId =
      p["Assignment"]?.relation?.[0]?.id || "";

    if (assignmentId) {
      pendingAssignmentIds[assignmentId] = true;
    }
  });

  const assignments = [];

  assignmentRows.forEach(row => {
    const p = row.properties;

    const contractorName = getText_(p["Contractor"]);

    if (
      contractorName.toLowerCase() !==
      contractor.name.toLowerCase()
    ) {
      return;
    }

    const projectId =
      p["Projects 1 related to"]?.relation?.[0]?.id || "";

    if (!projectId) return;

    const project = projectsById[projectId];

    if (!project) return;

    if (project.status !== "In progress") {
      return;
    }

    if (pendingAssignmentIds[row.id]) {
      return;
    }

    const role =
      getMultiSelectNames_(p["Role"])?.[0] ||
      getText_(p["Role"]) ||
      "Role";

    const contractedHours =
      getNumber_(p["Hours to Contractor"]);

    const billedHistorical =
      getNumber_(p["Billed Historical"]);

    const billedCurrent =
      getNumber_(p["Billed"]);

    const billedHours =
      roundHours_(billedHistorical + billedCurrent);

    const remainingHours =
      roundHours_(contractedHours - billedHours);

    assignments.push({
      assignmentId: row.id,
      contractorId: contractor.id,
      contractorName: contractor.name,
      projectId: project.id,
      projectName: project.name,
      projectStatus: project.status,
      role,
      contractedHours,
      billedHours,
      remainingHours
    });
  });

  return assignments
    .filter(assignment => assignment.contractedHours > 0)
    .sort((a, b) =>
      `${a.projectName} ${a.role}`.localeCompare(
        `${b.projectName} ${b.role}`
      )
    );
}

function buildExtensionLoadingBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "⏱️ *Request Extension*\n\n" +
          "Loading your active assignments..."
      }
    }
  ];
}

function buildExtensionMessageBlocks_(text) {
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

function buildExtensionAssignmentSelectBlocks_(session) {
  const blocks = [];

  const hasAssignments =
    session.assignments && session.assignments.length;

  const introText = hasAssignments
    ? "Select the assignment that needs more hours."
    : "There are no new assignments available for extension right now.";

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text:
        "⏱️ *Request Extension*\n\n" +
        `*Contractor:* ${session.contractor.name}\n\n` +
        introText
    }
  });

  if (hasAssignments) {
    const options = session.assignments
      .slice(0, 100)
      .map(assignment => ({
        text: {
          type: "plain_text",
          text: `${assignment.projectName} - ${assignment.role}`.substring(0, 75),
          emoji: true
        },
        value: assignment.assignmentId
      }));

    blocks.push({
      type: "actions",
      elements: [
        {
          type: "static_select",
          action_id: "extension_assignment_select",
          placeholder: {
            type: "plain_text",
            text: "Select assignment",
            emoji: true
          },
          options
        }
      ]
    });
  }

  blocks.push.apply(
    blocks,
    buildExtensionHistoryBlocks_(session.history || [])
  );

  blocks.push({
    type: "actions",
    elements: [
      button_("⬅️ Back", "menu_operations")
    ]
  });

  return blocks;
}

function buildExtensionAssignmentSelectedBlocks_(session) {
  const assignment =
    getSelectedExtensionAssignment_(session);

  if (!assignment) {
    return buildExtensionAssignmentSelectBlocks_(session);
  }

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "⏱️ *Request Extension*\n\n" +
          `*Contractor:* ${session.contractor.name}\n\n` +
          `*Selected:* ${assignment.projectName} - ${assignment.role}\n` +
          `*Contracted hours:* ${assignment.contractedHours}\n` +
          `*Already billed:* ${assignment.billedHours}\n` +
          `*Remaining hours:* ${assignment.remainingHours}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Previous", "extension_previous"),
        button_("📝 Request Hours", "extension_open_modal"),
        button_("❌ Cancel", "extension_cancel")
      ]
    }
  ];
}

function handleExtensionPrevious_(channelId, messageTs, userId) {
  const session = getExtensionSession_(userId);

  if (!session) {
    handleExtensionStart_(channelId, messageTs, userId);
    return;
  }

  session.selectedAssignmentId = null;
  saveExtensionSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildExtensionAssignmentSelectBlocks_(session),
    "Request Extension"
  );
}

function handleExtensionCancel_(channelId, messageTs, userId) {
  clearExtensionSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildExtensionMessageBlocks_(
      "⏱️ *Request Extension*\n\nExtension request canceled."
    ),
    "Request Extension"
  );
}

function getSelectedExtensionAssignment_(session) {
  return (session.assignments || []).find(
    assignment =>
      assignment.assignmentId === session.selectedAssignmentId
  );
}

function saveExtensionSession_(userId, session) {
  PropertiesService
    .getScriptProperties()
    .setProperty(
      `EXTENSION_SESSION_${userId}`,
      JSON.stringify(session)
    );
}

function getExtensionSession_(userId) {
  const raw =
    PropertiesService
      .getScriptProperties()
      .getProperty(`EXTENSION_SESSION_${userId}`);

  return raw ? JSON.parse(raw) : null;
}

function clearExtensionSession_(userId) {
  PropertiesService
    .getScriptProperties()
    .deleteProperty(`EXTENSION_SESSION_${userId}`);
}

function handleExtensionOpenModal_(payload, userId) {
  const session = getExtensionSession_(userId);
  const assignment = session
    ? getSelectedExtensionAssignment_(session)
    : null;

  if (!session || !assignment) {
    return;
  }

  const metadata = JSON.stringify({
    userId,
    channelId: payload.channel.id,
    messageTs: payload.message.ts
  });

  openSlackModal_(
    payload.trigger_id,
    buildExtensionRequestModalView_(assignment, metadata)
  );
}

function buildExtensionRequestModalView_(assignment, privateMetadata) {
  return {
    type: "modal",
    callback_id: "extension_request_submit",
    title: {
      type: "plain_text",
      text: "Request Extension",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Submit",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true
    },
    private_metadata: privateMetadata,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*${assignment.projectName} - ${assignment.role}*\n\n` +
            `*Contracted hours:* ${assignment.contractedHours}\n` +
            `*Already billed:* ${assignment.billedHours}\n` +
            `*Remaining hours:* ${assignment.remainingHours}`
        }
      },
      {
        type: "input",
        block_id: "requested_hours_block",
        label: {
          type: "plain_text",
          text: "Additional hours requested",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "requested_hours_value",
          placeholder: {
            type: "plain_text",
            text: "Example: 5"
          }
        }
      },
      {
        type: "input",
        block_id: "reason_block",
        label: {
          type: "plain_text",
          text: "Why are more hours needed?",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "reason_value",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "Briefly explain the scope change or reason."
          }
        }
      }
    ]
  };
}

function handleExtensionRequestModalSubmit_(payload) {
  const metadata =
    JSON.parse(payload.view.private_metadata || "{}");

  const userId = metadata.userId;
  const channelId = metadata.channelId;
  const messageTs = metadata.messageTs;

  const session = getExtensionSession_(userId);
  const assignment = session
    ? getSelectedExtensionAssignment_(session)
    : null;

  if (!session || !assignment) {
    return {
      response_action: "errors",
      errors: {
        requested_hours_block:
          "I could not find your extension request. Please start again."
      }
    };
  }

  const values = payload.view.state.values;

  const requestedHoursRaw =
    values.requested_hours_block
      .requested_hours_value
      .value;

  const reason =
    values.reason_block
      .reason_value
      .value || "";

  const requestedHours =
    Number(requestedHoursRaw);

  if (!requestedHours || requestedHours <= 0) {
    return {
      response_action: "errors",
      errors: {
        requested_hours_block:
          "Enter a number greater than 0."
      }
    };
  }

  const request = createContractorExtensionRequest_(
    session.contractor,
    assignment,
    requestedHours,
    reason
  );

  postExtensionRequestAdminMessage_(
    request,
    session.contractor,
    assignment,
    requestedHours,
    reason
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildExtensionSubmittedBlocks_(
      assignment,
      requestedHours
    ),
    "Extension Requested"
  );

  clearExtensionSession_(userId);

  return {
    response_action: "clear"
  };
}

function createContractorExtensionRequest_(
    contractor,
    assignment,
    requestedHours,
    reason
  ) {
  const requestName =
    `${contractor.name} - ${assignment.projectName} - ${assignment.role}`;

  return notionFetch_(
    "https://api.notion.com/v1/pages",
    "post",
    {
      parent: {
        data_source_id: CONTRACTOR_EXTENSION_REQUESTS_DATA_SOURCE_ID
      },
      properties: {
        "Name": {
          title: [
            {
              text: {
                content: requestName
              }
            }
          ]
        },
        "Contractor": {
          relation: [
            {
              id: contractor.id
            }
          ]
        },
        "Project": {
          relation: [
            {
              id: assignment.projectId
            }
          ]
        },
        "Assignment": {
          relation: [
            {
              id: assignment.assignmentId
            }
          ]
        },
        "Role": {
          rich_text: [
            {
              text: {
                content: assignment.role
              }
            }
          ]
        },
        "Current Contracted Hours": {
          number: assignment.contractedHours
        },
        "Billed Hours": {
          number: assignment.billedHours
        },
        "Remaining Hours": {
          number: assignment.remainingHours
        },
        "Requested Extra Hours": {
          number: requestedHours
        },
        "Reason": {
          rich_text: [
            {
              text: {
                content: reason || ""
              }
            }
          ]
        },
        "Status": {
          select: {
            name: "Pending"
          }
        },
        "Requested Date": {
          date: {
            start: new Date().toISOString().slice(0, 10)
          }
        },
        "Project Name": {
          rich_text: [
            {
              text: {
                content: assignment.projectName || ""
              }
            }
          ]
        },
        "Contractor Name": {
          rich_text: [
            {
              text: {
                content: contractor.name || ""
              }
            }
          ]
        }
      }
    }
  );
}

function postExtensionRequestAdminMessage_(
    request,
    contractor,
    assignment,
    requestedHours,
    reason
  ) {
  const newTotal =
    Number(assignment.contractedHours || 0) +
    Number(requestedHours || 0);

  const result = postSlackMessage_(
    CONTRACTOR_CLAIMS_CHANNEL,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "⏱️ *Extension Request*\n\n" +
            `*Contractor:* ${contractor.name}\n` +
            `*Project:* ${assignment.projectName}\n` +
            `*Role:* ${assignment.role}\n\n` +
            `*Current contracted hours:* ${assignment.contractedHours}\n` +
            `*Already billed:* ${assignment.billedHours}\n` +
            `*Remaining hours:* ${assignment.remainingHours}\n` +
            `*Requested extra hours:* ${requestedHours}\n` +
            `*New total if approved:* ${newTotal}\n\n` +
            "*Reason:*\n" +
            `${reason || "-"}`
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "✅ Approve",
              emoji: true
            },
            style: "primary",
            action_id: "extension_approve",
            value: JSON.stringify({
              requestId: request.id,
              assignmentId: assignment.assignmentId,
              contractorId: contractor.id,
              contractorName: contractor.name,
              contractorSlackId: contractor.slackId || "",
              projectId: assignment.projectId,
              projectName: assignment.projectName,
              role: assignment.role,
              requestedHours
            })
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "❌ Deny",
              emoji: true
            },
            style: "danger",
            action_id: "extension_deny",
            value: JSON.stringify({
              requestId: request.id,
              assignmentId: assignment.assignmentId,
              contractorId: contractor.id,
              contractorName: contractor.name,
              contractorSlackId: contractor.slackId || "",
              projectId: assignment.projectId,
              projectName: assignment.projectName,
              role: assignment.role
            })
          }
        ]
      }
    ],
    "Extension request"
  );

  saveExtensionAdminMessageLocation_(
    request.id,
    result.channel,
    result.ts
  );
}

function saveExtensionAdminMessageLocation_(requestId, channelId, messageTs) {
  return notionFetch_(
    `https://api.notion.com/v1/pages/${requestId}`,
    "patch",
    {
      properties: {
        "Admin Channel ID": {
          rich_text: [
            {
              text: {
                content: channelId || ""
              }
            }
          ]
        },
        "Admin Message TS": {
          rich_text: [
            {
              text: {
                content: messageTs || ""
              }
            }
          ]
        }
      }
    }
  );
}

function buildExtensionSubmittedBlocks_(assignment, requestedHours) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "✅ *Extension request submitted*\n\n" +
          `*Project:* ${assignment.projectName}\n` +
          `*Role:* ${assignment.role}\n` +
          `*Requested extra hours:* ${requestedHours}\n\n` +
          "Your request was sent for review."
      }
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "menu_operations"),
        button_("👋 Bye IZA", "menu_close")
      ]
    }
  ];
}

function handleExtensionApprove_(channelId, messageTs, adminUserId, value) {
  const data = JSON.parse(value);
  const statusCheck =
    getExtensionRequestFullDetails_(data.requestId);

  if (!statusCheck || statusCheck.status !== "Pending") {
    updateIzaMenu(
      channelId,
      messageTs,
      buildExtensionNoLongerPendingBlocks_(statusCheck),
      "Extension Not Pending"
    );
    return;
  }

  updateIzaMenu(
    channelId,
    messageTs,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "⏳ *Approving extension request...*\n\n" +
            `*Project:* ${data.projectName}\n` +
            `*Contractor:* ${data.contractorName}\n` +
            `*Role:* ${data.role}`
        }
      }
    ],
    "Approving Extension"
  );

  const requestDetails =
    getExtensionRequestDetails_(data.requestId);

  const assignmentDetails =
    getExtensionAssignmentDetails_(data.assignmentId);

  const projectDetails =
    getExtensionProjectDetails_(
      data.projectId || assignmentDetails.projectId
    );

  const originalHours =
    Number(assignmentDetails.contractedHours || 0);

  const additionalHours =
    Number(requestDetails.requestedHours || 0);

  const newTotalHours =
    originalHours + additionalHours;

  const hourlyRate =
    Number(assignmentDetails.rate || 0);

  const totalCompensationCap =
    newTotalHours * hourlyRate;

  const draftFile =
    createContractorAmendmentDraft_({
      contractorName: data.contractorName,
      projectName: data.projectName,
      startDate: extensionFormatDate_(projectDetails.startDate),
      date: extensionFormatDate_(new Date()),
      role: data.role,
      reason: requestDetails.reason,
      originalHours,
      additionalHours,
      newTotalHours,
      hourlyRate,
      totalCompensationCap
    });

  updateContractorAssignmentHours_(
    data.assignmentId,
    newTotalHours
  );

  addNotionCommentToPage_(
    data.assignmentId,
    [
      "Hours extension approved by IZA.",
      "",
      `Previous hours: ${originalHours}`,
      `Added hours: ${additionalHours}`,
      `New total hours: ${newTotalHours}`,
      "",
      "Reason:",
      requestDetails.reason || "-",
      "",
      `Approved by: <@${adminUserId}>`,
      `Date: ${extensionFormatDate_(new Date())}`
    ].join("\n")
  );

  updateExtensionRequestAfterApproval_(
    data.requestId,
    adminUserId,
    draftFile
  );

  notifyExtensionApproved_(
    data.contractorSlackId,
    data.projectName,
    data.role,
    additionalHours,
    newTotalHours
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildExtensionApprovedBlocks_(
      data,
      additionalHours,
      newTotalHours,
      draftFile
    ),
    "Extension Approved"
  );
}

function buildExtensionNoLongerPendingBlocks_(request) {
  const status =
    request?.status || "Unknown";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "⚪ *This extension request is no longer pending.*\n\n" +
          `*Current status:* ${status}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("👋 Bye IZA", "menu_close")
      ]
    }
  ];
}

function handleExtensionDeny_(channelId, messageTs, adminUserId, value) {
  const data = JSON.parse(value);

  const statusCheck =
    getExtensionRequestFullDetails_(data.requestId);

  if (!statusCheck || statusCheck.status !== "Pending") {
    updateIzaMenu(
      channelId,
      messageTs,
      buildExtensionNoLongerPendingBlocks_(statusCheck),
      "Extension Not Pending"
    );
    return;
  }

  const requestDetails =
    getExtensionRequestDetails_(data.requestId);

  const contractor =
    getExtensionContractorDetails_(data.contractorId);

  updateExtensionRequestAfterDenial_(
    data.requestId,
    adminUserId
  );

  addNotionCommentToPage_(
    data.assignmentId,
    [
      "Hours extension request denied by IZA.",
      "",
      `Requested extra hours: ${requestDetails.requestedHours}`,
      "",
      "Reason provided:",
      requestDetails.reason || "-",
      "",
      `Denied by: <@${adminUserId}>`,
      `Date: ${extensionFormatDate_(new Date())}`
    ].join("\n")
  );

  notifyExtensionDenied_(
    contractor.slackId || data.contractorSlackId,
    data.projectName,
    data.role
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildExtensionDeniedBlocks_(
      data,
      requestDetails.requestedHours
    ),
    "Extension Denied"
  );
}

function getExtensionContractorDetails_(contractorId) {
  if (!contractorId) {
    return {};
  }

  const page =
    notionFetch_(
      `https://api.notion.com/v1/pages/${contractorId}`,
      "get"
    );

  const p = page.properties;

  return {
    id: page.id,
    name:
      getText_(p["Name"]) || "",
    slackId:
      getText_(p["Slack UID"]) || "",
    email:
      getText_(p["Email"]) || ""
  };
}

function getExtensionRequestDetails_(requestId) {
  const page =
    notionFetch_(
      `https://api.notion.com/v1/pages/${requestId}`,
      "get"
    );

  const p = page.properties;

  return {
    id: page.id,
    requestedHours:
      getNumber_(p["Requested Extra Hours"]),
    reason:
      getText_(p["Reason"])
  };
}

function getExtensionAssignmentDetails_(assignmentId) {
  const page =
    notionFetch_(
      `https://api.notion.com/v1/pages/${assignmentId}`,
      "get"
    );

  const p = page.properties;

  return {
    id: page.id,
    contractedHours:
      getNumber_(p["Hours to Contractor"]),
    rate:
      getNumber_(p["Rate per Hour"]),
    projectId:
      p["Projects 1 related to"]?.relation?.[0]?.id || ""
  };
}

function getExtensionProjectDetails_(projectId) {
  if (!projectId) {
    return {
      startDate: ""
    };
  }

  const page =
    notionFetch_(
      `https://api.notion.com/v1/pages/${projectId}`,
      "get"
    );

  const p = page.properties;

  return {
    id: page.id,
    startDate:
      p["Project Start Date"]?.date?.start || ""
  };
}

function updateContractorAssignmentHours_(assignmentId, newTotalHours) {
  return notionFetch_(
    `https://api.notion.com/v1/pages/${assignmentId}`,
    "patch",
    {
      properties: {
        "Hours to Contractor": {
          number: newTotalHours
        }
      }
    }
  );
}

function updateExtensionRequestAfterApproval_(requestId, adminUserId, draftFile) {
  saveExtensionAmendmentDraft_(requestId, draftFile);

  return notionFetch_(
    `https://api.notion.com/v1/pages/${requestId}`,
    "patch",
    {
      properties: {
        "Status": {
          select: {
            name: "Approved"
          }
        },
        "Reviewed Date": {
          date: {
            start: new Date().toISOString().slice(0, 10)
          }
        },
        "Reviewed By": {
          rich_text: [
            {
              text: {
                content: `<@${adminUserId}>`
              }
            }
          ]
        }
      }
    }
  );
}

function saveExtensionAmendmentDraft_(requestId, draftFile) {
  PropertiesService
    .getScriptProperties()
    .setProperty(
      `EXTENSION_AMENDMENT_DRAFT_${requestId}`,
      JSON.stringify(draftFile)
    );
}

function getExtensionAmendmentDraft_(requestId) {
  const raw =
    PropertiesService
      .getScriptProperties()
      .getProperty(`EXTENSION_AMENDMENT_DRAFT_${requestId}`);

  return raw ? JSON.parse(raw) : null;
}

function clearExtensionAmendmentDraft_(requestId) {
  PropertiesService
    .getScriptProperties()
    .deleteProperty(`EXTENSION_AMENDMENT_DRAFT_${requestId}`);
}

function updateExtensionRequestAfterDenial_(requestId, adminUserId) {
  return notionFetch_(
    `https://api.notion.com/v1/pages/${requestId}`,
    "patch",
    {
      properties: {
        "Status": {
          select: {
            name: "Denied"
          }
        },
        "Reviewed Date": {
          date: {
            start: new Date().toISOString().slice(0, 10)
          }
        },
        "Reviewed By": {
          rich_text: [
            {
              text: {
                content: `<@${adminUserId}>`
              }
            }
          ]
        }
      }
    }
  );
}

function addNotionCommentToPage_(pageId, text) {
  try {
    return notionFetch_(
      "https://api.notion.com/v1/comments",
      "post",
      {
        parent: {
          page_id: pageId
        },
        rich_text: [
          {
            type: "text",
            text: {
              content: text
            }
          }
        ]
      }
    );
  } catch (err) {
    Logger.log(
      "Could not add Notion comment: " + err.message
    );

    return null;
  }
}

function createContractorAmendmentDraft_(amendmentData) {
  const templateFile =
    DriveApp.getFileById(CONTRACTOR_AMENDMENT_TEMPLATE_DOC_ID);

  const folder =
    DriveApp.getFolderById(CONTRACTOR_SOW_FOLDER_ID);

  const fileName =
    extensionSafeFileName_(
      `Amendment Draft - ${amendmentData.projectName} - ${amendmentData.contractorName} - ${amendmentData.role}`
    );

  const copiedDoc =
    templateFile.makeCopy(fileName, folder);

  const doc =
    DocumentApp.openById(copiedDoc.getId());

  const body =
    doc.getBody();

  fillContractorAmendmentDocument_(body, amendmentData);

  doc.saveAndClose();

  return {
    id: copiedDoc.getId(),
    name: copiedDoc.getName(),
    url: copiedDoc.getUrl()
  };
}

function fillContractorAmendmentDocument_(body, amendmentData) {
  replaceExtensionPlaceholder_(body, "{{Contractor Name}}", amendmentData.contractorName);
  replaceExtensionPlaceholder_(body, "{{Project Name}}", amendmentData.projectName);
  replaceExtensionPlaceholder_(body, "{{Start Date}}", amendmentData.startDate);
  replaceExtensionPlaceholder_(body, "{{Date}}", amendmentData.date);
  replaceExtensionPlaceholder_(body, "{{Role}}", amendmentData.role);
  replaceExtensionPlaceholder_(body, "{{Reason}}", amendmentData.reason);

  replaceExtensionPlaceholder_(body, "{{Original Hours}}", String(amendmentData.originalHours));
  replaceExtensionPlaceholder_(body, "{{Additional Hours}}", String(amendmentData.additionalHours));
  replaceExtensionPlaceholder_(body, "{{New Total Hours}}", String(amendmentData.newTotalHours));

  replaceExtensionPlaceholder_(body, "{{Hourly Rate}}", extensionFormatMoney_(amendmentData.hourlyRate));
  replaceExtensionPlaceholder_(body, "{{Total Compensation Cap}}", extensionFormatMoney_(amendmentData.totalCompensationCap));
}

function replaceExtensionPlaceholder_(element, placeholder, value) {
  element.replaceText(
    extensionEscapeRegex_(placeholder),
    value || ""
  );
}

function extensionEscapeRegex_(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extensionFormatDate_(value) {
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

function extensionFormatMoney_(value) {
  return "$" + Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function extensionSafeFileName_(name) {
  return String(name || "Amendment")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function notifyExtensionApproved_(
    contractorSlackId,
    projectName,
    role,
    additionalHours,
    newTotalHours
  ) {
  if (!contractorSlackId) return;

  const dmChannelId =
    openSlackDm(contractorSlackId);

  sendSlackMessage(
    dmChannelId,
    [
      `Hi <@${contractorSlackId}> 👋`,
      "",
      `Good news — your extension request for *${role}* on *${projectName}* was approved.`,
      "",
      `*Additional approved hours:* ${additionalHours}`,
      `*New total hours:* ${newTotalHours}`,
      "",
      "The amendment draft is being prepared and will be finalized by the team."
    ].join("\n")
  );
}

function notifyExtensionDenied_(contractorSlackId, projectName, role) {
  if (!contractorSlackId) return;

  const dmChannelId =
    openSlackDm(contractorSlackId);

  sendSlackMessage(
    dmChannelId,
    [
      `Hi <@${contractorSlackId}> 👋`,
      "",
      `Your extension request for *${role}* on *${projectName}* was not approved at this time.`,
      "",
      "We’ll contact you personally to review the situation."
    ].join("\n")
  );
}

function buildExtensionApprovedBlocks_(
    data,
    additionalHours,
    newTotalHours,
    draftFile
  ) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🟢 *Extension Approved*\n\n" +
          `*Contractor:* ${data.contractorName}\n` +
          `*Project:* ${data.projectName}\n` +
          `*Role:* ${data.role}\n` +
          `*Additional hours:* ${additionalHours}\n` +
          `*New total hours:* ${newTotalHours}\n\n` +
          `<${draftFile.url}|Open amendment draft>`
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📄 Finalize Amendment PDF",
            emoji: true
          },
          action_id: "extension_finalize_amendment",
          value: JSON.stringify({
            requestId: data.requestId,
            assignmentId: data.assignmentId,
            contractorName: data.contractorName,
            projectName: data.projectName,
            role: data.role,
            requestedHours: additionalHours,
            newTotalHours
          })
        }
      ]
    }
  ];
}

function handleExtensionFinalizeAmendment_(
    channelId,
    messageTs,
    userId,
    value
  ) {
  const data = JSON.parse(value);

  updateIzaMenu(
    channelId,
    messageTs,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "⏳ *Finalizing amendment PDF...*\n\n" +
            `*Project:* ${data.projectName}\n` +
            `*Contractor:* ${data.contractorName}\n` +
            `*Role:* ${data.role}`
        }
      }
    ],
    "Finalizing Amendment"
  );

  const draftFile =
    getExtensionAmendmentDraft_(data.requestId);

  if (!draftFile || !draftFile.id) {
    updateIzaMenu(
      channelId,
      messageTs,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "❌ *I could not find the amendment draft.*\n\n" +
              "Please regenerate or review the extension request."
          }
        }
      ],
      "Amendment Draft Missing"
    );
    return;
  }

  const pdfFile =
    finalizeContractorAmendmentPdf_(
      draftFile.id,
      data.projectName,
      data.contractorName,
      data.role
    );

  updateExtensionRequestAmendmentFile_(
    data.requestId,
    pdfFile
  );

  updateSowContractorFileForAssignments_(
    [data.assignmentId],
    pdfFile.name,
    pdfFile.url
  );

  trashDriveFileById_(draftFile.id);

  clearExtensionAmendmentDraft_(data.requestId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildExtensionAmendmentFinalizedBlocks_(
      data,
      pdfFile
    ),
    "Amendment Finalized"
  );
}

function finalizeContractorAmendmentPdf_(
    draftDocId,
    projectName,
    contractorName,
    role
  ) {
  const folder =
    DriveApp.getFolderById(CONTRACTOR_SOW_FOLDER_ID);

  const draftFile =
    DriveApp.getFileById(draftDocId);

  const pdfFileName =
    extensionSafeFileName_(
      `Amendment - Pending Signature - ${projectName} - ${contractorName} - ${role}.pdf`
    );

  const pdfBlob =
    draftFile
      .getBlob()
      .getAs(MimeType.PDF)
      .setName(pdfFileName);

  const pdfFile =
    folder.createFile(pdfBlob);

  return {
    id: pdfFile.getId(),
    name: pdfFile.getName(),
    url: pdfFile.getUrl()
  };
}

function updateExtensionRequestAmendmentFile_(requestId, pdfFile) {
  return notionFetch_(
    `https://api.notion.com/v1/pages/${requestId}`,
    "patch",
    {
      properties: {
        "Amendment File": {
          files: [
            {
              name: pdfFile.name,
              type: "external",
              external: {
                url: pdfFile.url
              }
            }
          ]
        }
      }
    }
  );
}

function trashDriveFileById_(fileId) {
  if (!fileId) return;

  DriveApp
    .getFileById(fileId)
    .setTrashed(true);
}

function buildExtensionAmendmentFinalizedBlocks_(data, pdfFile) {
  const requestedHours =
    data.requestedHours || data.additionalHours || "-";

  const newTotalHours =
    data.newTotalHours || "-";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "✅ *Amendment PDF Finalized*\n\n" +
          `*Contractor:* ${data.contractorName}\n` +
          `*Project:* ${data.projectName}\n` +
          `*Role:* ${data.role}\n` +
          `*Additional hours:* ${requestedHours}\n` +
          `*New total hours:* ${newTotalHours}\n\n` +
          `<${pdfFile.url}|Open pending signature amendment>\n\n` +
          "This file is now attached to the contractor assignment and will appear in the pending signature follow-up."
      }
    }
  ];
}

function buildExtensionDeniedBlocks_(data, requestedHours) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🔴 *Extension Denied*\n\n" +
          `*Contractor:* ${data.contractorName}\n` +
          `*Project:* ${data.projectName}\n` +
          `*Role:* ${data.role}\n` +
          `*Requested extra hours:* ${requestedHours || "-"}\n\n` +
          "The contractor was notified."
      }
    }
  ];
}

function loadExtensionRequestHistoryForContractor_(contractorId) {
  const rows =
    queryAllDataSourceRows_(CONTRACTOR_EXTENSION_REQUESTS_DATA_SOURCE_ID);

  const history = [];

  rows.forEach(row => {
    const p = row.properties;

    const rowContractorId =
      p["Contractor"]?.relation?.[0]?.id || "";

    if (rowContractorId !== contractorId) {
      return;
    }

    const status =
      getText_(p["Status"]) || "Pending";

    const projectName =
      getText_(p["Project Name"]) ||
      getRelationDisplayName_(p["Project"]) ||
      "Project";

    const contractorName =
      getText_(p["Contractor Name"]) ||
      getRelationDisplayName_(p["Contractor"]) ||
      "Contractor";

    const role =
      getText_(p["Role"]) || "Role";

    const requestedHours =
      getNumber_(p["Requested Extra Hours"]);

    const requestedDate =
      p["Requested Date"]?.date?.start || "";

    const reviewedDate =
      p["Reviewed Date"]?.date?.start || "";

    history.push({
      requestId: row.id,
      status,
      projectName,
      contractorName,
      role,
      requestedHours,
      requestedDate,
      reviewedDate,
      adminChannelId: getText_(p["Admin Channel ID"]),
      adminMessageTs: getText_(p["Admin Message TS"])
    });
  });

  return history
    .sort((a, b) =>
      String(b.requestedDate || "").localeCompare(
        String(a.requestedDate || "")
      )
    )
    .slice(0, 10);
}

function buildExtensionHistoryBlocks_(history) {
  if (!history.length) {
    return [];
  }

  const groups = {
    Pending: [],
    Approved: [],
    Denied: [],
    Canceled: []
  };

  history.forEach(item => {
    const status = item.status || "Pending";

    if (!groups[status]) {
      groups[status] = [];
    }

    groups[status].push(item);
  });

  const order = [
    "Pending",
    "Approved",
    "Denied",
    "Canceled"
  ];

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Current extension requests:*"
      }
    }
  ];

  order.forEach(status => {
    const items = groups[status] || [];

    if (!items.length) return;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `${getExtensionStatusIcon_(status)} *${status}* (${items.length})`
      }
    });

    items.forEach(item => {
      const text =
        buildExtensionHistoryLine_(item);

      if (status === "Pending") {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Cancel Request",
              emoji: true
            },
            style: "danger",
            action_id: "extension_cancel_request",
            value: JSON.stringify({
              requestId: item.requestId
            })
          }
        });
        return;
      }

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text
        }
      });
    });
  });

  return blocks;
}

function buildExtensionHistoryLine_(item) {
  const dateValue =
    item.status === "Pending"
      ? item.requestedDate
      : item.reviewedDate || item.requestedDate;

  return (
    `• ${item.projectName} / ${item.role} | ` +
    `+${item.requestedHours} hrs | ` +
    `Date: ${extensionFormatDate_(dateValue)}`
  );
}

function getExtensionStatusIcon_(status) {
  if (status === "Approved") return "🟢";
  if (status === "Denied") return "🔴";
  if (status === "Canceled") return "⚪";
  return "🟡";
}

function handleExtensionCancelRequest_(
    channelId,
    messageTs,
    userId,
    value
  ) {
  const data = JSON.parse(value);
  const request =
    getExtensionRequestFullDetails_(data.requestId);

  if (!request || request.status !== "Pending") {
    updateIzaMenu(
      channelId,
      messageTs,
      buildExtensionMessageBlocks_(
        "⏱️ *Request Extension*\n\nThis extension request is no longer pending."
      ),
      "Request Extension"
    );
    return;
  }

  updateExtensionRequestAfterCancel_(data.requestId);

  if (request.adminChannelId && request.adminMessageTs) {
    updateExtensionAdminMessageCanceled_(request);
  }

  handleExtensionStart_(channelId, messageTs, userId);
}

function getExtensionRequestFullDetails_(requestId) {
  const page =
    notionFetch_(
      `https://api.notion.com/v1/pages/${requestId}`,
      "get"
    );

  if (!page || !page.id) {
    return null;
  }

  const p = page.properties;

  return {
    id: page.id,
    status: getText_(p["Status"]) || "",
    contractorName:
      getText_(p["Contractor Name"]) ||
      getRelationDisplayName_(p["Contractor"]) ||
      "Contractor",
    projectName:
      getText_(p["Project Name"]) ||
      getRelationDisplayName_(p["Project"]) ||
      "Project",
    role:
      getText_(p["Role"]) || "Role",
    requestedHours:
      getNumber_(p["Requested Extra Hours"]),
    reason:
      getText_(p["Reason"]),
    adminChannelId:
      getText_(p["Admin Channel ID"]),
    adminMessageTs:
      getText_(p["Admin Message TS"])
  };
}

function updateExtensionRequestAfterCancel_(requestId) {
  return notionFetch_(
    `https://api.notion.com/v1/pages/${requestId}`,
    "patch",
    {
      properties: {
        "Status": {
          select: {
            name: "Canceled"
          }
        },
        "Reviewed Date": {
          date: {
            start: new Date().toISOString().slice(0, 10)
          }
        }
      }
    }
  );
}

function updateExtensionAdminMessageCanceled_(request) {
  updateIzaMenu(
    request.adminChannelId,
    request.adminMessageTs,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "⚪ *Extension Request Canceled*\n\n" +
            `*Contractor:* ${request.contractorName}\n` +
            `*Project:* ${request.projectName}\n` +
            `*Role:* ${request.role}\n` +
            `*Requested extra hours:* ${request.requestedHours}\n\n` +
            "The contractor canceled this request before review."
        }
      }
    ],
    "Extension Request Canceled"
  );
}

function getRelationDisplayName_(property) {
  const relation =
    property?.relation || [];

  if (!relation.length) {
    return "";
  }

  return "";
}
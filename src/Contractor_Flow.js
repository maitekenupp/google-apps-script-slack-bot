/******************************************************
 *
 * IZA
 * File: Contractor_Flow.gs
 *
 * Purpose:
 * Assigns contractors to project roles and manages public
 * role claim announcements.
 *
 ******************************************************/


/************************************
 * START CONTRACTOR FLOW
 ************************************/

function startContractorFlow_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  if (!session || !session.createdProject || !session.roleDrafts?.length) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildAdminProjectsMenuBlocks_(),
      "Admin Projects"
    );
    return;
  }

  session.status = "assigning_contractors";
  session.contractorStep = 0;
  session.contractorAssignments =
    session.roleDrafts.map(role => ({
      role: role.roleName,
      hours: role.hoursToContractor,
      deliverables: role.deliverables || "",
      contractorId: "",
      contractorName: "",
      rate: 0,
      total: 0,
      isAnnouncement: false
    }));

  saveProjectSession_(
    userId,
    session
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildContractorAssignmentBlocks_(session),
    "Assign Contractors"
  );
}


/************************************
 * ASSIGN CONTRACTOR STEP
 ************************************/

function buildContractorAssignmentBlocks_(session) {
  const assignments =
    session.contractorAssignments || [];

  const index =
    session.contractorStep || 0;

  const assignment =
    assignments[index] || {};

  const contractors =
    loadContractorOptions_();

  const selected =
    contractors.find(contractor =>
      contractor.id === assignment.contractorId
    );

  const contractorSelect = {
    type: "static_select",
    action_id: "contractor_select",
    placeholder: {
      type: "plain_text",
      text: "Select contractor",
      emoji: true
    },
    options:
      contractors.map(contractor => ({
        text: {
          type: "plain_text",
          text: contractor.label,
          emoji: true
        },
        value: contractor.id
      }))
  };

  if (selected) {
    contractorSelect.initial_option = {
      text: {
        type: "plain_text",
        text: selected.label,
        emoji: true
      },
      value: selected.id
    };
  }

  const buttons = [];

  if (index > 0) {
    buttons.push(
      button_("Previous", "contractor_previous")
    );
  }

  if (assignment.contractorId) {
    buttons.push(
      button_("Next", "contractor_next")
    );
  }

  buttons.push(
    dangerButton_("❌ Cancel", "contractor_cancel")
  );

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "👷 *Assign Contractors*\n\n" +
          `*Project:* ${getContractorProjectName_(session)}\n` +
          `*Role ${index + 1} of ${assignments.length}:* ${assignment.role || "-"}\n` +
          `*Hours:* ${assignment.hours || 0}\n` +
          `*Deliverables:* ${assignment.deliverables || "-"}\n\n` +
          `*Selected:* ${assignment.contractorName || "-"}`
      }
    },
    {
      type: "actions",
      elements: [
        contractorSelect
      ]
    },
    {
      type: "actions",
      elements: buttons
    }
  ];
}

function handleContractorSelect_(payload) {
  const context =
    getSlackActionContext_(payload);

  const selectedContractorId =
    payload.actions[0].selected_option.value;

  const session =
    getProjectSession_(context.userId);

  if (
    !session ||
    !session.contractorAssignments ||
    !Array.isArray(session.contractorAssignments) ||
    session.contractorAssignments.length === 0
  ) {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildAdminProjectsMenuBlocks_(),
      "Admin Projects"
    );
    return;
  }

  let index =
    Number(session.contractorStep);

  if (
    Number.isNaN(index) ||
    index < 0 ||
    index >= session.contractorAssignments.length
  ) {
    index = 0;
    session.contractorStep = 0;
  }

  const assignment =
    session.contractorAssignments[index];

  if (!assignment) {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildContractorAssignmentBlocks_(session),
      "Assign Contractors"
    );
    return;
  }

  const contractors =
    loadContractorOptions_();

  const contractor =
    contractors.find(item =>
      item.id === selectedContractorId
    );

  if (!contractor) {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildContractorAssignmentBlocks_(session),
      "Assign Contractors"
    );
    return;
  }

  const isAnnouncement =
    contractor.name === "x.Announce Role" ||
    contractor.label === "x.Announce Role";

  assignment.contractorId =
    contractor.id;

  assignment.contractorName =
    contractor.name || contractor.label;

  assignment.rate =
    isAnnouncement
      ? 0
      : Number(contractor.rate || 0);

  assignment.total =
    isAnnouncement
      ? 0
      : assignment.rate * Number(assignment.hours || 0);

  assignment.isAnnouncement =
    isAnnouncement;

  session.contractorAssignments[index] =
    assignment;

  session.lastActivity =
    Date.now();

  saveProjectSession_(
    context.userId,
    session
  );

  updateIzaMenu(
    context.channelId,
    context.messageTs,
    buildContractorAssignmentBlocks_(session),
    "Assign Contractors"
  );
}

function handleContractorPrevious_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  if (!session) {
    return;
  }

  session.contractorStep =
    Math.max(0, (session.contractorStep || 0) - 1);

  saveProjectSession_(
    userId,
    session
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildContractorAssignmentBlocks_(session),
    "Assign Contractors"
  );
}

function handleContractorNext_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  if (!session) {
    return;
  }

  const assignments =
    session.contractorAssignments || [];

  const index =
    session.contractorStep || 0;

  if (!assignments[index]?.contractorId) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildContractorAssignmentBlocks_(session),
      "Assign Contractors"
    );
    return;
  }

  if (index >= assignments.length - 1) {
    session.contractorStep = "review";

    saveProjectSession_(
      userId,
      session
    );

    updateIzaMenu(
      channelId,
      messageTs,
      buildContractorReviewBlocks_(session),
      "Review Contractor Assignments"
    );
    return;
  }

  session.contractorStep =
    index + 1;

  saveProjectSession_(
    userId,
    session
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildContractorAssignmentBlocks_(session),
    "Assign Contractors"
  );
}


/************************************
 * REVIEW ASSIGNMENTS
 ************************************/

function buildContractorReviewBlocks_(session) {
  const assignments =
    session.contractorAssignments || [];

  const lines =
    assignments
      .map((assignment, index) =>
        `${index + 1}. *${assignment.role}*\n` +
        `Contractor: ${assignment.contractorName}\n` +
        `Hours: ${assignment.hours}\n` +
        `Rate: $${assignment.rate}/hr\n` +
        `Total: $${Number(assignment.total || 0).toLocaleString()}`
      )
      .join("\n\n");

  const assignedCount =
    assignments.filter(assignment => !assignment.isAnnouncement).length;

  const announceCount =
    assignments.filter(assignment => assignment.isAnnouncement).length;

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "👷 *Review Contractor Assignments*\n\n" +
          `*Project:* ${getContractorProjectName_(session)}\n\n` +
          `${lines}\n\n` +
          `*Assigned:* ${assignedCount}\n` +
          `*Announced:* ${announceCount}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("Previous", "contractor_review_previous"),
        primaryButton_("✅ Create Assignments", "contractor_create_confirm"),
        dangerButton_("❌ Cancel", "contractor_cancel")
      ]
    }
  ];
}

function handleContractorReviewPrevious_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  if (!session) {
    return;
  }

  session.contractorStep =
    Math.max(
      0,
      (session.contractorAssignments || []).length - 1
    );

  saveProjectSession_(
    userId,
    session
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildContractorAssignmentBlocks_(session),
    "Assign Contractors"
  );
}


/************************************
 * CREATE ASSIGNMENTS
 ************************************/

function handleContractorCreateConfirm_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  if (!session || !session.contractorAssignments?.length) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildAdminProjectsMenuBlocks_(),
      "Admin Projects"
    );
    return;
  }

  if (
    session.status === "creating_contractor_assignments" ||
    session.status === "contractor_assignments_created"
  ) {
    return;
  }

  const projectId =
    session.createdProject.id;

  session.status =
    "creating_contractor_assignments";

  saveProjectSession_(
    userId,
    session
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildContractorCreatingBlocks_(session),
    "Creating Contractor Assignments"
  );

  try {
    const rolesToAnnounce = [];
    let assignedCount = 0;

    session.contractorAssignments.forEach(assignment => {
      if (assignment.isAnnouncement) {
        rolesToAnnounce.push(assignment);
        return;
      }

      createProjectContractorAssignment_({
        contractorName: assignment.contractorName,
        role: assignment.role,
        hours: assignment.hours,
        rate: assignment.rate,
        projectId
      });

      assignedCount++;
    });

    if (rolesToAnnounce.length > 0) {
      postContractorRoleAnnouncement_(session, rolesToAnnounce);
    }

    CacheService
      .getScriptCache()
      .remove(`PROJECT_ROLES_${projectId}`);

    CacheService
      .getScriptCache()
      .remove("PROJECTS_NEEDING_CONTRACTORS");

    session.status =
      "contractor_assignments_created";

    saveProjectSession_(
      userId,
      session
    );

    updateIzaMenu(
      channelId,
      messageTs,
      buildContractorAssignmentCompletedBlocks_(
        session,
        projectId,
        assignedCount,
        rolesToAnnounce.length
      ),
      "Contractors Assigned"
    );

  } catch (err) {
    session.status =
      "contractor_assignment_failed";

    session.lastError =
      err.message;

    saveProjectSession_(
      userId,
      session
    );

    updateIzaMenu(
      channelId,
      messageTs,
      buildContractorAssignmentFailedBlocks_(err),
      "Contractor Assignment Failed"
    );
  }
}

function buildContractorCreatingBlocks_(session) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "⏳ *Creating contractor assignments...*\n\n" +
          `*${getContractorProjectName_(session)}*`
      }
    }
  ];
}

function buildContractorAssignmentCompletedBlocks_(
    session,
    projectId,
    assignedCount,
    announcedCount
  ) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🎉 *Contractor assignment completed!*\n\n" +
          `*Project:* ${getContractorProjectName_(session)}\n` +
          `*Assigned:* ${assignedCount}\n` +
          `*Announced:* ${announcedCount}`
      }
    },
    {
      type: "actions",
      elements: buildContractorAssignmentSuccessButtons_(
        projectId,
        assignedCount > 0
      )
    }
  ];
}

function buildContractorAssignmentFailedBlocks_(err) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "❌ *I had trouble assigning contractors.*\n\n" +
          `Error: ${err.message}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "admin_projects_menu"),
        button_("🏠 Main Menu", "menu_main")
      ]
    }
  ];
}

function buildContractorAssignmentSuccessButtons_(projectId, canGenerateSows) {
  if (canGenerateSows) {
    return [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "🖨️ Generate SOWs",
          emoji: true
        },
        action_id: "sow_generate_for_project",
        value: projectId
      }
    ];
  }

  return [
    button_("⬅️ Back", "admin_projects_menu"),
    button_("👋 Bye IZA", "menu_close")
  ];
}


/************************************
 * ROLE ANNOUNCEMENT
 ************************************/

function postContractorRoleAnnouncement_(session, rolesToAnnounce) {
  const project = {
    id: session.createdProject.id,
    name: getContractorProjectName_(session),
    description: session.answers?.["Short Description"] || "",
    startDate: session.answers?.["Project Dates"]?.startDate || "",
    endDate: session.answers?.["Project Dates"]?.endDate || ""
  };

  const existingAnnouncement =
    findOpenAnnouncementForProject_(project.id);

  if (existingAnnouncement) {
    postDuplicateRoleAnnouncementWarning_(project);
    return;
  }

  const announcementKey =
    `ROLE_CLAIM_${project.id}_${Date.now()}`;

  PropertiesService
    .getScriptProperties()
    .setProperty(
      announcementKey,
      JSON.stringify({
        project,
        roles: rolesToAnnounce,
        claims: [],
        claimNotifications: [],
        closed: false
      })
    );

  postSlackMessage_(
    CONTRACTOR_OPPORTUNITIES_CHANNEL,
    buildRoleAnnouncementBlocks_(announcementKey, project, rolesToAnnounce),
    "New Project Opportunity"
  );
}

function postDuplicateRoleAnnouncementWarning_(project) {
  postSlackMessage_(
    CONTRACTOR_OPPORTUNITIES_CHANNEL,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "⚠️ *Project already announced*\n\n" +
            `*Project:* ${project.name}\n\n` +
            "This project already has an open role announcement. Please use the existing announcement instead of reposting."
        }
      }
    ],
    "Project already announced"
  );
}

function buildRoleAnnouncementBlocks_(announcementKey, project, rolesToAnnounce) {
  const roleLines =
    rolesToAnnounce
      .map(role =>
        `*${role.role}* — ${role.hours} hrs\n` +
        `${role.deliverables || "-"}`
      )
      .join("\n\n");

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          ":rotating_light: *New Project Opportunity* :rotating_light:\n\n" +
          `*Project:* ${project.name}\n` +
          `*Objective:* ${project.description || "-"}\n` +
          `*Start date:* ${project.startDate || "-"}\n` +
          `*End date:* ${project.endDate || "-"}\n\n` +
          "*Available Roles:*\n\n" +
          roleLines +
          "\n\n" +
          ":warning: *Before claiming:*\n" +
          "• Please check your availability.\n" +
          "• IZA will review capacity before confirming assignments."
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🙋 Claim a Role",
            emoji: true
          },
          action_id: "project_role_claim_start",
          value: announcementKey
        }
      ]
    }
  ];
}


/************************************
 * PUBLIC CLAIM FLOW
 ************************************/

function openProjectRoleClaimModal_(
    userId,
    channelId,
    messageTs,
    triggerId,
    announcementKey
  ) {
  const raw =
    PropertiesService
      .getScriptProperties()
      .getProperty(announcementKey);

  if (!raw) {
    sendEphemeralMessage(
      channelId,
      userId,
      "This role announcement expired. Please ask IZA to repost it."
    );
    return;
  }

  const data =
    JSON.parse(raw);

  if (data.closed || data.closedAt) {
    sendEphemeralMessage(
      channelId,
      userId,
      "This role announcement is now closed."
    );
    return;
  }

  const roles =
    (data.roles || [])
      .map((role, index) => ({
        ...role,
        originalIndex: index
      }))
      .filter(role => !role.assignedTo);

  if (!roles.length) {
    sendEphemeralMessage(
      channelId,
      userId,
      "All roles in this announcement have already been assigned."
    );
    return;
  }

  callSlackApi_(
    "chat.postEphemeral",
    {
      channel: channelId,
      user: userId,
      text: "Claim a role",
      blocks: buildRoleClaimEphemeralBlocks_(announcementKey, roles)
    }
  );
}

function buildRoleClaimEphemeralBlocks_(announcementKey, roles) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🙋 *Claim Role(s)*\n\n" +
          "Select the role(s) you want to claim, then click *Submit Claim*."
      }
    },
    {
      type: "actions",
      block_id: "role_claim_checkbox_block",
      elements: [
        {
          type: "checkboxes",
          action_id: "role_claim_checkbox_select",
          options:
            roles.map(role => ({
              text: {
                type: "mrkdwn",
                text: `*${role.role}* — ${role.hours} hrs`
              },
              value: String(role.originalIndex)
            }))
        }
      ]
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Submit Claim",
            emoji: true
          },
          action_id: "project_role_claim_submit_ephemeral",
          value: announcementKey
        }
      ]
    }
  ];
}

function handleProjectRoleClaimEphemeralSubmit_(payload) {
  const context =
    getSlackActionContext_(payload);

  const announcementKey =
    context.actionValue;

  const raw =
    PropertiesService
      .getScriptProperties()
      .getProperty(announcementKey);

  if (!raw) {
    deleteOriginalInteractiveMessage_(payload.response_url);

    sendEphemeralMessage(
      context.channelId,
      context.userId,
      "This role announcement expired. Please ask IZA to repost it."
    );
    return;
  }

  const data =
    JSON.parse(raw);

  if (data.closed || data.closedAt) {
    deleteOriginalInteractiveMessage_(payload.response_url);

    sendEphemeralMessage(
      context.channelId,
      context.userId,
      "This role announcement is now closed."
    );
    return;
  }

  const selectedOptions =
    getSelectedRoleClaimOptions_(payload);

  if (!selectedOptions.length) {
    sendEphemeralMessage(
      context.channelId,
      context.userId,
      "Please select at least one role to claim."
    );
    return;
  }

  const result =
    recordRoleClaims_(
      data,
      context.userId,
      selectedOptions
    );

  PropertiesService
    .getScriptProperties()
    .setProperty(
      announcementKey,
      JSON.stringify(data)
    );

  deleteOriginalInteractiveMessage_(
    payload.response_url
  );

  if (result.claimedRoles.length) {
    postRoleClaimNotification_(
      data,
      context.userId,
      result.claimedRoles
    );
  }

  sendEphemeralMessage(
    context.channelId,
    context.userId,
    buildRoleClaimResultMessage_(result)
  );
}

function getSelectedRoleClaimOptions_(payload) {
  let selectedOptions = [];

  Object.keys(payload.state.values).forEach(blockId => {
    const block =
      payload.state.values[blockId];

    Object.keys(block).forEach(actionId => {
      if (actionId === "role_claim_checkbox_select") {
        selectedOptions =
          block[actionId].selected_options || [];
      }
    });
  });

  return selectedOptions;
}

function recordRoleClaims_(data, userId, selectedOptions) {
  const roles =
    data.roles || [];

  const claims =
    data.claims || [];

  const claimedRoles = [];
  const duplicateRoles = [];
  const unavailableRoles = [];

  selectedOptions.forEach(option => {
    const selectedRole =
      roles[Number(option.value)];

    if (!selectedRole) {
      return;
    }

    if (selectedRole.assignedTo) {
      unavailableRoles.push(selectedRole.role);
      return;
    }

    const alreadyClaimed =
      claims.some(claim =>
        claim.userId === userId &&
        claim.role === selectedRole.role
      );

    if (alreadyClaimed) {
      duplicateRoles.push(selectedRole.role);
      return;
    }

    claims.push({
      userId,
      role: selectedRole.role,
      hours: selectedRole.hours,
      claimedAt: new Date().toISOString()
    });

    claimedRoles.push(selectedRole.role);
  });

  data.claims = claims;

  return {
    claimedRoles,
    duplicateRoles,
    unavailableRoles
  };
}

function buildRoleClaimResultMessage_(result) {
  const messageParts = [];

  if (result.claimedRoles.length) {
    messageParts.push(
      `Recorded claim(s): ${result.claimedRoles.map(role => `*${role}*`).join(", ")}.`
    );
  }

  if (result.duplicateRoles.length) {
    messageParts.push(
      `Already claimed: ${result.duplicateRoles.map(role => `*${role}*`).join(", ")}.`
    );
  }

  if (result.unavailableRoles.length) {
    messageParts.push(
      `Already assigned: ${result.unavailableRoles.map(role => `*${role}*`).join(", ")}.`
    );
  }

  return messageParts.join("\n");
}


/************************************
 * CLAIM NOTIFICATIONS
 ************************************/

function postRoleClaimNotification_(announcement, userId, claimedRoles) {
  const announcementKey =
    getAnnouncementKeyFromData_(announcement);

  const result =
    postSlackMessage_(
      CONTRACTOR_CLAIMS_CHANNEL,
      buildClaimNotificationBlocks_(
        announcementKey,
        userId,
        claimedRoles,
        false
      ),
      "Role claim received"
    );

  saveClaimNotificationMessage_(
    announcementKey,
    userId,
    result.channel,
    result.ts
  );
}

function buildClaimNotificationBlocks_(announcementKey, userId, claimedRoles, closed) {
  const item =
    getRoleClaimAnnouncement_(announcementKey);

  const contractor =
    findContractorBySlackId_(userId);

  const projectName =
    item?.project?.name ||
    "Unknown Project";

  const claimantName =
    contractor?.name ||
    `<@${userId}>`;

  const statusLines =
    buildClaimStatusLines_(
      item,
      userId,
      claimedRoles
    );

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🙋 *Role claim received*\n\n" +
          `*Project:* ${projectName}\n` +
          `*Claimant:* ${claimantName}\n` +
          `*Role(s):* ${sortRoleNamesByRoleSort_(claimedRoles).map(role => `*${role}*`).join(", ")}\n\n` +
          statusLines
      }
    }
  ];

  if (!closed) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Review Claim",
            emoji: true
          },
          action_id: "claims_view_single_claim",
          value: JSON.stringify({
            announcementKey,
            userId
          })
        }
      ]
    });
  }

  return blocks;
}

function buildClaimStatusLines_(item, userId, claimedRoles) {
  if (!item) {
    return "*Status:* 🟡 Open";
  }

  const sortedClaimedRoles =
    sortRoleNamesByRoleSort_(claimedRoles);

  const lines =
    sortedClaimedRoles.map(roleName => {
      const role =
        item.roles.find(itemRole =>
          itemRole.role === roleName
        );

      if (!role) {
        return `• 🔴 *${roleName}:* Not available`;
      }

      if (!role.assignedTo) {
        return `• 🟡 *${roleName}:* Open`;
      }

      if (role.assignedTo.userId === userId) {
        return `• 🟢 *${roleName}:* Assigned to this claimant`;
      }

      return `• 🔴 *${roleName}:* Assigned to someone else`;
    });

  const allClosed =
    lines.every(line =>
      !line.includes("🟡")
    );

  return (
    "*Status:*\n" +
    lines.join("\n") +
    (allClosed ? "\n\n_Claim closed._" : "")
  );
}

function saveClaimNotificationMessage_(announcementKey, userId, channelId, messageTs) {
  const raw =
    PropertiesService
      .getScriptProperties()
      .getProperty(announcementKey);

  if (!raw) {
    return;
  }

  const data =
    JSON.parse(raw);

  data.claimNotifications =
    data.claimNotifications || [];

  const existing =
    data.claimNotifications.find(item =>
      item.userId === userId
    );

  const claimedRoles =
    (data.claims || [])
      .filter(claim =>
        claim.userId === userId
      )
      .map(claim =>
        claim.role
      );

  if (existing) {
    existing.channelId = channelId;
    existing.messageTs = messageTs;
    existing.claimedRoles = claimedRoles;
  } else {
    data.claimNotifications.push({
      userId,
      channelId,
      messageTs,
      claimedRoles
    });
  }

  PropertiesService
    .getScriptProperties()
    .setProperty(
      announcementKey,
      JSON.stringify(data)
    );
}


/************************************
 * LEGACY MODAL CLAIM SUBMIT
 ************************************/

function handleProjectRoleClaimSubmit_(payload) {
  const metadata =
    JSON.parse(payload.view.private_metadata);

  const values =
    payload.view.state.values;

  const raw =
    PropertiesService
      .getScriptProperties()
      .getProperty(metadata.announcementKey);

  if (!raw) {
    return {
      response_action: "clear"
    };
  }

  const data =
    JSON.parse(raw);

  const selectedIndex =
    Number(
      values.roles_claim_block.roles_claim_value.selected_option.value
    );

  const selectedRole =
    data.roles[selectedIndex];

  data.claims =
    data.claims || [];

  const alreadyClaimed =
    data.claims.some(claim =>
      claim.userId === metadata.userId &&
      claim.role === selectedRole.role
    );

  if (alreadyClaimed) {
    sendEphemeralMessage(
      metadata.channelId,
      metadata.userId,
      `You already claimed *${selectedRole.role}*.`
    );

    return {
      response_action: "clear"
    };
  }

  data.claims.push({
    userId: metadata.userId,
    role: selectedRole.role,
    hours: selectedRole.hours,
    note: values.claim_note_block.claim_note_value.value || "",
    claimedAt: new Date().toISOString()
  });

  PropertiesService
    .getScriptProperties()
    .setProperty(
      metadata.announcementKey,
      JSON.stringify(data)
    );

  sendEphemeralMessage(
    metadata.channelId,
    metadata.userId,
    `Thanks! Your claim for *${selectedRole.role}* was recorded.`
  );

  return {
    response_action: "clear"
  };
}


/************************************
 * ANNOUNCEMENT HELPERS
 ************************************/

function findOpenAnnouncementForProject_(projectId) {
  const props =
    PropertiesService.getScriptProperties();

  const all =
    props.getProperties();

  const matchKey =
    Object.keys(all).find(key => {
      if (!key.startsWith("ROLE_CLAIM_")) {
        return false;
      }

      const data =
        JSON.parse(all[key]);

      return (
        data.project?.id === projectId &&
        !data.closed &&
        !data.closedAt
      );
    });

  if (!matchKey) {
    return null;
  }

  return {
    key: matchKey,
    data: JSON.parse(all[matchKey])
  };
}

function areAllAnnouncementRolesAssigned_(announcement) {
  const roles =
    announcement.roles || [];

  return (
    roles.length > 0 &&
    roles.every(role => role.assignedTo)
  );
}

function closeAnnouncementIfComplete_(announcementKey) {
  const item =
    getRoleClaimAnnouncement_(announcementKey);

  if (!item || item.closedAt) {
    return false;
  }

  const allAssigned =
    (item.roles || []).every(role =>
      role.assignedTo
    );

  if (!allAssigned) {
    return false;
  }

  item.closedAt =
    new Date().toISOString();

  PropertiesService
    .getScriptProperties()
    .setProperty(
      announcementKey,
      JSON.stringify(item)
    );

  refreshClaimNotificationMessages_(announcementKey);

  return true;
}

function getAnnouncementKeyFromData_(announcement) {
  const props =
    PropertiesService.getScriptProperties();

  const all =
    props.getProperties();

  const projectId =
    announcement.project?.id;

  const match =
    Object.keys(all).find(key => {
      if (!key.startsWith("ROLE_CLAIM_")) {
        return false;
      }

      const data =
        JSON.parse(all[key]);

      return data.project?.id === projectId;
    });

  return match || "";
}


/************************************
 * CANCEL + UTILITIES
 ************************************/

function handleContractorCancel_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  if (session) {
    delete session.contractorAssignments;
    delete session.contractorStep;

    session.status = "roles_created";

    saveProjectSession_(
      userId,
      session
    );
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildAdminProjectsMenuBlocks_(),
    "Admin Projects"
  );
}

function getContractorProjectName_(session) {
  return (
    session?.createdProject?.name ||
    session?.answers?.["Project Name"] ||
    "Project"
  );
}

function deleteOriginalInteractiveMessage_(responseUrl) {
  if (!responseUrl) {
    return;
  }

  UrlFetchApp.fetch(
    responseUrl,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        delete_original: true
      }),
      muteHttpExceptions: true
    }
  );
}

function sortRoleNamesByRoleSort_(roleNames) {
  const roleOptions =
    loadNotionRoleOptions_();

  const sortByRoleName = {};

  roleOptions.forEach(role => {
    sortByRoleName[role.label] =
      role.sortOrder || 9999;
  });

  return (roleNames || [])
    .slice()
    .sort((a, b) => {
      const aSort =
        sortByRoleName[a] || 9999;

      const bSort =
        sortByRoleName[b] || 9999;

      if (aSort !== bSort) {
        return aSort - bSort;
      }

      return String(a || "")
        .localeCompare(String(b || ""));
    });
}
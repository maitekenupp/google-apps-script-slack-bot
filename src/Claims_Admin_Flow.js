/******************************************************
 *
 * IZA
 * File: Claims_Admin_Flow.gs
 *
 * Purpose:
 * Admin workflow for reviewing contractor role claims,
 * assigning claimed roles, closing announcements, and
 * notifying claimants.
 *
 ******************************************************/

/************************************
 * CLAIMS ADMIN MENU
 ************************************/

function showClaimsAdminMenu_(channelId, messageTs) {
  const announcements = loadRoleClaimAnnouncements_();

  updateIzaMenu(
    channelId,
    messageTs,
    buildClaimsProjectListBlocks_(announcements),
    "Role Claims"
  );
}

function loadRoleClaimAnnouncements_() {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();

  return Object.keys(all)
    .filter(key => key.startsWith("ROLE_CLAIM_"))
    .map(key => {
      try {
        const data = JSON.parse(all[key]);

        return {
          key,
          project: data.project || {},
          roles: data.roles || [],
          claims: data.claims || [],
          claimNotifications: data.claimNotifications || [],
          closed: data.closed || false,
          closedAt: data.closedAt || ""
        };
      } catch (err) {
        Logger.log(`Could not read claim announcement ${key}: ${err.message}`);
        return null;
      }
    })
    .filter(item => item && !item.closed)
    .sort((a, b) =>
      String(a.project?.name || "").localeCompare(String(b.project?.name || ""))
    );
}

function buildClaimsProjectListBlocks_(announcements) {
  if (!announcements.length) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "📌 *Role Claims*\n\nNo open role announcements found."
        }
      },
      {
        type: "actions",
        elements: [
          button_("⬅️ Back", "admin_contractors_menu")
        ]
      }
    ];
  }

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "📌 *Role Claims*\n\n" +
          "Select a project to review open role claims."
      }
    }
  ];

  announcements.forEach(item => {
    const claimCount = item.claims.length;
    const roleCount = item.roles.length;
    const assignedCount = item.roles.filter(role => role.assignedTo).length;
    const openCount = item.roles.filter(role => !role.assignedTo).length;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${item.project?.name || "Untitled Project"}*\n` +
          `Open: ${openCount} | Assigned: ${assignedCount} | Roles: ${roleCount} | Claims: ${claimCount}`
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "View Claims",
          emoji: true
        },
        action_id: "claims_view_project",
        value: item.key
      }
    });
  });

  blocks.push({
    type: "actions",
    elements: [
      button_("⬅️ Back", "admin_contractors_menu")
    ]
  });

  return blocks;
}


/************************************
 * PROJECT CLAIM VIEW
 ************************************/

function buildClaimsRoleListBlocks_(announcementKey) {
  const item = getRoleClaimAnnouncement_(announcementKey);

  if (!item || item.closed) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "📌 *Role Claims*\n\n" +
            "This announcement is closed or no longer available."
        }
      },
      {
        type: "actions",
        elements: [
          button_("⬅️ Back", "claims_admin_menu")
        ]
      }
    ];
  }

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "📌 *Role Claims*\n\n" +
          `*Project:* ${item.project?.name || "-"}\n\n` +
          "Review announced roles."
      }
    }
  ];

  sortAnnouncementRolesByRoleSort_(item.roles).forEach(role => {
    const roleIndex = item.roles.findIndex(itemRole =>
      itemRole.role === role.role
    );

    const claimsForRole = item.claims.filter(claim =>
      claim.role === role.role
    );

    const assignedText = role.assignedTo
      ? `\n🟢 *Assigned to:* ${role.assignedTo.contractorName || `<@${role.assignedTo.userId}>`}`
      : "\n🟡 *Status:* Open";

    const section = {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${role.role}*\n` +
          `Hours: ${role.hours}\n` +
          `Claims: ${claimsForRole.length}` +
          assignedText
      }
    };

    if (!role.assignedTo && claimsForRole.length > 0) {
      section.accessory = {
        type: "button",
        text: {
          type: "plain_text",
          text: "View People",
          emoji: true
        },
        action_id: "claims_view_role",
        value: JSON.stringify({
          announcementKey,
          roleIndex
        })
      };
    }

    blocks.push(section);
  });

  blocks.push({
    type: "actions",
    elements: [
      button_("⬅️ Back", "claims_admin_menu"),
      dangerButton_("Close Announcement", "claims_close_announcement", announcementKey)
    ]
  });

  return blocks;
}

function handleClaimsViewProject_(channelId, messageTs, announcementKey) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildClaimsRoleListBlocks_(announcementKey),
    "Role Claims"
  );
}


/************************************
 * ROLE CLAIMANTS VIEW
 ************************************/

function buildClaimsClaimantBlocks_(announcementKey, roleIndex) {
  const item = getRoleClaimAnnouncement_(announcementKey);

  if (!item || item.closed) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "This role announcement is closed or no longer available."
        }
      },
      {
        type: "actions",
        elements: [
          button_("⬅️ Back", "claims_admin_menu")
        ]
      }
    ];
  }

  const role = item.roles[roleIndex];

  if (!role) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "This role was not found."
        }
      },
      {
        type: "actions",
        elements: [
          button_("⬅️ Back", "claims_admin_menu")
        ]
      }
    ];
  }

  if (role.assignedTo) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "✅ *Role already assigned*\n\n" +
            `*Project:* ${item.project?.name || "-"}\n` +
            `*Role:* ${role.role}\n` +
            `*Assigned to:* ${role.assignedTo.contractorName || `<@${role.assignedTo.userId}>`}`
        }
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "⬅️ Back",
              emoji: true
            },
            action_id: "claims_view_project",
            value: announcementKey
          }
        ]
      }
    ];
  }

  const claims = item.claims.filter(claim =>
    claim.role === role.role
  );

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "📌 *Assign Claimed Role*\n\n" +
          `*Project:* ${item.project?.name || "-"}\n` +
          `*Role:* ${role.role}\n` +
          `*Hours:* ${role.hours}\n\n` +
          `Claimants: ${claims.length}`
      }
    }
  ];

  if (!claims.length) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "No one has claimed this role yet."
      }
    });
  }

  claims.forEach(claim => {
    const contractor = findContractorBySlackId_(claim.userId);
    const label = contractor?.name || `<@${claim.userId}>`;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${label}*\n` +
          `Slack: <@${claim.userId}>\n` +
          `Claimed: ${formatClaimDate_(claim.claimedAt)}`
      },
      accessory: {
        type: "button",
        style: "primary",
        text: {
          type: "plain_text",
          text: "Assign",
          emoji: true
        },
        action_id: "claims_assign_person",
        value: JSON.stringify({
          announcementKey,
          roleIndex,
          userId: claim.userId
        })
      }
    });
  });

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "⬅️ Back",
          emoji: true
        },
        action_id: "claims_view_project",
        value: announcementKey
      }
    ]
  });

  return blocks;
}

function handleClaimsViewRole_(channelId, messageTs, value) {
  const data = JSON.parse(value);

  updateIzaMenu(
    channelId,
    messageTs,
    buildClaimsClaimantBlocks_(
      data.announcementKey,
      Number(data.roleIndex)
    ),
    "Role Claimants"
  );
}


/************************************
 * SINGLE CLAIM VIEW
 ************************************/

function buildSingleClaimBlocks_(announcementKey, userId) {
  const item = getRoleClaimAnnouncement_(announcementKey);

  if (!item) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "This role announcement was not found."
        }
      }
    ];
  }

  const contractor = findContractorBySlackId_(userId);
  const claimantName = contractor?.name || `<@${userId}>`;

  const claims = (item.claims || []).filter(claim =>
    claim.userId === userId
  );

  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🙋 *Review Claim*\n\n" +
          `*Project:* ${item.project?.name || "-"}\n` +
          `*Claimant:* ${claimantName}\n` +
          `*Slack:* <@${userId}>\n\n` +
          "Review this person's claimed role(s)."
      }
    }
  ];

  if (!claims.length) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "This person has no recorded claims for this announcement."
      }
    });

    blocks.push(buildBackToSingleClaimButtonBlock_(announcementKey, userId));
    return blocks;
  }

  const sortedClaims = sortClaimsByRoleSort_(claims);

  sortedClaims.forEach((claim, index) => {
    const roleIndex = item.roles.findIndex(role =>
      role.role === claim.role
    );

    const role = item.roles[roleIndex];

    if (!role) return;

    const section = {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${role.role}*\n` +
          `Hours: ${role.hours}\n` +
          `Claimed: ${formatClaimDate_(claim.claimedAt)}\n` +
          getSingleClaimRoleStatusText_(role, userId)
      }
    };

    if (!role.assignedTo) {
      section.accessory = {
        type: "button",
        style: "primary",
        text: {
          type: "plain_text",
          text: "Assign",
          emoji: true
        },
        action_id: "claims_assign_person",
        value: JSON.stringify({
          announcementKey,
          roleIndex,
          userId,
          returnTo: "single_claim"
        })
      };
    }

    blocks.push(section);

    if (index < sortedClaims.length - 1) {
      blocks.push({ type: "divider" });
    }
  });

  blocks.push(buildBackToSingleClaimButtonBlock_(announcementKey, userId));

  return blocks;
}

function buildBackToSingleClaimButtonBlock_(announcementKey, userId) {
  return {
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "⬅️ Back to Claim Message",
          emoji: true
        },
        action_id: "claims_back_to_single_claim_message",
        value: JSON.stringify({
          announcementKey,
          userId
        })
      }
    ]
  };
}

function handleClaimsViewSingleClaim_(channelId, messageTs, value) {
  const data = JSON.parse(value);

  updateIzaMenu(
    channelId,
    messageTs,
    buildSingleClaimBlocks_(
      data.announcementKey,
      data.userId
    ),
    "Review Claim"
  );
}

function handleClaimsBackToSingleClaimMessage_(channelId, messageTs, value) {
  const data = JSON.parse(value);

  updateIzaMenu(
    channelId,
    messageTs,
    buildSingleClaimNotificationReturnBlocks_(
      data.announcementKey,
      data.userId
    ),
    "Role claim received"
  );
}


/************************************
 * ASSIGN CLAIMED ROLE
 ************************************/

function handleClaimsAssignPerson_(channelId, messageTs, value) {
  const data = JSON.parse(value);
  const item = getRoleClaimAnnouncement_(data.announcementKey);

  if (!item) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildComingSoonBlocks_("Claim not found", "claims_admin_menu"),
      "Claim not found"
    );
    return;
  }

  const roleIndex = Number(data.roleIndex);
  const role = item.roles[roleIndex];
  const contractor = findContractorBySlackId_(data.userId);

  if (!role) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildComingSoonBlocks_("Role not found", "claims_admin_menu"),
      "Role not found"
    );
    return;
  }

  if (role.assignedTo) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildClaimsRoleListBlocks_(data.announcementKey),
      "Role Already Assigned"
    );
    return;
  }

  if (!contractor) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildContractorNotFoundBlocks_(data, roleIndex),
      "Contractor Not Found"
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
            "⏳ *Assigning contractor...*\n\n" +
            `*Project:* ${item.project?.name || "-"}\n` +
            `*Role:* ${role.role}\n` +
            `*Contractor:* ${contractor.name}`
        }
      }
    ],
    "Assigning Contractor"
  );

  createProjectContractorAssignment_({
    contractorName: contractor.name,
    role: role.role,
    hours: role.hours,
    rate: contractor.rate,
    projectId: item.project.id
  });

  const stored = markClaimRoleAssigned_(
    data.announcementKey,
    roleIndex,
    data.userId,
    contractor.name
  );

  clearClaimRelatedCaches_(item.project.id);

  refreshClaimNotificationMessages_(data.announcementKey);

  const announcementClosed =
    closeAnnouncementIfComplete_(data.announcementKey);

  refreshClaimNotificationMessages_(data.announcementKey);

  if (announcementClosed) {
    const closedAnnouncement =
      getRoleClaimAnnouncement_(data.announcementKey);

    postSowReadyAfterClaimClose_(closedAnnouncement);
  }

  notifySelectedContractor_(
    stored,
    role,
    data.userId,
    contractor.name
  );

  notifyUnselectedClaimants_(
    stored,
    role.role,
    data.userId,
    contractor.name
  );

  if (data.returnTo === "single_claim") {
    updateIzaMenu(
      channelId,
      messageTs,
      buildSingleClaimNotificationReturnBlocks_(
        data.announcementKey,
        data.userId
      ),
      "Role claim received"
    );
    return;
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildClaimsRoleListBlocks_(data.announcementKey),
    "Contractor Assigned"
  );
}

function buildContractorNotFoundBlocks_(data, roleIndex) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "❌ *Could not assign contractor.*\n\n" +
          `No Team Directory record found for Slack user <@${data.userId}>.`
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "⬅️ Back",
            emoji: true
          },
          action_id: data.returnTo === "single_claim"
            ? "claims_view_single_claim"
            : "claims_view_role",
          value: data.returnTo === "single_claim"
            ? JSON.stringify({
                announcementKey: data.announcementKey,
                userId: data.userId
              })
            : JSON.stringify({
                announcementKey: data.announcementKey,
                roleIndex
              })
        }
      ]
    }
  ];
}

function markClaimRoleAssigned_(announcementKey, roleIndex, userId, contractorName) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(announcementKey);

  const stored = JSON.parse(raw);

  stored.roles[roleIndex].assignedTo = {
    userId,
    contractorName,
    assignedAt: new Date().toISOString()
  };

  PropertiesService.getScriptProperties().setProperty(
    announcementKey,
    JSON.stringify(stored)
  );

  return stored;
}

function clearClaimRelatedCaches_(projectId) {
  CacheService
    .getScriptCache()
    .remove(`PROJECT_ROLES_${projectId}`);

  CacheService
    .getScriptCache()
    .remove("PROJECTS_NEEDING_CONTRACTORS");
}


/************************************
 * CLOSE ANNOUNCEMENT
 ************************************/

function handleClaimsCloseAnnouncement_(channelId, messageTs, announcementKey) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(announcementKey);

  if (!raw) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildComingSoonBlocks_("Announcement not found", "claims_admin_menu"),
      "Announcement not found"
    );
    return;
  }

  const data = JSON.parse(raw);
  data.closed = true;
  data.closedAt = new Date().toISOString();

  PropertiesService.getScriptProperties().setProperty(
    announcementKey,
    JSON.stringify(data)
  );

  refreshClaimNotificationMessages_(announcementKey);

  if (hasAssignedRolesForSowPrompt_(data)) {
    postSowReadyAfterClaimClose_({
      key: announcementKey,
      project: data.project,
      roles: data.roles || [],
      claims: data.claims || [],
      claimNotifications: data.claimNotifications || [],
      closed: true,
      closedAt: data.closedAt
    });
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
            "✅ *Announcement closed.*\n\n" +
            `*Project:* ${data.project?.name || "-"}\n\n` +
            "Users will no longer be able to claim roles from this announcement."
        }
      },
      {
        type: "actions",
        elements: [
          button_("⬅️ Back", "claims_admin_menu")
        ]
      }
    ],
    "Announcement Closed"
  );
}

function hasAssignedRolesForSowPrompt_(announcement) {
  return (announcement.roles || []).some(role =>
    role.assignedTo
  );
}

function postSowReadyAfterClaimClose_(announcement) {
  const projectId = announcement?.project?.id || "";
  const projectName = announcement?.project?.name || "this project";

  if (!projectId) {
    return;
  }

  const assignedRoles = (announcement.roles || []).filter(role =>
    role.assignedTo
  );

  if (!assignedRoles.length) {
    return;
  }

  postSlackMessage_(
    CONTRACTOR_CLAIMS_CHANNEL,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "🖨️ *SOWs Ready to Generate*\n\n" +
            `The role announcement for *${projectName}* is now closed.\n\n` +
            "Please generate SOWs for the assigned contractors."
        }
      },
      {
        type: "actions",
        elements: [
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
        ]
      }
    ],
    "SOWs Ready to Generate"
  );
}


/************************************
 * ANNOUNCEMENT DATA
 ************************************/

function getRoleClaimAnnouncement_(announcementKey) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(announcementKey);

  if (!raw) return null;

  const data = JSON.parse(raw);

  return {
    key: announcementKey,
    project: data.project || {},
    roles: data.roles || [],
    claims: data.claims || [],
    claimNotifications: data.claimNotifications || [],
    closed: data.closed || false,
    closedAt: data.closedAt || ""
  };
}

function findContractorBySlackId_(slackId) {
  const contractors = loadTeamDirectoryUsers_();

  return contractors.find(contractor =>
    contractor.slackId === slackId
  );
}


/************************************
 * CLAIM NOTIFICATION MESSAGES
 ************************************/

function buildSingleClaimNotificationReturnBlocks_(announcementKey, userId) {
  const item = getRoleClaimAnnouncement_(announcementKey);

  if (!item) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "This claim announcement was not found."
        }
      }
    ];
  }

  const notification =
    getClaimNotificationForUser_(announcementKey, userId);

  const claimedRoles =
    notification?.claimedRoles ||
    (item.claims || [])
      .filter(claim => claim.userId === userId)
      .map(claim => claim.role);

  const allClosed = claimedRoles.every(roleName => {
    const role = item.roles.find(itemRole => itemRole.role === roleName);
    return !role || role.assignedTo || item.closed;
  });

  return buildClaimNotificationBlocks_(
    announcementKey,
    userId,
    claimedRoles,
    allClosed
  );
}

function getClaimNotificationForUser_(announcementKey, userId) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(announcementKey);

  if (!raw) return null;

  const data = JSON.parse(raw);

  return (data.claimNotifications || []).find(item =>
    item.userId === userId
  ) || null;
}

function refreshClaimNotificationMessages_(announcementKey) {
  const data = getRoleClaimAnnouncement_(announcementKey);

  if (!data) return;

  const notifications = data.claimNotifications || [];

  notifications.forEach(notification => {
    const claimedRoles = notification.claimedRoles || [];

    const allClosed = claimedRoles.every(roleName => {
      const role = data.roles.find(itemRole => itemRole.role === roleName);
      return !role || role.assignedTo || data.closed;
    });

    try {
      updateIzaMenu(
        notification.channelId,
        notification.messageTs,
        buildClaimNotificationBlocks_(
          announcementKey,
          notification.userId,
          claimedRoles,
          allClosed
        ),
        "Role claim updated"
      );
    } catch (err) {
      Logger.log(
        `Could not update claim notification ${notification.messageTs}: ${err.message}`
      );
    }
  });
}


/************************************
 * CONTRACTOR NOTIFICATIONS
 ************************************/

function notifySelectedContractor_(announcement, role, selectedUserId, contractorName) {
  const project = announcement.project || {};
  const projectName = project.name || "the project";

  try {
    const dmChannelId = openSlackDm(selectedUserId);

    sendSlackMessage(
      dmChannelId,
      [
        `Hi <@${selectedUserId}> 👋`,
        "",
        `Good news — you've been assigned to *${role.role}* for *${projectName}*.`,
        "",
        `*Hours:* ${role.hours}`,
        `*Deliverables:* ${role.deliverables || "-"}`,
        `*Start date:* ${formatProjectDateForClaimDm_(project.startDate)}`,
        `*End date:* ${formatProjectDateForClaimDm_(project.endDate)}`,
        "",
        "You'll receive the SOW file shortly.",
        "",
        "Thanks for claiming this opportunity."
      ].join("\n")
    );

  } catch (err) {
    Logger.log(
      `Could not notify selected contractor ${contractorName}: ${err.message}`
    );
  }
}

function notifyUnselectedClaimants_(announcement, roleName, selectedUserId, selectedContractorName) {
  const claims = announcement.claims || [];
  const projectName = announcement.project?.name || "the project";

  const otherClaimants = claims.filter(claim =>
    claim.role === roleName &&
    claim.userId !== selectedUserId
  );

  otherClaimants.forEach(claim => {
    try {
      const dmChannelId = openSlackDm(claim.userId);

      sendSlackMessage(
        dmChannelId,
        [
          `Hi <@${claim.userId}> 👋`,
          "",
          `Thanks for claiming *${roleName}* on *${projectName}*.`,
          "",
          `This role has now been assigned to ${selectedContractorName}.`,
          "",
          "Please keep an eye on the announcements channel for new opportunities."
        ].join("\n")
      );
    } catch (err) {
      Logger.log(`Could not notify claimant ${claim.userId}: ${err.message}`);
    }
  });
}


/************************************
 * STATUS TEXT
 ************************************/

function getSingleClaimRoleStatusText_(role, userId) {
  if (!role.assignedTo) {
    return "🟡 Status: Available";
  }

  if (role.assignedTo.userId === userId) {
    return `🟢 Assigned to: ${role.assignedTo.contractorName || `<@${role.assignedTo.userId}>`}`;
  }

  return `🔴 Assigned to: ${role.assignedTo.contractorName || `<@${role.assignedTo.userId}>`}`;
}


/************************************
 * SORTING + DATE HELPERS
 ************************************/

function sortClaimsByRoleSort_(claims) {
  const sortByRoleName = buildRoleSortMap_();

  return (claims || []).slice().sort((a, b) => {
    const aSort = sortByRoleName[a.role] || 9999;
    const bSort = sortByRoleName[b.role] || 9999;

    if (aSort !== bSort) {
      return aSort - bSort;
    }

    return String(a.role || "").localeCompare(String(b.role || ""));
  });
}

function sortAnnouncementRolesByRoleSort_(roles) {
  const sortByRoleName = buildRoleSortMap_();

  return (roles || []).slice().sort((a, b) => {
    const aSort = sortByRoleName[a.role] || 9999;
    const bSort = sortByRoleName[b.role] || 9999;

    if (aSort !== bSort) {
      return aSort - bSort;
    }

    return String(a.role || "").localeCompare(String(b.role || ""));
  });
}

function buildRoleSortMap_() {
  const roleOptions = loadNotionRoleOptions_();
  const sortByRoleName = {};

  roleOptions.forEach(role => {
    sortByRoleName[role.label] = role.sortOrder || 9999;
  });

  return sortByRoleName;
}

function formatClaimDate_(isoString) {
  if (!isoString) return "-";

  const date = new Date(isoString);

  if (isNaN(date.getTime())) return "-";

  const timezone = "America/Los_Angeles";
  const month = Utilities.formatDate(date, timezone, "MMMM");
  const day = Number(Utilities.formatDate(date, timezone, "d"));
  const hour = Utilities.formatDate(date, timezone, "ha");

  return `${month} ${day}${getDaySuffix_(day)}, ${hour}`;
}

function formatProjectDateForClaimDm_(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(`${dateValue}T12:00:00`);

  if (isNaN(date.getTime())) return dateValue;

  return Utilities.formatDate(
    date,
    "America/Los_Angeles",
    "MMMM d, yyyy"
  );
}

function getDaySuffix_(day) {
  if (day >= 11 && day <= 13) return "th";

  const lastDigit = day % 10;

  if (lastDigit === 1) return "st";
  if (lastDigit === 2) return "nd";
  if (lastDigit === 3) return "rd";

  return "th";
}
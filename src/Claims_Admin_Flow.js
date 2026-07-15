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
      const data = JSON.parse(all[key]);

      return {
        key,
        project: data.project,
        roles: data.roles || [],
        claims: data.claims || [],
        claimNotifications: data.claimNotifications || [],
        closed: data.closed || false,
        closedAt: data.closedAt || ""
      };
    })
    .filter(item => !item.closed)
    .sort((a, b) =>
      (a.project?.name || "").localeCompare(b.project?.name || "")
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
          button_("⬅️ Back", "projects_admin_menu")
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
          "📌 *Role Claims Admin*\n\n" +
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
          `Open: ${openCount} | Assigned: ${assignedCount} | Claims: ${claimCount}`
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
      button_("⬅️ Back", "projects_admin_menu"),
      button_("🏠 Main Menu", "menu_main")
    ]
  });

  return blocks;
}

function buildClaimsRoleListBlocks_(announcementKey) {
  const item = getRoleClaimAnnouncement_(announcementKey);

  if (!item || item.closed) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "📌 *Role Claims Admin*\n\n" +
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
          "📌 *Role Claims Admin*\n\n" +
          `*Project:* ${item.project?.name || "-"}\n\n` +
          "Review announced roles."
      }
    }
  ];

  sortAnnouncementRolesByRoleSort_(item.roles).forEach(role => {
    const roleIndex = item.roles.findIndex(r => r.role === role.role);

    const claimsForRole = item.claims.filter(
      claim => claim.role === role.role
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
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "Close Announcement",
          emoji: true
        },
        style: "danger",
        action_id: "claims_close_announcement",
        value: announcementKey
      }
    ]
  });

  return blocks;
}

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

  const claims = item.claims.filter(
    claim => claim.role === role.role
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

  const claims = (item.claims || []).filter(
    claim => claim.userId === userId
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
          "Review this person’s claimed role(s)."
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

function handleClaimsViewProject_(channelId, messageTs, announcementKey) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildClaimsRoleListBlocks_(announcementKey),
    "Role Claims"
  );
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

function handleClaimsAssignPerson_(channelId, messageTs, value) {
  const data = JSON.parse(value);
  const item = getRoleClaimAnnouncement_(data.announcementKey);

  if (!item) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildComingSoonBlocks_("Claim not found"),
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
      buildComingSoonBlocks_("Role not found"),
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
      [
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
      ],
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
            `*Project:* ${item.project.name}\n` +
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

  const raw = PropertiesService.getScriptProperties()
    .getProperty(data.announcementKey);

  const stored = JSON.parse(raw);
  stored.roles[roleIndex].assignedTo = {
    userId: data.userId,
    contractorName: contractor.name,
    assignedAt: new Date().toISOString()
  };

  PropertiesService.getScriptProperties().setProperty(
    data.announcementKey,
    JSON.stringify(stored)
  );

  CacheService
    .getScriptCache()
    .remove(`PROJECT_ROLES_${item.project.id}`);

  CacheService
    .getScriptCache()
    .remove("PROJECTS_NEEDING_CONTRACTORS");

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

function handleClaimsCloseAnnouncement_(channelId, messageTs, announcementKey) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(announcementKey);

  if (!raw) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildComingSoonBlocks_("Announcement not found"),
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

function getRoleClaimAnnouncement_(announcementKey) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(announcementKey);

  if (!raw) return null;

  const data = JSON.parse(raw);

  return {
    key: announcementKey,
    project: data.project,
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
        `Good news — you’ve been assigned to *${role.role}* for *${projectName}*.`,
        "",
        `*Hours:* ${role.hours}`,
        `*Deliverables:* ${role.deliverables || "-"}`,
        `*Start date:* ${project.startDate || "-"}`,
        `*End date:* ${project.endDate || "-"}`,
        "",
        "You’ll receive the SOW file shortly.",
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
          "This role has now been assigned to another contractor.",
          "",
          "Please keep an eye on the announcements channel for new opportunities."
        ].join("\n")
      );
    } catch (err) {
      Logger.log(`Could not notify claimant ${claim.userId}: ${err.message}`);
    }
  });
}

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
    const role = item.roles.find(role => role.role === roleName);
    return !role || role.assignedTo;
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
  const raw = PropertiesService.getScriptProperties()
    .getProperty(announcementKey);

  if (!raw) return;

  const data = JSON.parse(raw);
  const notifications = data.claimNotifications || [];

  notifications.forEach(notification => {
    const item = getRoleClaimAnnouncement_(announcementKey);
    const claimedRoles = notification.claimedRoles || [];

    const allClosed = claimedRoles.every(roleName => {
      const role = item.roles.find(role => role.role === roleName);
      return !role || role.assignedTo;
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

function getSingleClaimRoleStatusText_(role, userId) {
  if (!role.assignedTo) {
    return "🟡 Status: Available";
  }

  if (role.assignedTo.userId === userId) {
    return `🟢 Assigned to: ${role.assignedTo.contractorName || `<@${role.assignedTo.userId}>`}`;
  }

  return `🔴 Assigned to: ${role.assignedTo.contractorName || `<@${role.assignedTo.userId}>`}`;
}

function formatClaimDate_(isoString) {
  if (!isoString) return "-";

  const date = new Date(isoString);

  if (isNaN(date.getTime())) return "-";

  const timezone = "America/Los_Angeles";

  const month = Utilities.formatDate(date, timezone, "MMMM");
  const day = Number(Utilities.formatDate(date, timezone, "d"));
  const hour = Utilities.formatDate(date, timezone, "ha")
    .replace("AM", "AM")
    .replace("PM", "PM");

  return `${month} ${day}${getDaySuffix_(day)}, ${hour}`;
}

function getDaySuffix_(day) {
  if (day >= 11 && day <= 13) return "th";

  const lastDigit = day % 10;

  if (lastDigit === 1) return "st";
  if (lastDigit === 2) return "nd";
  if (lastDigit === 3) return "rd";

  return "th";
}

function sortClaimsByRoleSort_(claims) {
  const roleOptions = loadNotionRoleOptions_();

  const sortByRoleName = {};

  roleOptions.forEach(role => {
    sortByRoleName[role.label] = role.sortOrder || 9999;
  });

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
  const roleOptions = loadNotionRoleOptions_();

  const sortByRoleName = {};

  roleOptions.forEach(role => {
    sortByRoleName[role.label] = role.sortOrder || 9999;
  });

  return (roles || []).slice().sort((a, b) => {
    const aSort = sortByRoleName[a.role] || 9999;
    const bSort = sortByRoleName[b.role] || 9999;

    if (aSort !== bSort) {
      return aSort - bSort;
    }

    return String(a.role || "").localeCompare(String(b.role || ""));
  });
}

function postSowReadyAfterClaimClose_(announcement) {
  const projectId = announcement.project?.id || "";
  const projectName = announcement.project?.name || "this project";

  if (!projectId) {
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
            "All announced roles have been assigned.\n" +
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
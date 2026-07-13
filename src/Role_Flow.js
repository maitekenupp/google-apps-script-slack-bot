function startRoleFlow_(userId, channelId, messageTs) {
  const session = getProjectSession_(userId);

  if (!session || !session.createdProject) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildProjectsMenuBlocks_(),
      "IZA Projects Menu"
    );
    return;
  }

  session.status = "roles_collecting";
  session.roleStep = "pricing";
  session.roleDrafts = session.roleDrafts || [];
  session.currentRoleDraft = {};
  session.lastActivity = Date.now();

  saveProjectSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildRolePricingBlocks_(session),
    "Role Pricing"
  );
}

function buildRolePricingBlocks_(session) {
  session = session || {};

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "👥 *Add Project Roles*\n\n" +
          "*Step 1: Pricing*\n\n" +
          `*Project:* ${getRoleProjectName_(session)}\n\n` +
          "Is this project using CDEF pricing?"
      }
    },
    {
      type: "actions",
      elements: [
        button_("Yes, CDEF ($125)", "role_pricing_cdef"),
        button_("No, Standard", "role_pricing_standard")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("❌ Cancel", "roles_cancel")
      ]
    }
  ];
}

function handleRolePricingSelect_(userId, channelId, messageTs, isCdef) {
  const session = getProjectSession_(userId);

  if (!session) return;

  session.isCdefPricing = isCdef;
  session.roleStep = "select_role";
  session.currentRoleDraft = {};
  session.lastActivity = Date.now();

  saveProjectSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildRoleSelectBlocks_(session),
    "Select Role"
  );
}

function buildRoleSelectBlocks_(session) {
  session = session || {};

  const roleOptions = loadNotionRoleOptions_();
  const currentRole = session.currentRoleDraft || {};
  const selectedRole = roleOptions.find(
    role => role.id === currentRole.roleId
  );

  const roleSelect = {
    type: "static_select",
    action_id: "role_select",
    placeholder: {
      type: "plain_text",
      text: "Select a role",
      emoji: true
    },
    options: roleOptions.map(role => ({
      text: {
        type: "plain_text",
        text: role.label,
        emoji: true
      },
      value: role.id
    }))
  };

  if (selectedRole) {
    roleSelect.initial_option = {
      text: {
        type: "plain_text",
        text: selectedRole.label,
        emoji: true
      },
      value: selectedRole.id
    };
  }

  const navigationButtons = [];

  if (currentRole.roleId) {
    navigationButtons.push(button_("Next", "role_select_next"));
  }

  navigationButtons.push(button_("❌ Cancel", "roles_cancel"));

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "👥 *Add Project Role*\n\n" +
          "*Step 2: Select Role*\n\n" +
          `*Project:* ${getRoleProjectName_(session)}\n` +
          `*Pricing:* ${session.isCdefPricing ? "CDEF ($125)" : "Standard"}\n` +
          `*Selected Role:* ${currentRole.roleName || "-"}`
      }
    },
    {
      type: "actions",
      elements: [roleSelect]
    },
    {
      type: "actions",
      elements: navigationButtons
    }
  ];
}

function handleRoleSelect_(payload) {
  const context = getSlackActionContext_(payload);
  const selectedRoleId = payload.actions[0].selected_option.value;

  const session = getProjectSession_(context.userId);

  if (!session) return;

  const roleOptions = loadNotionRoleOptions_();
  const selectedRole = roleOptions.find(
    role => role.id === selectedRoleId
  );

  if (!selectedRole) return;

  const rate = session.isCdefPricing
    ? 125
    : selectedRole.defaultCompanyRate;

  session.roleStep = "select_role";
  session.currentRoleDraft = {
    roleId: selectedRole.id,
    roleName: selectedRole.label,
    companyRate: rate,
    unit: selectedRole.defaultUnit
  };
  session.lastActivity = Date.now();

  saveProjectSession_(context.userId, session);

  updateIzaMenu(
    context.channelId,
    context.messageTs,
    buildRoleSelectBlocks_(session),
    "Select Role"
  );
}


function handleRoleSelectNext_(userId, channelId, messageTs) {
  const session = getProjectSession_(userId);

  if (!session || !session.currentRoleDraft?.roleId) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildRoleSelectBlocks_(session || {}),
      "Select Role"
    );
    return;
  }

  session.roleStep = "details";
  session.lastActivity = Date.now();

  saveProjectSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildRoleDetailsPromptBlocks_(session),
    "Role Details"
  );
}

function buildRoleDetailsPromptBlocks_(session) {
  session = session || {};

  const role = session.currentRoleDraft || {};

  const navigationButtons = [
    button_("Previous", "role_details_previous")
  ];

  if (role.hoursToClient && role.hoursToContractor) {
    navigationButtons.push(button_("Next", "role_details_next"));
  }

  navigationButtons.push(button_("❌ Cancel", "roles_cancel"));

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "👥 *Add Project Role*\n\n" +
          "*Step 2 of 3: Role Details*\n\n" +
          `*Project:* ${getRoleProjectName_(session)}\n` +
          `*Role:* ${role.roleName || "-"}\n` +
          `*Company Rate:* $${role.companyRate || 0} / ${role.unit || "-"}\n` +
          `*Hours to Client:* ${role.hoursToClient || "-"}\n` +
          `*Hours to Contractor:* ${role.hoursToContractor || "-"}\n` +
          `*Deliverables:* ${role.deliverables || "-"}\n\n` +
          "Use *Add / Edit Details*, then click *Next*."
      }
    },
    {
      type: "actions",
      elements: [
        button_("✏️ Add / Edit Details", "role_open_details_modal")
      ]
    },
    {
      type: "actions",
      elements: navigationButtons
    }
  ];
}

function openRoleDetailsModal_(userId, channelId, messageTs, triggerId) {
  const session = getProjectSession_(userId);

  if (!session || !session.currentRoleDraft?.roleId) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildRoleSelectBlocks_(session || {}),
      "Select Role"
    );
    return;
  }

  const metadata = JSON.stringify({
    userId,
    channelId,
    messageTs
  });

  openSlackModal_(
    triggerId,
    buildRoleDetailsModalView_(metadata, session.currentRoleDraft)
  );
}

function buildRoleDetailsModalView_(privateMetadata, roleDraft) {
  roleDraft = roleDraft || {};

  return {
    type: "modal",
    callback_id: "role_details_submit",
    title: {
      type: "plain_text",
      text: "Role Details",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Save & Close",
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
        type: "input",
        block_id: "hours_client_block",
        label: {
          type: "plain_text",
          text: "Hours to Client",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "hours_client_value",
          placeholder: {
            type: "plain_text",
            text: "Example: 40"
          },
          ...(roleDraft.hoursToClient
            ? { initial_value: String(roleDraft.hoursToClient) }
            : {})
        }
      },
      {
        type: "input",
        block_id: "hours_contractor_block",
        label: {
          type: "plain_text",
          text: "Hours to Contractor",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "hours_contractor_value",
          placeholder: {
            type: "plain_text",
            text: "Example: 32"
          },
          ...(roleDraft.hoursToContractor
            ? { initial_value: String(roleDraft.hoursToContractor) }
            : {})
        }
      },
      {
        type: "input",
        block_id: "deliverables_block",
        label: {
          type: "plain_text",
          text: "Deliverables",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "deliverables_value",
          multiline: true,
          ...(roleDraft.deliverables
            ? { initial_value: roleDraft.deliverables }
            : {})
        }
      }
    ]
  };
}

function handleRoleDetailsSubmit_(payload) {
  const metadata = JSON.parse(payload.view.private_metadata);
  const values = payload.view.state.values;

  const session = getProjectSession_(metadata.userId);

  if (!session || !session.currentRoleDraft) {
    return { response_action: "clear" };
  }

  const hoursToClient = Number(
    values.hours_client_block.hours_client_value.value
  );

  const hoursToContractor = Number(
    values.hours_contractor_block.hours_contractor_value.value
  );

  if (!hoursToClient || hoursToClient <= 0) {
    return {
      response_action: "errors",
      errors: {
        hours_client_block: "Enter a number greater than 0."
      }
    };
  }

  if (!hoursToContractor || hoursToContractor <= 0) {
    return {
      response_action: "errors",
      errors: {
        hours_contractor_block: "Enter a number greater than 0."
      }
    };
  }

  session.roleStep = "details";
  session.currentRoleDraft.hoursToClient = hoursToClient;
  session.currentRoleDraft.hoursToContractor = hoursToContractor;
  session.currentRoleDraft.deliverables =
    values.deliverables_block.deliverables_value.value || "";
  session.currentRoleDraft.total =
    hoursToClient * Number(session.currentRoleDraft.companyRate || 0);
  session.lastActivity = Date.now();

  saveProjectSession_(metadata.userId, session);

  updateIzaMenu(
    metadata.channelId,
    metadata.messageTs,
    buildRoleDetailsPromptBlocks_(session),
    "Role Details"
  );

  return { response_action: "clear" };
}

function handleRoleDetailsPrevious_(userId, channelId, messageTs) {
  const session = getProjectSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildRoleSelectBlocks_(session || {}),
    "Select Role"
  );
}

function handleRoleDetailsNext_(userId, channelId, messageTs) {
  const session = getProjectSession_(userId);
  const role = session?.currentRoleDraft || {};

  if (!role.hoursToClient || !role.hoursToContractor) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildRoleDetailsPromptBlocks_(session || {}),
      "Role Details"
    );
    return;
  }

  session.roleStep = "review_role";
  session.lastActivity = Date.now();

  saveProjectSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildRoleReviewBlocks_(session),
    "Review Role"
  );
}

function buildRoleReviewBlocks_(session) {
  const role = session.currentRoleDraft || {};

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "👥 *Review Role*\n\n" +
          `*Project:* ${getRoleProjectName_(session)}\n` +
          `*Role:* ${role.roleName || "-"}\n` +
          `*Company Rate:* $${role.companyRate || 0} / ${role.unit || "-"}\n` +
          `*Hours to Client:* ${role.hoursToClient || "-"}\n` +
          `*Hours to Contractor:* ${role.hoursToContractor || "-"}\n` +
          `*Total Client Price:* $${Number(role.total || 0).toLocaleString()}\n` +
          `*Deliverables:* ${role.deliverables || "-"}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("Previous", "role_review_previous"),
        button_("Add Role", "role_add_to_list"),
        button_("❌ Cancel", "roles_cancel")
      ]
    }
  ];
}

function handleRoleReviewPrevious_(userId, channelId, messageTs) {
  const session = getProjectSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildRoleDetailsPromptBlocks_(session || {}),
    "Role Details"
  );
}

function handleRoleAddToList_(userId, channelId, messageTs) {
  const session = getProjectSession_(userId);

  if (!session || !session.currentRoleDraft?.roleId) return;

  session.roleDrafts = session.roleDrafts || [];
  session.roleDrafts.push(session.currentRoleDraft);
  session.currentRoleDraft = {};
  session.roleStep = "summary";
  session.lastActivity = Date.now();

  saveProjectSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildRolesSummaryBlocks_(session),
    "Project Roles"
  );
}

function buildRolesSummaryBlocks_(session) {
  const roles = session.roleDrafts || [];

  const roleLines = roles.length
    ? roles.map((role, index) =>
        `${index + 1}. *${role.roleName}* — ` +
        `${role.hoursToClient} client hrs / ` +
        `${role.hoursToContractor} contractor hrs — ` +
        `$${Number(role.total || 0).toLocaleString()}`
      ).join("\n")
    : "No roles added yet.";

  const total = roles.reduce(
    (sum, role) => sum + Number(role.total || 0),
    0
  );

  const actionButtons = [
    button_("➕ Add Another Role", "role_add_another")
  ];

  if (roles.length > 0) {
    actionButtons.push(button_("✅ Create Roles", "roles_create_confirm"));
  }

  actionButtons.push(button_("❌ Cancel", "roles_cancel"));

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "👥 *Project Roles*\n\n" +
          `*Project:* ${getRoleProjectName_(session)}\n\n` +
          `${roleLines}\n\n` +
          `*Total Client Price:* $${total.toLocaleString()}`
      }
    },
    {
      type: "actions",
      elements: actionButtons
    }
  ];
}

function handleRoleAddAnother_(userId, channelId, messageTs) {
  const session = getProjectSession_(userId);

  if (!session) return;

  session.currentRoleDraft = {};
  session.roleStep = "select_role";
  session.lastActivity = Date.now();

  saveProjectSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildRoleSelectBlocks_(session),
    "Select Role"
  );
}

function handleRolesCreateConfirm_(userId, channelId, messageTs) {
  const session = getProjectSession_(userId);

  if (!session || !session.createdProject || !session.roleDrafts?.length) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildProjectsMenuBlocks_(),
      "IZA Projects Menu"
    );
    return;
  }

  if (
    session.status === "creating_roles" ||
    session.status === "roles_created"
  ) {
    return;
  }

  const projectName = getRoleProjectName_(session);

  session.status = "creating_roles";
  session.lastActivity = Date.now();
  saveProjectSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "⏳ *Creating roles in Notion...*\n\n" +
            `*${projectName}*\n\n` +
            "Please wait a moment."
        }
      }
    ],
    "Creating Roles"
  );

  try {
    session.roleDrafts.forEach(role => {
      createNotionProjectRole_({
        roleName: role.roleName,
        projectId: session.createdProject.id,
        companyRate: role.companyRate,
        unit: role.unit,
        hoursToClient: role.hoursToClient,
        hoursToContractor: role.hoursToContractor,
        deliverables: role.deliverables
      });
    });

    session.status = "roles_created";
    session.lastActivity = Date.now();

    saveProjectSession_(userId, session);

    updateIzaMenu(
      channelId,
      messageTs,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "🎉 *Roles created successfully!*\n\n" +
              `Added ${session.roleDrafts.length} role(s) to *${projectName}*.`
          }
        },
        {
          type: "actions",
          elements: [
            button_("👷 Assign Contractors", "contractor_assign_start"),
            button_("📋 Projects", "menu_projects"),
            button_("👋 Bye IZA", "menu_close")
          ]
        }
      ],
      "Roles Created"
    );

  } catch (err) {
    session.status = "roles_create_failed";
    session.lastError = err.message;
    session.lastActivity = Date.now();

    saveProjectSession_(userId, session);

    updateIzaMenu(
      channelId,
      messageTs,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "❌ *I had trouble creating the roles in Notion.*\n\n" +
              `Error: ${err.message}`
          }
        },
        {
          type: "actions",
          elements: [
            button_("⬅️ Projects", "menu_projects"),
            button_("🏠 Main Menu", "menu_main")
          ]
        }
      ],
      "Role Creation Failed"
    );
  }
}

function handleRolesCancel_(userId, channelId, messageTs) {
  const session = getProjectSession_(userId);

  if (session) {
    delete session.currentRoleDraft;
    delete session.roleDrafts;
    delete session.roleStep;
    session.status = "project_created";
    session.lastActivity = Date.now();
    saveProjectSession_(userId, session);
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectsMenuBlocks_(),
    "IZA Projects Menu"
  );
}

function getRoleProjectName_(session) {
  return (
    session?.createdProject?.name ||
    session?.answers?.["Project Name"] ||
    "Project"
  );
}
/******************************************************
 *
 * IZA
 * File: Project_Flow.gs
 *
 * Purpose:
 * Slack-guided flow for creating a new Notion project.
 *
 ******************************************************/


/************************************
 * START PROJECT FLOW
 ************************************/

function startProjectFlow_(userId, channelId, messageTs) {
  const session = {
    status: "project_collecting",
    step: "client",
    answers: {},
    userId,
    channelId,
    messageTs,
    lastActivity: Date.now()
  };

  saveProjectSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectClientBlocks_(session.answers),
    "New Project"
  );
}


/************************************
 * STEP 1: CLIENT
 ************************************/

function buildProjectClientBlocks_(answers) {
  answers = answers || {};

  const clientOptions =
    loadNotionClientOptions_();

  const selectedClientId =
    answers["Client"]?.id || "";

  const selectedClient =
    clientOptions.find(client =>
      client.value === selectedClientId
    );

  const clientSelect = {
    type: "static_select",
    action_id: "project_client_select",
    placeholder: {
      type: "plain_text",
      text: "Select a client",
      emoji: true
    },
    options:
      clientOptions.map(client => ({
        text: {
          type: "plain_text",
          text: client.label,
          emoji: true
        },
        value: client.value
      }))
  };

  if (selectedClientId && selectedClient) {
    clientSelect.initial_option = {
      text: {
        type: "plain_text",
        text: selectedClient.label,
        emoji: true
      },
      value: selectedClient.value
    };
  }

  const navigationButtons = [];

  if (answers["Client"]?.id) {
    navigationButtons.push(
      button_("Next", "project_client_next")
    );
  }

  navigationButtons.push(
    dangerButton_("❌ Cancel", "project_create_cancel")
  );

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🪄 *New Project*\n\n" +
          "*Step 1 of 5: Client*\n\n" +
          "Select the client for this project."
      }
    },
    {
      type: "actions",
      elements: [
        clientSelect
      ]
    },
    {
      type: "actions",
      elements: navigationButtons
    }
  ];
}

function handleProjectClientSelect_(payload) {
  const context =
    getSlackActionContext_(payload);

  const selected =
    payload.actions[0].selected_option;

  const session =
    getProjectSession_(context.userId) || {
      status: "project_collecting",
      answers: {},
      userId: context.userId,
      channelId: context.channelId,
      messageTs: context.messageTs
    };

  session.step = "client";
  session.answers = session.answers || {};
  session.answers["Client"] = {
    id: selected.value,
    name: selected.text.text
  };
  session.lastActivity = Date.now();

  saveProjectSession_(
    context.userId,
    session
  );

  updateIzaMenu(
    context.channelId,
    context.messageTs,
    buildProjectClientBlocks_(session.answers),
    "Project Client"
  );
}

function handleProjectClientNext_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  if (!session || !session.answers?.["Client"]?.id) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildProjectClientBlocks_(session?.answers || {}),
      "Project Client"
    );
    return;
  }

  session.step = "details";
  session.lastActivity = Date.now();

  saveProjectSession_(
    userId,
    session
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectDetailsPromptBlocks_(session.answers),
    "Project Details"
  );
}


/************************************
 * STEP 2: PROJECT DETAILS
 ************************************/

function buildProjectDetailsPromptBlocks_(answers) {
  answers = answers || {};

  const navigationButtons = [
    button_("Previous", "project_details_previous")
  ];

  if (answers["Project Name"]) {
    navigationButtons.push(
      button_("Next", "project_details_next")
    );
  }

  navigationButtons.push(
    dangerButton_("❌ Cancel", "project_create_cancel")
  );

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🪄 *New Project*\n\n" +
          "*Step 2 of 5: Project Details*\n\n" +
          `*Client:* ${answers["Client"]?.name || "-"}\n` +
          `*Project Name:* ${answers["Project Name"] || "-"}\n` +
          `*Description:* ${answers["Short Description"] || "-"}\n\n` +
          "Use *Add / Edit Details*, then click *Next*."
      }
    },
    {
      type: "actions",
      elements: [
        button_("✏️ Add / Edit Details", "project_open_details_modal")
      ]
    },
    {
      type: "actions",
      elements: navigationButtons
    }
  ];
}

function openProjectDetailsModal_(userId, channelId, messageTs, triggerId) {
  const session =
    getProjectSession_(userId) || {};

  const answers =
    session.answers || {};

  const metadata =
    JSON.stringify({
      userId,
      channelId,
      messageTs
    });

  openSlackModal_(
    triggerId,
    buildProjectDetailsModalView_(metadata, answers)
  );
}

function buildProjectDetailsModalView_(privateMetadata, answers) {
  answers = answers || {};

  return {
    type: "modal",
    callback_id: "project_details_submit",
    title: {
      type: "plain_text",
      text: "Project Details",
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
    private_metadata: privateMetadata,
    blocks: [
      {
        type: "input",
        block_id: "project_name_block",
        label: {
          type: "plain_text",
          text: "Project Name",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "project_name_value",
          ...(answers["Project Name"]
            ? { initial_value: answers["Project Name"] }
            : {})
        }
      },
      {
        type: "input",
        block_id: "description_block",
        label: {
          type: "plain_text",
          text: "Short Description",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "description_value",
          multiline: true,
          ...(answers["Short Description"]
            ? { initial_value: answers["Short Description"] }
            : {})
        }
      }
    ]
  };
}

function handleProjectDetailsSubmit_(payload) {
  const metadata =
    JSON.parse(payload.view.private_metadata);

  const values =
    payload.view.state.values;

  const session =
    getProjectSession_(metadata.userId);

  if (!session) {
    return {
      response_action: "clear"
    };
  }

  session.step = "details";
  session.answers = session.answers || {};
  session.answers["Project Name"] =
    values.project_name_block.project_name_value.value;
  session.answers["Short Description"] =
    values.description_block.description_value.value || "";
  session.lastActivity = Date.now();

  saveProjectSession_(
    metadata.userId,
    session
  );

  updateIzaMenu(
    metadata.channelId,
    metadata.messageTs,
    buildProjectDetailsPromptBlocks_(session.answers),
    "Project Details"
  );

  return {
    response_action: "clear"
  };
}

function handleProjectDetailsPrevious_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectClientBlocks_(session?.answers || {}),
    "Project Client"
  );
}

function handleProjectDetailsNext_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  if (!session || !session.answers?.["Project Name"]) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildProjectDetailsPromptBlocks_(session?.answers || {}),
      "Project Details"
    );
    return;
  }

  session.step = "dates";
  session.lastActivity = Date.now();

  saveProjectSession_(
    userId,
    session
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectDatesBlocks_(session.answers),
    "Project Dates"
  );
}


/************************************
 * STEP 3: DATES
 ************************************/

function buildProjectDatesBlocks_(answers) {
  answers = answers || {};

  const dates =
    answers["Project Dates"] || {};

  const startDatePicker = {
    type: "datepicker",
    action_id: "project_start_date_select",
    placeholder: {
      type: "plain_text",
      text: "Start date",
      emoji: true
    }
  };

  if (dates.startDate) {
    startDatePicker.initial_date = dates.startDate;
  }

  const endDatePicker = {
    type: "datepicker",
    action_id: "project_end_date_select",
    placeholder: {
      type: "plain_text",
      text: "End date",
      emoji: true
    }
  };

  if (dates.endDate) {
    endDatePicker.initial_date = dates.endDate;
  }

  const navigationButtons = [
    button_("Previous", "project_dates_previous")
  ];

  if (dates.startDate && dates.endDate) {
    navigationButtons.push(
      button_("Next", "project_dates_next")
    );
  }

  navigationButtons.push(
    dangerButton_("❌ Cancel", "project_create_cancel")
  );

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🪄 *New Project*\n\n" +
          "*Step 3 of 5: Project Dates*\n\n" +
          `*Client:* ${answers["Client"]?.name || "-"}\n` +
          `*Project Name:* ${answers["Project Name"] || "-"}\n` +
          `*Description:* ${answers["Short Description"] || "-"}\n\n` +
          `*Start:* ${dates.startDate || "-"}\n` +
          `*End:* ${dates.endDate || "-"}`
      }
    },
    {
      type: "actions",
      elements: [
        startDatePicker,
        endDatePicker
      ]
    },
    {
      type: "actions",
      elements: navigationButtons
    }
  ];
}

function handleProjectDateSelect_(payload) {
  const context =
    getSlackActionContext_(payload);

  const action =
    payload.actions[0];

  const session =
    getProjectSession_(context.userId);

  if (!session) {
    return;
  }

  session.step = "dates";
  session.answers = session.answers || {};
  session.answers["Project Dates"] =
    session.answers["Project Dates"] || {};

  if (action.action_id === "project_start_date_select") {
    session.answers["Project Dates"].startDate =
      action.selected_date;
  }

  if (action.action_id === "project_end_date_select") {
    session.answers["Project Dates"].endDate =
      action.selected_date;
  }

  session.lastActivity =
    Date.now();

  saveProjectSession_(
    context.userId,
    session
  );

  updateIzaMenu(
    context.channelId,
    context.messageTs,
    buildProjectDatesBlocks_(session.answers),
    "Project Dates"
  );
}

function handleProjectDatesPrevious_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectDetailsPromptBlocks_(session?.answers || {}),
    "Project Details"
  );
}

function handleProjectDatesNext_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  const dates =
    session?.answers?.["Project Dates"] || {};

  if (!dates.startDate || !dates.endDate) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildProjectDatesBlocks_(session?.answers || {}),
      "Project Dates"
    );
    return;
  }

  session.step = "status";
  session.lastActivity = Date.now();

  saveProjectSession_(
    userId,
    session
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectStatusBlocks_(session.answers),
    "Project Status"
  );
}


/************************************
 * STEP 4: STATUS
 ************************************/

function buildProjectStatusBlocks_(answers) {
  answers = answers || {};

  const dates =
    answers["Project Dates"] || {};

  const navigationButtons = [
    button_("Previous", "project_status_previous")
  ];

  if (answers["Project Status"]) {
    navigationButtons.push(
      button_("Next", "project_status_next")
    );
  }

  navigationButtons.push(
    dangerButton_("❌ Cancel", "project_create_cancel")
  );

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🪄 *New Project*\n\n" +
          "*Step 4 of 5: Project Status*\n\n" +
          `*Client:* ${answers["Client"]?.name || "-"}\n` +
          `*Project Name:* ${answers["Project Name"] || "-"}\n` +
          `*Description:* ${answers["Short Description"] || "-"}\n` +
          `*Start:* ${dates.startDate || "-"}\n` +
          `*End:* ${dates.endDate || "-"}\n\n` +
          `*Selected Status:* ${answers["Project Status"] || "-"}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("Quotation", "project_status_quotation"),
        button_("Not Started", "project_status_not_started"),
        button_("In progress", "project_status_in_progress")
      ]
    },
    {
      type: "actions",
      elements: navigationButtons
    }
  ];
}

function handleProjectStatusSelect_(userId, channelId, messageTs, actionId) {
  const session =
    getProjectSession_(userId);

  if (!session || !session.answers) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildAdminProjectsMenuBlocks_(),
      "Admin Projects"
    );
    return;
  }

  const statusMap = {
    project_status_quotation: "Quotation",
    project_status_not_started: "Not Started",
    project_status_in_progress: "In progress"
  };

  session.step = "status";
  session.answers["Project Status"] =
    statusMap[actionId] || "Quotation";
  session.lastActivity = Date.now();

  saveProjectSession_(
    userId,
    session
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectStatusBlocks_(session.answers),
    "Project Status"
  );
}

function handleProjectStatusPrevious_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectDatesBlocks_(session?.answers || {}),
    "Project Dates"
  );
}

function handleProjectStatusNext_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  if (!session?.answers?.["Project Status"]) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildProjectStatusBlocks_(session?.answers || {}),
      "Project Status"
    );
    return;
  }

  session.step = "links";
  session.lastActivity = Date.now();

  saveProjectSession_(
    userId,
    session
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectLinksPromptBlocks_(session.answers),
    "Project Links"
  );
}


/************************************
 * STEP 5: LINKS
 ************************************/

function buildProjectLinksPromptBlocks_(answers) {
  answers = answers || {};

  const dates =
    answers["Project Dates"] || {};

  const files =
    answers["SOW Files"] || {};

  const navigationButtons = [
    button_("Previous", "project_links_previous")
  ];

  if (files.projectWorkbook) {
    navigationButtons.push(
      button_("Next", "project_links_next")
    );
  }

  navigationButtons.push(
    dangerButton_("❌ Cancel", "project_create_cancel")
  );

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🪄 *New Project*\n\n" +
          "*Step 5 of 5: Project Links*\n\n" +
          `*Client:* ${answers["Client"]?.name || "-"}\n` +
          `*Project Name:* ${answers["Project Name"] || "-"}\n` +
          `*Description:* ${answers["Short Description"] || "-"}\n` +
          `*Start:* ${dates.startDate || "-"}\n` +
          `*End:* ${dates.endDate || "-"}\n` +
          `*Project Status:* ${answers["Project Status"] || "-"}\n\n` +
          "*Project Workbook is required.*\n\n" +
          `*Workbook:* ${files.projectWorkbook || "-"}\n` +
          `*SOW:* ${files.sowFile || "-"}\n\n` +
          "Use *Add / Edit Links*, then click *Next*."
      }
    },
    {
      type: "actions",
      elements: [
        button_("🔗 Add / Edit Links", "project_open_links_modal")
      ]
    },
    {
      type: "actions",
      elements: navigationButtons
    }
  ];
}

function openProjectLinksModal_(userId, channelId, messageTs, triggerId) {
  const session =
    getProjectSession_(userId) || {};

  const answers =
    session.answers || {};

  const metadata =
    JSON.stringify({
      userId,
      channelId,
      messageTs
    });

  openSlackModal_(
    triggerId,
    buildProjectLinksModalView_(metadata, answers)
  );
}

function buildProjectLinksModalView_(privateMetadata, answers) {
  answers = answers || {};

  const files =
    answers["SOW Files"] || {};

  return {
    type: "modal",
    callback_id: "project_links_submit",
    title: {
      type: "plain_text",
      text: "Project Links",
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
    private_metadata: privateMetadata,
    blocks: [
      {
        type: "input",
        block_id: "project_workbook_block",
        optional: false,
        label: {
          type: "plain_text",
          text: "Project Workbook",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "project_workbook_value",
          placeholder: {
            type: "plain_text",
            text: "Paste Project Workbook URL"
          },
          ...(files.projectWorkbook
            ? { initial_value: files.projectWorkbook }
            : {})
        }
      },
      {
        type: "input",
        block_id: "sow_file_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "SOW File",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "sow_file_value",
          placeholder: {
            type: "plain_text",
            text: "Paste SOW File URL"
          },
          ...(files.sowFile
            ? { initial_value: files.sowFile }
            : {})
        }
      }
    ]
  };
}

function handleProjectLinksSubmit_(payload) {
  const metadata =
    JSON.parse(payload.view.private_metadata);

  const values =
    payload.view.state.values;

  const session =
    getProjectSession_(metadata.userId);

  if (!session) {
    return {
      response_action: "clear"
    };
  }

  session.step = "links";
  session.answers = session.answers || {};
  session.answers["SOW Files"] = {
    projectWorkbook:
      (values.project_workbook_block.project_workbook_value.value || "").trim(),
    sowFile:
      (values.sow_file_block.sow_file_value.value || "").trim()
  };
  session.lastActivity = Date.now();

  saveProjectSession_(
    metadata.userId,
    session
  );

  updateIzaMenu(
    metadata.channelId,
    metadata.messageTs,
    buildProjectLinksPromptBlocks_(session.answers),
    "Project Links"
  );

  return {
    response_action: "clear"
  };
}

function handleProjectLinksPrevious_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectStatusBlocks_(session?.answers || {}),
    "Project Status"
  );
}

function handleProjectLinksNext_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  const files =
    session?.answers?.["SOW Files"] || {};

  if (!files.projectWorkbook) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildProjectLinksPromptBlocks_(session?.answers || {}),
      "Project Links"
    );
    return;
  }

  session.step = "review";
  session.status = "reviewing_project";
  session.lastActivity = Date.now();

  saveProjectSession_(
    userId,
    session
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectReviewBlocks_(session.answers),
    "Review Project"
  );
}


/************************************
 * REVIEW + CREATE
 ************************************/

function buildProjectReviewBlocks_(answers) {
  const clientName =
    answers["Client"]?.name || "-";

  const dates =
    answers["Project Dates"] || {};

  const files =
    answers["SOW Files"] || {};

  const fileLines = [
    files.projectWorkbook
      ? `• Project Workbook: ${files.projectWorkbook}`
      : null,
    files.sowFile
      ? `• SOW File: ${files.sowFile}`
      : null
  ]
    .filter(Boolean)
    .join("\n") || "-";

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🪄 *Review Project*\n\n" +
          `*Client:* ${clientName}\n` +
          `*Project Name:* ${answers["Project Name"] || "-"}\n` +
          `*Description:* ${answers["Short Description"] || "-"}\n` +
          `*Start Date:* ${dates.startDate || "-"}\n` +
          `*End Date:* ${dates.endDate || "-"}\n` +
          `*Project Status:* ${answers["Project Status"] || "-"}\n` +
          `*Files:*\n${fileLines}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("Previous", "project_review_previous"),
        primaryButton_("✅ Create Project", "project_create_confirm"),
        dangerButton_("❌ Cancel", "project_create_cancel")
      ]
    }
  ];
}

function handleProjectReviewPrevious_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectLinksPromptBlocks_(session?.answers || {}),
    "Project Links"
  );
}

function handleProjectCreateConfirm_(userId, channelId, messageTs) {
  const session =
    getProjectSession_(userId);

  if (!session || !session.answers) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildAdminProjectsMenuBlocks_(),
      "Admin Projects"
    );
    return;
  }

  if (
    session.status === "creating_project" ||
    session.status === "project_created"
  ) {
    return;
  }

  const projectName =
    session.answers["Project Name"] || "New Project";

  session.status = "creating_project";
  session.lastActivity = Date.now();

  saveProjectSession_(
    userId,
    session
  );

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectCreatingBlocks_(projectName),
    "Creating Project"
  );

  try {
    const project =
      createNotionProject_(session.answers);

    try {
      applyDefaultProjectTemplate_(project.id);
    } catch (templateErr) {
      Logger.log(
        "Template apply failed: " + templateErr.message
      );
    }

    session.status = "project_created";
    session.createdProject = {
      ...project,
      name: projectName
    };
    session.lastActivity = Date.now();

    saveProjectSession_(
      userId,
      session
    );

    CacheService
      .getScriptCache()
      .remove("PROJECTS_NEEDING_CONTRACTORS");

    updateIzaMenu(
      channelId,
      messageTs,
      buildProjectCreatedBlocks_(projectName, project),
      "Project Created"
    );

  } catch (err) {
    session.status = "project_create_failed";
    session.lastError = err.message;
    session.lastActivity = Date.now();

    saveProjectSession_(
      userId,
      session
    );

    updateIzaMenu(
      channelId,
      messageTs,
      buildProjectCreateFailedBlocks_(projectName, err),
      "Project Creation Failed"
    );
  }
}

function buildProjectCreatingBlocks_(projectName) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "⏳ *Creating project in Notion...*\n\n" +
          `*${projectName}*\n\n` +
          "Please wait a moment."
      }
    }
  ];
}

function buildProjectCreatedBlocks_(projectName, project) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🎉 *Project created successfully!*\n\n" +
          `*${projectName}*\n\n` +
          `<${project.url}|📂 Open in Notion>`
      }
    },
    {
      type: "actions",
      elements: [
        button_("👥 Add Roles", "role_create_start"),
        button_("📁 Projects", "admin_projects_menu"),
        button_("👋 Bye IZA", "menu_close")
      ]
    }
  ];
}

function buildProjectCreateFailedBlocks_(projectName, err) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "❌ *I had trouble creating this project in Notion.*\n\n" +
          `*${projectName}*\n\n` +
          `Error: ${err.message}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Projects", "admin_projects_menu"),
        button_("🏠 Main Menu", "menu_main")
      ]
    }
  ];
}
/******************************************************
 *
 * IZA
 * File: Project_Status_Flow.gs
 *
 * Purpose:
 * Allows admins to update a project status from the
 * Projects Overview screen.
 *
 ******************************************************/


/************************************
 * STATUS OPTIONS
 ************************************/

const PROJECT_STATUS_UPDATE_OPTIONS = [
  "Quotation",
  "Not Started",
  "Paused",
  "In progress",
  "For Review",
  "Final Billing",
  "Internal",
  "Canceled",
  "Done"
];


/************************************
 * START FLOW
 ************************************/

function startProjectStatusUpdate_(channelId, messageTs, userId) {
  const projects =
    loadProjectStatusUpdateOptions_();

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectStatusProjectSelectBlocks_(projects),
    "Update Project Status"
  );
}


/************************************
 * LOAD PROJECT OPTIONS
 ************************************/

function loadProjectStatusUpdateOptions_() {
  const rows =
    queryAllDataSourceRows_(PROJECTS_OVERVIEW_DATA_SOURCE_ID);

  return rows
    .map(row => {
      const name =
        getText_(row.properties["Project Name"]) ||
        "Untitled Project";

      const status =
        getText_(row.properties["Project Status"]) ||
        "No Status";

      return {
        id: row.id,
        name,
        status
      };
    })
    .filter(project => project.name)
    .sort((a, b) => {
      const statusA =
        getProjectStatusSortOrder_(a.status);

      const statusB =
        getProjectStatusSortOrder_(b.status);

      if (statusA !== statusB) {
        return statusA - statusB;
      }

      return a.name.localeCompare(b.name);
    });
}

function getProjectStatusSortOrder_(status) {
  const index =
    PROJECT_STATUS_UPDATE_OPTIONS.indexOf(status);

  return index === -1
    ? 999
    : index;
}


/************************************
 * SELECT PROJECT
 ************************************/

function buildProjectStatusProjectSelectBlocks_(projects) {
  if (!projects.length) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "🔄 *Update Project Status*\n\n" +
            "I could not find any projects to update."
        }
      },
      {
        type: "actions",
        elements: [
          button_("⬅️ Back", "admin_projects_menu")
        ]
      }
    ];
  }

  const options =
    projects
      .slice(0, 100)
      .map(project => ({
        text: {
          type: "plain_text",
          text: `${project.status} - ${project.name}`.substring(0, 75),
          emoji: true
        },
        value: project.id
      }));

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🔄 *Update Project Status*\n\n" +
          "Select the project you want to update."
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "static_select",
          action_id: "project_status_project_select",
          placeholder: {
            type: "plain_text",
            text: "Select project",
            emoji: true
          },
          options
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

function handleProjectStatusProjectSelect_(payload, channelId, messageTs, userId) {
  const projectId =
    payload.actions[0].selected_option.value;

  const projects =
    loadProjectStatusUpdateOptions_();

  const selected =
    projects.find(project => project.id === projectId);

  if (!selected) {
    startProjectStatusUpdate_(channelId, messageTs, userId);
    return;
  }

  const session = {
    projectId: selected.id,
    projectName: selected.name,
    currentStatus: selected.status
  };

  saveProjectStatusSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectStatusValueSelectBlocks_(session),
    "Select New Project Status"
  );
}


/************************************
 * SELECT NEW STATUS
 ************************************/

function buildProjectStatusValueSelectBlocks_(session) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🔄 *Update Project Status*\n\n" +
          `*Project:* ${session.projectName}\n` +
          `*Current status:* ${session.currentStatus}\n\n` +
          "Select the new status."
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "static_select",
          action_id: "project_status_value_select",
          placeholder: {
            type: "plain_text",
            text: "Select status",
            emoji: true
          },
          options: PROJECT_STATUS_UPDATE_OPTIONS.map(status => ({
            text: {
              type: "plain_text",
              text: status,
              emoji: true
            },
            value: status
          }))
        }
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "project_status_update_start")
      ]
    }
  ];
}

function handleProjectStatusValueSelect_(payload, channelId, messageTs, userId) {
  const session =
    getProjectStatusSession_(userId);

  if (!session) {
    startProjectStatusUpdate_(channelId, messageTs, userId);
    return;
  }

  session.newStatus =
    payload.actions[0].selected_option.value;

  saveProjectStatusSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectStatusReviewBlocks_(session),
    "Review Project Status"
  );
}


/************************************
 * REVIEW + CONFIRM
 ************************************/

function buildProjectStatusReviewBlocks_(session) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "⚠️ *Review Status Change*\n\n" +
          `*Project:* ${session.projectName}\n` +
          `*Current status:* ${session.currentStatus}\n` +
          `*New status:* ${session.newStatus}\n\n` +
          "Changing project status can affect operational workflows.\n\n" +
          "Projects marked *In progress* may become available for contractor invoice submission.\n" +
          "Projects marked *Done*, *Canceled*, or *Paused* may no longer appear in active project workflows.\n\n" +
          "Please confirm this change."
      }
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "project_status_update_start"),
        primaryButton_("✅ Confirm Update", "project_status_confirm"),
        dangerButton_("❌ Cancel", "project_status_cancel")
      ]
    }
  ];
}

function handleProjectStatusConfirm_(channelId, messageTs, userId) {
  const session =
    getProjectStatusSession_(userId);

  if (!session || !session.projectId || !session.newStatus) {
    startProjectStatusUpdate_(channelId, messageTs, userId);
    return;
  }

  updateNotionProjectStatus_(
    session.projectId,
    session.newStatus
  );

  clearProjectStatusSession_(userId);

  CacheService
    .getScriptCache()
    .remove("PROJECTS_NEEDING_CONTRACTORS");

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectStatusCompletedBlocks_(session),
    "Project Status Updated"
  );
}

function buildProjectStatusCompletedBlocks_(session) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "✅ *Project status updated*\n\n" +
          `*Project:* ${session.projectName}\n` +
          `*New status:* ${session.newStatus}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("📋 Back to Overview", "projects_overview"),
        button_("⬅️ Back", "admin_projects_menu")
      ]
    }
  ];
}

function handleProjectStatusCancel_(channelId, messageTs, userId) {
  clearProjectStatusSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildAdminProjectsMenuBlocks_(),
    "Admin Projects"
  );
}


/************************************
 * NOTION UPDATE
 ************************************/

function updateNotionProjectStatus_(projectId, status) {
  return notionFetch_(
    `https://api.notion.com/v1/pages/${projectId}`,
    "patch",
    {
      properties: {
        "Project Status": {
          status: {
            name: status
          }
        }
      }
    }
  );
}


/************************************
 * SESSION STORAGE
 ************************************/

function saveProjectStatusSession_(userId, session) {
  PropertiesService
    .getScriptProperties()
    .setProperty(
      `PROJECT_STATUS_SESSION_${userId}`,
      JSON.stringify(session)
    );
}

function getProjectStatusSession_(userId) {
  const raw =
    PropertiesService
      .getScriptProperties()
      .getProperty(`PROJECT_STATUS_SESSION_${userId}`);

  return raw
    ? JSON.parse(raw)
    : null;
}

function clearProjectStatusSession_(userId) {
  PropertiesService
    .getScriptProperties()
    .deleteProperty(`PROJECT_STATUS_SESSION_${userId}`);
}
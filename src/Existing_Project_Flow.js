/******************************************************
 *
 * IZA
 * File: Existing_Project_Flow.gs
 *
 * Purpose:
 * Lets admins continue work on projects that already exist
 * in Notion.
 *
 * Used for:
 * - Adding roles to an existing project
 * - Assigning contractors to an existing project
 *
 ******************************************************/


/************************************
 * ADD ROLES TO EXISTING PROJECT
 ************************************/

function showExistingProjectRoleSelect_(userId, channelId, messageTs) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildExistingProjectLoadingBlocks_(
      "Checking Notion for projects that need roles."
    ),
    "Loading Projects"
  );

  try {
    const projects =
      loadProjectsNeedingRoles_();

    updateIzaMenu(
      channelId,
      messageTs,
      buildExistingProjectSelectBlocks_(
        "👥 Add Roles to Existing Project",
        "Select a project that needs roles.",
        "existing_project_roles_select",
        projects
      ),
      "Add Roles"
    );

  } catch (err) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildNotionLoadErrorBlocks_(
        "I couldn’t load projects from Notion.",
        "existing_project_add_roles"
      ),
      "Notion Load Error"
    );

    throw err;
  }
}

function handleExistingProjectRolesSelect_(payload) {
  const context =
    getSlackActionContext_(payload);

  const selectedProjectId =
    payload.actions[0].selected_option.value;

  const project =
    getNotionProjectSummary_(selectedProjectId);

  const session =
    buildExistingProjectSession_(
      context,
      project,
      "project_created"
    );

  saveProjectSession_(
    context.userId,
    session
  );

  startRoleFlow_(
    context.userId,
    context.channelId,
    context.messageTs
  );
}


/************************************
 * ASSIGN CONTRACTORS TO EXISTING PROJECT
 ************************************/

function showExistingProjectContractorSelect_(userId, channelId, messageTs) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildExistingProjectLoadingBlocks_(
      "Checking Notion for projects with roles ready for contractor assignment."
    ),
    "Loading Projects"
  );

  try {
    const projects =
      loadProjectsReadyForContractors_();

    updateIzaMenu(
      channelId,
      messageTs,
      buildExistingProjectSelectBlocks_(
        "👷 Assign Contractors to Existing Project",
        "Select a project with roles ready for contractor assignment.",
        "existing_project_contractors_select",
        projects
      ),
      "Assign Contractors"
    );

  } catch (err) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildNotionLoadErrorBlocks_(
        "I couldn’t load contractor-ready projects from Notion.",
        "existing_project_assign_contractors"
      ),
      "Notion Load Error"
    );

    throw err;
  }
}

function handleExistingProjectContractorsSelect_(payload) {
  const context =
    getSlackActionContext_(payload);

  const selectedProjectId =
    payload.actions[0].selected_option.value;

  const project =
    getNotionProjectSummary_(selectedProjectId);

  const projectRoles =
    loadProjectRolesForAssignment_(selectedProjectId);

  if (!projectRoles.length) {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildNoContractorReadyRolesBlocks_(),
      "No Roles Found"
    );
    return;
  }

  const session =
    buildExistingProjectSession_(
      context,
      project,
      "roles_created"
    );

  session.roleDrafts =
    projectRoles.map(role => ({
      roleName: role.role,
      hoursToContractor: role.hoursToContractor,
      deliverables: role.deliverables || ""
    }));

  saveProjectSession_(
    context.userId,
    session
  );

  startContractorFlow_(
    context.userId,
    context.channelId,
    context.messageTs
  );
}


/************************************
 * SHARED BLOCKS
 ************************************/

function buildExistingProjectLoadingBlocks_(message) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "⏳ *Loading projects...*\n\n" +
          message
      }
    }
  ];
}

function buildExistingProjectSelectBlocks_(title, subtitle, actionId, projects) {
  if (!projects.length) {
    return [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*${title}*\n\n` +
            "No matching projects found."
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

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${title}*\n\n` +
          subtitle
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "static_select",
          action_id: actionId,
          placeholder: {
            type: "plain_text",
            text: "Select a project",
            emoji: true
          },
          options:
            projects
              .slice(0, 100)
              .map(project => ({
                text: {
                  type: "plain_text",
                  text: project.name.substring(0, 75),
                  emoji: true
                },
                value: project.id
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

function buildNotionLoadErrorBlocks_(message, retryActionId) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "❌ *Notion is not responding right now.*\n\n" +
          `${message}\n\n` +
          "Please try again in a moment."
      }
    },
    {
      type: "actions",
      elements: [
        button_("🔄 Try Again", retryActionId),
        button_("⬅️ Back", "admin_projects_menu")
      ]
    }
  ];
}

function buildNoContractorReadyRolesBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "👷 *Assign Contractors*\n\n" +
          "No contractor-ready roles found for this project."
      }
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "existing_project_assign_contractors")
      ]
    }
  ];
}


/************************************
 * PROJECT FILTERS
 ************************************/

function loadProjectsNeedingRoles_() {
  const projectRows =
    queryAllDataSourceRows_(PROJECTS_OVERVIEW_DATA_SOURCE_ID);

  const taskRows =
    queryAllDataSourceRows_(TASKS_DATA_SOURCE_ID);

  const projectsWithRoles = {};

  taskRows.forEach(row => {
    const projectIds =
      getRelationIds_(row.properties["Project"]);

    projectIds.forEach(projectId => {
      projectsWithRoles[projectId] = true;
    });
  });

  return projectRows
    .filter(row => !projectsWithRoles[row.id])
    .map(row => ({
      id: row.id,
      name:
        getText_(row.properties["Project Name"]) ||
        "Untitled Project",
      status:
        getText_(row.properties["Project Status"])
    }))
    .filter(project =>
      project.name &&
      isProjectAvailableForAdminWork_(project.status)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function loadProjectsReadyForContractors_() {
  const projectRows =
    queryAllDataSourceRows_(PROJECTS_OVERVIEW_DATA_SOURCE_ID);

  const taskRows =
    queryAllDataSourceRows_(TASKS_DATA_SOURCE_ID);

  const projectIdsWithContractorHours = {};

  taskRows.forEach(row => {
    const hoursToContractor =
      getNumber_(row.properties["Hours to Contractor"]);

    if (hoursToContractor <= 0) {
      return;
    }

    const projectIds =
      getRelationIds_(row.properties["Project"]);

    projectIds.forEach(projectId => {
      projectIdsWithContractorHours[projectId] = true;
    });
  });

  return projectRows
    .filter(row => projectIdsWithContractorHours[row.id])
    .map(row => ({
      id: row.id,
      name:
        getText_(row.properties["Project Name"]) ||
        "Untitled Project",
      status:
        getText_(row.properties["Project Status"])
    }))
    .filter(project =>
      project.name &&
      isProjectAvailableForAdminWork_(project.status)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function isProjectAvailableForAdminWork_(status) {
  return ![
    "Done",
    "Canceled"
  ].includes(status);
}


/************************************
 * PROJECT SESSION BUILDER
 ************************************/

function buildExistingProjectSession_(context, project, status) {
  return {
    status,
    createdProject: {
      id: project.id,
      name: project.name,
      description: project.description,
      startDate: project.startDate,
      endDate: project.endDate
    },
    answers: {
      "Project Name": project.name,
      "Short Description": project.description,
      "Project Dates": {
        startDate: project.startDate,
        endDate: project.endDate
      }
    },
    userId: context.userId,
    channelId: context.channelId,
    messageTs: context.messageTs,
    lastActivity: Date.now()
  };
}


/************************************
 * NOTION PROJECT SUMMARY
 ************************************/

function getNotionProjectSummary_(projectId) {
  const rows =
    queryAllDataSourceRows_(PROJECTS_OVERVIEW_DATA_SOURCE_ID);

  const row =
    rows.find(project => project.id === projectId);

  if (!row) {
    return {
      id: projectId,
      name: "Unknown Project",
      description: "",
      startDate: "",
      endDate: ""
    };
  }

  const p =
    row.properties;

  return {
    id: row.id,
    name:
      getText_(p["Project Name"]) ||
      "Untitled Project",
    description:
      getText_(p["Short Description"]) ||
      "",
    startDate:
      getDateStart_(p["Project Start Date"]),
    endDate:
      getDateStart_(p["Project End Date"])
  };
}

function getDateStart_(property) {
  if (!property || property.type !== "date") {
    return "";
  }

  return property.date?.start || "";
}
/******************************************************
 *
 * IZA
 * File: Notion_Contractors.gs
 *
 * Purpose:
 * Reads contractor options from Team Directory and creates
 * project-contractor assignment records in Notion.
 *
 ******************************************************/


/************************************
 * CONTRACTOR OPTIONS
 ************************************/

function loadContractorOptions_() {
  const users =
    loadTeamDirectoryUsers_();

  return users
    .filter(user =>
      user.izaRole.includes("contractor")
    )
    .map(user => ({
      id: user.id,
      label: user.name,
      value: user.id,
      name: user.name,
      rate: user.rate,
      slackId: user.slackId,
      izaRole: user.izaRole
    }))
    .sort((a, b) =>
      a.name.localeCompare(b.name)
    );
}


/************************************
 * PROJECT ROLES AVAILABLE FOR ASSIGNMENT
 ************************************/

function loadProjectRolesForAssignment_(projectId) {
  const cache =
    CacheService.getScriptCache();

  const cacheKey =
    `PROJECT_ROLES_${projectId}`;

  const cached =
    cache.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const assignedRoleNames =
    getAssignedRoleNamesForProject_(projectId);

  const data =
    notionFetch_(
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

  const roles =
    (data.results || [])
      .map(row => ({
        taskId: row.id,
        role:
          getText_(row.properties["Roles"]),
        hoursToContractor:
          getNumber_(row.properties["Hours to Contractor"]),
        deliverables:
          getText_(row.properties["Deliverables"])
      }))
      .filter(role =>
        role.role &&
        role.hoursToContractor > 0 &&
        !assignedRoleNames.includes(role.role)
      );

  const sortedRoles =
    sortProjectRolesByRoleSort_(roles);

  cache.put(
    cacheKey,
    JSON.stringify(sortedRoles),
    300
  );

  return sortedRoles;
}

function getAssignedRoleNamesForProject_(projectId) {
  const rows =
    queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);

  const assignedRoles = [];

  rows.forEach(row => {
    const p =
      row.properties;

    const projectIds =
      getRelationIds_(p["Projects 1 related to"]);

    if (!projectIds.includes(projectId)) {
      return;
    }

    const roleNames =
      getMultiSelectNames_(p["Role"]);

    roleNames.forEach(roleName => {
      if (roleName && !assignedRoles.includes(roleName)) {
        assignedRoles.push(roleName);
      }
    });
  });

  return assignedRoles;
}


/************************************
 * CREATE CONTRACTOR ASSIGNMENT
 ************************************/

function createProjectContractorAssignment_(assignmentData) {
  const payload = {
    parent: {
      data_source_id: PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID
    },
    properties: {
      "Contractor": {
        title: [
          {
            text: {
              content: assignmentData.contractorName || ""
            }
          }
        ]
      },
      "Hours to Contractor": {
        number: assignmentData.hours
      },
      "Rate per Hour": {
        number: assignmentData.rate
      },
      "Role": {
        multi_select: [
          {
            name: assignmentData.role
          }
        ]
      },
      "Projects 1 related to": {
        relation: [
          {
            id: assignmentData.projectId
          }
        ]
      }
    }
  };

  return notionFetch_(
    "https://api.notion.com/v1/pages",
    "post",
    payload
  );
}


/************************************
 * SORT HELPERS
 ************************************/

function sortProjectRolesByRoleSort_(projectRoles) {
  const roleOptions =
    loadNotionRoleOptions_();

  const sortByRoleName = {};

  roleOptions.forEach(role => {
    sortByRoleName[role.label] =
      role.sortOrder || 9999;
  });

  return projectRoles.sort((a, b) => {
    const aSort =
      sortByRoleName[a.role] || 9999;

    const bSort =
      sortByRoleName[b.role] || 9999;

    if (aSort !== bSort) {
      return aSort - bSort;
    }

    return String(a.role || "")
      .localeCompare(String(b.role || ""));
  });
}
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

  const assignedTaskIds =
    getAssignedTaskRoleIdsForProject_(projectId);

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
        role.taskId &&
        role.role &&
        role.hoursToContractor > 0 &&
        !assignedTaskIds.includes(role.taskId)
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

function getAssignedTaskRoleIdsForProject_(projectId) {
  const rows =
    queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);

  const assignedTaskIds = [];

  rows.forEach(row => {
    const p = row.properties;

    const rowProjectId =
      p["Projects 1 related to"]?.relation?.[0]?.id || "";

    if (rowProjectId !== projectId) {
      return;
    }

    const taskIds =
      getRelationIds_(p["Task / Role"]);

    taskIds.forEach(taskId => {
      if (taskId && !assignedTaskIds.includes(taskId)) {
        assignedTaskIds.push(taskId);
      }
    });
  });

  return assignedTaskIds;
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
      },
      "Task / Role": {
        relation: assignmentData.taskId
          ? [
              {
                id: assignmentData.taskId
              }
            ]
          : []
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

function sortProjectRolesByRoleSort_(roles) {
  const roleOptions =
    loadNotionRoleOptions_();

  const sortByRoleName = {};

  roleOptions.forEach(role => {
    const normalizedRole =
      normalizeRoleNameForCompare_(
        role.label
      );

    sortByRoleName[normalizedRole] =
      role.sortOrder || 9999;
  });

  return (roles || []).sort((a, b) => {
    const aRole =
      normalizeRoleNameForCompare_(
        a.role || a.roleName
      );

    const bRole =
      normalizeRoleNameForCompare_(
        b.role || b.roleName
      );

    const aSort =
      sortByRoleName[aRole] || 9999;

    const bSort =
      sortByRoleName[bRole] || 9999;

    if (aSort !== bSort) {
      return aSort - bSort;
    }

    return String(a.role || a.roleName || "")
      .localeCompare(
        String(b.role || b.roleName || ""),
        undefined,
        { sensitivity: "base" }
      );
  });
}

function findTaskIdForProjectRole_(projectId, roleName) {
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

  const normalizedTarget =
    normalizeRoleNameForCompare_(roleName);

  const match =
    (data.results || []).find(row => {
      const existingRole =
        normalizeRoleNameForCompare_(
          getExistingProjectRoleName_(row)
        );

      return existingRole === normalizedTarget;
    });

  return match ? match.id : "";
}
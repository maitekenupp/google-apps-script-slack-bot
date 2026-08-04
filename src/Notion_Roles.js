/******************************************************
 *
 * IZA
 * File: Notion_Roles.gs
 *
 * Purpose:
 * Reads role defaults and creates project role records
 * in Notion.
 *
 ******************************************************/


/************************************
 * ROLE OPTIONS
 ************************************/

function loadNotionRoleOptions_() {
  const cache =
    CacheService.getScriptCache();

  const cached =
    cache.get("NOTION_ROLE_OPTIONS");

  if (cached) {
    return JSON.parse(cached);
  }

  const rows =
    queryAllDataSourceRows_(ROLES_DATA_SOURCE_ID);

  const roles =
    rows
      .map(row => ({
        id: row.id,
        label:
          getText_(row.properties["Role"]),
        value: row.id,
        defaultCompanyRate:
          getNumber_(row.properties["Default Company Rate"]),
        defaultUnit:
          getText_(row.properties["Default Unit"]),
        sortOrder:
          getNumber_(row.properties["Sort Order"])
      }))
      .filter(role => role.label)
      .sort((a, b) =>
        a.sortOrder - b.sortOrder
      );

  cache.put(
    "NOTION_ROLE_OPTIONS",
    JSON.stringify(roles),
    300
  );

  return roles;
}

function loadAvailableRoleOptionsForProject_(projectId, draftRoles) {
  const allRoleOptions =
    loadNotionRoleOptions_();

  const existingRoleNames =
    getExistingRoleNamesForProject_(projectId);

  const draftRoleNames =
    (draftRoles || [])
      .map(role =>
        normalizeRoleNameForCompare_(
          role.roleName || role.role || ""
        )
      )
      .filter(Boolean);

  return allRoleOptions.filter(option => {
    const roleName =
      normalizeRoleNameForCompare_(
        option.label || option.name || option.value
      );

    return (
      roleName &&
      !existingRoleNames.includes(roleName) &&
      !draftRoleNames.includes(roleName)
    );
  });
}

function getExistingRoleNamesForProject_(projectId) {
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

  return (data.results || [])
    .map(row =>
      normalizeRoleNameForCompare_(
        getExistingProjectRoleName_(row)
      )
    )
    .filter(Boolean);
}

function getExistingProjectRoleName_(row) {
  const property =
    row.properties["Roles"];

  if (!property) {
    return "";
  }

  if (property.title && property.title.length) {
    return property.title
      .map(item => item.plain_text || item.text?.content || "")
      .join("")
      .trim();
  }

  if (property.rich_text && property.rich_text.length) {
    return property.rich_text
      .map(item => item.plain_text || item.text?.content || "")
      .join("")
      .trim();
  }

  if (property.multi_select && property.multi_select.length) {
    return property.multi_select
      .map(item => item.name)
      .join(", ")
      .trim();
  }

  if (property.select) {
    return property.select.name || "";
  }

  return getText_(property);
}

function normalizeRoleNameForCompare_(roleName) {
  return String(roleName || "")
    .trim()
    .toLowerCase();
}

function projectAlreadyHasRole_(projectId, roleName, draftRoles) {
  const normalizedRole =
    normalizeRoleNameForCompare_(roleName);

  const existingRoleNames =
    getExistingRoleNamesForProject_(projectId);

  const draftRoleNames =
    (draftRoles || [])
      .map(role =>
        normalizeRoleNameForCompare_(
          role.roleName || role.role || ""
        )
      )
      .filter(Boolean);

  return (
    existingRoleNames.includes(normalizedRole) ||
    draftRoleNames.includes(normalizedRole)
  );
}


/************************************
 * CREATE PROJECT ROLE
 ************************************/

function createNotionProjectRole_(roleData) {
  const payload = {
    parent: {
      data_source_id: TASKS_DATA_SOURCE_ID
    },
    properties: {
      "Roles": {
        title: [
          {
            text: {
              content: roleData.roleName || ""
            }
          }
        ]
      },
      "Project": {
        relation: [
          {
            id: roleData.projectId
          }
        ]
      },
      "Company Rate": {
        number: roleData.companyRate
      },
      "Unit": {
        select: {
          name: roleData.unit
        }
      },
      "Hours to Client": {
        number: roleData.hoursToClient
      },
      "Hours to Contractor": {
        number: roleData.hoursToContractor
      },
      "Deliverables": {
        rich_text: [
          {
            text: {
              content: roleData.deliverables || ""
            }
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
 * CACHE WARMER
 ************************************/

function warmRoleCache() {
  loadNotionRoleOptions_();
}
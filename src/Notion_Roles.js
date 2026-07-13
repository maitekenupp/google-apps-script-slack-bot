/******************************************************
 *
 * IZA
 * File: Notion_Roles.gs
 *
 * Purpose:
 * Handles role defaults and project role creation in Notion.
 *
 ******************************************************/

function loadNotionRoleOptions_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("NOTION_ROLE_OPTIONS");

  if (cached) {
    return JSON.parse(cached);
  }

  const rows = queryAllDataSourceRows_(ROLES_DATA_SOURCE_ID);

  const roles = rows
    .map(row => ({
      id: row.id,
      label: getText_(row.properties["Role"]),
      value: row.id,
      defaultCompanyRate: getNumber_(row.properties["Default Company Rate"]),
      defaultUnit: getText_(row.properties["Default Unit"]),
      sortOrder: getNumber_(row.properties["Sort Order"])
    }))
    .filter(role => role.label)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  cache.put("NOTION_ROLE_OPTIONS", JSON.stringify(roles), 300);

  return roles;
}

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

function warmRoleCache() {
  loadNotionRoleOptions_();
}
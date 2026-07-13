/******************************************************
 *
 * IZA
 * File: Notion_Projects.gs
 *
 * Purpose:
 * Handles Notion project/client data used by project workflows.
 *
 ******************************************************/


/************************************
 * LOAD CLIENT DROPDOWN OPTIONS
 ************************************/

function loadNotionClientOptions_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("NOTION_CLIENT_OPTIONS");

  if (cached) {
    return JSON.parse(cached);
  }

  const rows = queryAllDataSourceRows_(CLIENTS_DATA_SOURCE_ID);

  const clients = rows
    .map(row => {
      const name = getText_(row.properties['Name']);

      return {
        id: row.id,
        name: name,
        label: name,
        value: row.id
      };
    })
    .filter(client => client.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  cache.put("NOTION_CLIENT_OPTIONS", JSON.stringify(clients), 300);

  return clients;
}

function createNotionProject_(answers) {

  const payload = {
    parent: {
      data_source_id: PROJECTS_OVERVIEW_DATA_SOURCE_ID
    },
    properties: {
      "Project Name": {
        title: [
          {
            text: {
              content: answers["Project Name"] || ""
            }
          }
        ]
      },

      "Client": {
        relation: [
          {
            id: answers["Client"].id
          }
        ]
      },

      "Short Description": {
        rich_text: [
          {
            text: {
              content: answers["Short Description"] || ""
            }
          }
        ]
      },

      "Project Start Date": {
        date: {
          start: answers["Project Dates"]?.startDate || null
        }
      },

      "Project End Date": {
        date: {
          start: answers["Project Dates"]?.endDate || null
        }
      },

      "Project Status": {
        status: {
          name: answers["Project Status"]
        }
      },

      "SOW File": {
        files: buildSowFilesPayload_(answers["SOW Files"])
      }
    }
  };

  return notionFetch_(
    "https://api.notion.com/v1/pages",
    "post",
    payload
  );
}

function applyDefaultProjectTemplate_(pageId) {
  return notionFetch_(
    `https://api.notion.com/v1/pages/${pageId}`,
    "patch",
    {
      template: {
        type: "default"
      }
    }
  );
}

function buildSowFilesPayload_(sowFiles) {
  if (!sowFiles) return [];

  const files = [];

  if (sowFiles.sowFile) {
    files.push({
      name: "SOW File",
      type: "external",
      external: {
        url: sowFiles.sowFile
      }
    });
  }

  if (sowFiles.projectWorkbook) {
    files.push({
      name: "Project Workbook",
      type: "external",
      external: {
        url: sowFiles.projectWorkbook
      }
    });
  }

  return files;
}

/************************************
 * LOAD PROJECT DROPDOWN OPTIONS
 ************************************/

function loadProjectsNeedingContractors_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("PROJECTS_NEEDING_CONTRACTORS");

  if (cached) {
    return JSON.parse(cached);
  }

  const rows = queryAllDataSourceRows_(PROJECTS_OVERVIEW_DATA_SOURCE_ID);

  const projects = rows
    .filter(row => {
      const relation =
        row.properties["Contractors Assigned"]?.relation || [];

      const status =
        getText_(row.properties["Project Status"]);

      const allowedStatuses = [
        "Quotation",
        "Not Started",
        "In Progress"
      ];

      return (
        relation.length === 0 &&
        allowedStatuses.includes(status)
      );
    })
    .map(row => ({
      id: row.id,
      label: getText_(row.properties["Project Name"]),
      value: row.id,
      name: getText_(row.properties["Project Name"])
    }))
    .filter(project => project.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  cache.put(
    "PROJECTS_NEEDING_CONTRACTORS",
    JSON.stringify(projects),
    300
  );

  return projects;
}
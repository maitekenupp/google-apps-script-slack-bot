/************************************
 * IZA - Notion Core + Portfolio Workload
 * File: Notion_CoreAndWorkload.gs
 ************************************/


/************************************
 * NOTION CORE
 ************************************/

function getNotionConfig_() {
  const props = PropertiesService.getScriptProperties();

  return {
    token: props.getProperty("NOTION_TOKEN")
  };
}

function notionFetch_(url, method, payload) {
  const config = getNotionConfig_();

  const options = {
    method: method || "get",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true
  };

  if (payload) {
    options.payload = JSON.stringify(payload);
  }

  const maxAttempts = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const code = response.getResponseCode();
      const text = response.getContentText();

      if (code >= 200 && code < 300) {
        return JSON.parse(text);
      }

      if (code === 429 || code >= 500) {
        lastError = new Error(
          `Notion API temporary error ${code}: ${text}`
        );
        Utilities.sleep(500 * attempt);
        continue;
      }

      throw new Error(`Notion API error ${code}: ${text}`);

    } catch (err) {
      lastError = err;

      const message =
        String(err.message || "");

      const isTemporary =
        message.includes("Address unavailable") ||
        message.includes("Timeout") ||
        message.includes("Service invoked too many times") ||
        message.includes("DNS") ||
        message.includes("Exception: Request failed");

      if (!isTemporary || attempt === maxAttempts) {
        throw err;
      }

      Utilities.sleep(500 * attempt);
    }
  }

  throw lastError;
}

function queryAllDataSourceRows_(dataSourceId) {
  let results = [];
  let hasMore = true;
  let startCursor = null;

  while (hasMore) {
    const payload =
      startCursor
        ? { start_cursor: startCursor }
        : {};

    const data = notionFetch_(
      `https://api.notion.com/v1/data_sources/${dataSourceId}/query`,
      "post",
      payload
    );

    results =
      results.concat(data.results || []);

    hasMore =
      data.has_more;

    startCursor =
      data.next_cursor;
  }

  return results;
}


/************************************
 * NOTION PROPERTY READERS
 ************************************/

function getText_(property) {
  if (!property) return "";

  if (property.type === "title") {
    return (property.title || [])
      .map(item => item.plain_text)
      .join("");
  }

  if (property.type === "rich_text") {
    return (property.rich_text || [])
      .map(item => item.plain_text)
      .join("");
  }

  if (property.type === "select") {
    return property.select?.name || "";
  }

  if (property.type === "status") {
    return property.status?.name || "";
  }

  if (property.type === "formula") {
    if (property.formula.type === "string") {
      return property.formula.string || "";
    }

    if (property.formula.type === "number") {
      return String(property.formula.number || 0);
    }
  }

  return "";
}

function getNumber_(property) {
  if (!property) return 0;

  if (property.type === "number") {
    return property.number || 0;
  }

  if (
    property.type === "formula" &&
    property.formula.type === "number"
  ) {
    return property.formula.number || 0;
  }

  if (
    property.type === "rollup" &&
    property.rollup.type === "number"
  ) {
    return property.rollup.number || 0;
  }

  return 0;
}

function getMultiSelectNames_(property) {
  if (!property || property.type !== "multi_select") {
    return [];
  }

  return (property.multi_select || [])
    .map(item => item.name);
}

function getRelationIds_(property) {
  if (!property || property.type !== "relation") {
    return [];
  }

  return (property.relation || [])
    .map(item => item.id);
}

function roundHours_(value) {
  return Math.round((value || 0) * 100) / 100;
}


/************************************
 * PORTFOLIO WORKLOAD DATA
 ************************************/

function buildManagementView() {
  const assignmentRows =
    queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);

  const projectsById =
    loadPortfolioProjectsById_();

  const projects = {};

  assignmentRows.forEach(row => {
    const p = row.properties;

    const contractor =
      getText_(p["Contractor"]) ||
      "Unknown Contractor";

    const projectId =
      p["Projects 1 related to"]?.relation?.[0]?.id || "";

    const project =
      projectsById[projectId];

    if (!project) {
      return;
    }

    const role =
      getMultiSelectNames_(p["Role"]).join(", ") ||
      getText_(p["Role"]) ||
      "Role not assigned";

    const contractedHours =
      getNumber_(p["Hours to Contractor"]);

    const billedHistorical =
      getNumber_(p["Billed Historical"]);

    const billedCurrent =
      getNumber_(p["Billed"]);

    const billedTotal =
      roundHours_(billedHistorical + billedCurrent);

    const remainingHours =
      roundHours_(contractedHours - billedTotal);

    if (!projects[project.name]) {
      projects[project.name] = {
        projectId: project.id,
        projectName: project.name,
        projectStatus: project.status,
        totalHours: 0,
        totalBilled: 0,
        totalRemaining: 0,
        team: []
      };
    }

    projects[project.name].totalHours += contractedHours;
    projects[project.name].totalBilled += billedTotal;
    projects[project.name].totalRemaining += remainingHours;

    projects[project.name].team.push({
      contractor,
      role,
      hours: roundHours_(contractedHours),
      billedHistorical,
      billedCurrent,
      billed: billedTotal,
      remaining: remainingHours
    });
  });

  return projects;
}

function loadPortfolioProjectsById_() {
  const rows =
    queryAllDataSourceRows_(PROJECTS_OVERVIEW_DATA_SOURCE_ID);

  const projects = {};

  rows.forEach(row => {
    projects[row.id] = {
      id: row.id,
      name:
        getText_(row.properties["Project Name"]) ||
        "Untitled Project",
      status:
        getText_(row.properties["Project Status"]) ||
        "No Status"
    };
  });

  return projects;
}


/************************************
 * PORTFOLIO WORKLOAD REPORT
 ************************************/

function buildManagementViewSections() {
  const projects =
    buildManagementView();

  return formatManagementReportSections_(projects);
}

function formatManagementReportSections_(projects) {
  const needsAllocation = [];
  const under50 = [];
  const over50 = [];
  const over80 = [];
  const over100 = [];

  Object.keys(projects)
    .sort()
    .forEach(projectName => {
      const projectData =
        projects[projectName];

      const totalHours =
        roundHours_(projectData.totalHours);

      const totalBilled =
        roundHours_(projectData.totalBilled);

      const totalRemaining =
        roundHours_(projectData.totalRemaining);

      const usage =
        totalHours > 0
          ? (totalBilled / totalHours) * 100
          : 0;

      const teamLines =
        projectData.team
          .sort((a, b) =>
            a.contractor.localeCompare(b.contractor) ||
            a.role.localeCompare(b.role)
          )
          .map(member =>
            `• ${member.contractor} | ${member.role} | ` +
            `${member.billed}/${member.hours} hrs ` +
            `(${member.remaining} left)`
          )
          .join("\n");

      const section =
        `🗂️ *${projectName}*\n` +
        `Status: ${projectData.projectStatus}\n` +
        `📊 Usage: ${usage.toFixed(1)}% | ` +
        `⏱️ ${totalBilled}/${totalHours} hrs | ` +
        `Remaining: ${totalRemaining} hrs\n\n` +
        `${teamLines || "_No assigned contractors._"}`;

      if (totalHours === 0) {
        needsAllocation.push(section);
      } else if (usage > 100) {
        over100.push(section);
      } else if (usage >= 80) {
        over80.push(section);
      } else if (usage >= 50) {
        over50.push(section);
      } else {
        under50.push(section);
      }
    });

  const summary =
    "📊 *Portfolio Overview*\n\n" +
    `⚫ Needs Allocation: ${needsAllocation.length}\n` +
    `🟢 Less than 50%: ${under50.length}\n` +
    `🟡 More than 50%: ${over50.length}\n` +
    `🔴 Almost Completed: ${over80.length}\n` +
    `🚨 Overused: ${over100.length}`;

  return {
    summary,
    needsAllocation,
    under50,
    over50,
    over80,
    over100
  };
}
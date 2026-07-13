/************************************
 * IZA - Notion Integration
 * File: Notion_CoreAndWorkload.gs
 ************************************/

function getNotionConfig_() {
  const props = PropertiesService.getScriptProperties();

  return {
    token: props.getProperty('NOTION_TOKEN')
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
        lastError = new Error(`Notion API temporary error ${code}: ${text}`);
        Utilities.sleep(500 * attempt);
        continue;
      }

      throw new Error(`Notion API error ${code}: ${text}`);

    } catch (err) {
      lastError = err;

      const message = String(err.message || "");

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
    const payload = startCursor ? { start_cursor: startCursor } : {};

    const data = notionFetch_(
      `https://api.notion.com/v1/data_sources/${dataSourceId}/query`,
      'post',
      payload
    );

    results = results.concat(data.results || []);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return results;
}

function getText_(property) {
  if (!property) return '';

  if (property.type === 'title') {
    return (property.title || []).map(t => t.plain_text).join('');
  }

  if (property.type === 'rich_text') {
    return (property.rich_text || []).map(t => t.plain_text).join('');
  }

  if (property.type === 'select') {
    return property.select?.name || '';
  }

  if (property.type === 'status') {
    return property.status?.name || '';
  }

  if (property.type === 'formula') {
    if (property.formula.type === 'string') return property.formula.string || '';
    if (property.formula.type === 'number') return String(property.formula.number || 0);
  }

  return '';
}

function getNumber_(property) {
  if (!property) return 0;

  if (property.type === 'number') {
    return property.number || 0;
  }

  if (property.type === 'formula' && property.formula.type === 'number') {
    return property.formula.number || 0;
  }

  if (property.type === 'rollup' && property.rollup.type === 'number') {
    return property.rollup.number || 0;
  }

  return 0;
}

function getMultiSelectNames_(property) {
  if (!property || property.type !== 'multi_select') return [];
  return (property.multi_select || []).map(item => item.name);
}

function getRelationIds_(property) {
  if (!property || property.type !== 'relation') return [];
  return (property.relation || []).map(item => item.id);
}

function roundHours_(value) {
  return Math.round((value || 0) * 100) / 100;
}

/**
 * Invoice table:
 * Each invoice row has:
 * - Hours Worked
 * - Billed Hours - Invoice Table relation
 *
 * This builds:
 * assignmentPageId -> total billed hours
 */
function getBilledHoursByAssignment_() {
  const invoiceRows = queryAllDataSourceRows_(INVOICE_DATA_SOURCE_ID);
  const billedByAssignment = {};

  invoiceRows.forEach(row => {
    const p = row.properties;

    const hoursWorked = getNumber_(p['Hours Worked']);
    const assignmentIds = getRelationIds_(p['Billed Hours - Invoice Table']);

    assignmentIds.forEach(assignmentId => {
      if (!billedByAssignment[assignmentId]) {
        billedByAssignment[assignmentId] = 0;
      }

      billedByAssignment[assignmentId] += hoursWorked;
    });
  });

  return billedByAssignment;
}

function buildManagementView() {
  const assignmentRows = queryAllDataSourceRows_(PROJECT_ASSIGNMENTS_DATA_SOURCE_ID);
  const billedByAssignment = getBilledHoursByAssignment_();

  const projects = {};

  assignmentRows.forEach(row => {
    const p = row.properties;

    const contractorStatus = getText_(p['Contractor Status']);

    if (contractorStatus.toLowerCase() !== 'active') {
      return;
    }

    const contractor = getText_(p['Contractor']) || 'Unknown';
    const role = getMultiSelectNames_(p['Role']).join(', ');
    const hours = getNumber_(p['Hours in Contract']);
    const billed = roundHours_(billedByAssignment[row.id] || 0);
    const projectNames = getMultiSelectNames_(p['Projects']);

    projectNames.forEach(project => {
      if (!projects[project]) {
        projects[project] = {
          totalHours: 0,
          totalBilled: 0,
          team: []
        };
      }

      projects[project].totalHours += hours;
      projects[project].totalBilled += billed;

      projects[project].team.push({
        contractor,
        role,
        hours: roundHours_(hours),
        billed
      });
    });
  });

  return projects;
}

function buildManagementViewSections() {
  const projects = buildManagementView();
  return formatManagementReportSections_(projects);
}

function formatManagementReportSections_(projects) {
  const noAllocation = [];
  const under50 = [];
  const over50 = [];
  const over80 = [];
  const over100 = [];

  Object.keys(projects).sort().forEach(project => {
    const projectData = projects[project];

    const totalHours = roundHours_(projectData.totalHours);
    const totalBilled = roundHours_(projectData.totalBilled);

    const usage =
      totalHours > 0
        ? (totalBilled / totalHours) * 100
        : 0;

    const teamLines = projectData.team
      .sort((a, b) => a.contractor.localeCompare(b.contractor))
      .map(member => {
        const remaining = roundHours_(member.hours - member.billed);
        return `• ${member.contractor} | ${member.role || 'Role not assigned'} | ${member.billed}/${member.hours} hrs (${remaining} left)`;
      })
      .join('\n');

    const section =
      `🗂️ ${project}
      📊 Usage: ${usage.toFixed(1)}% | ⏱️ ${totalBilled}/${totalHours} hrs

      ${teamLines}`;

          if (totalHours === 0) {
            noAllocation.push(section);
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
      `📊 PORTFOLIO SUMMARY

      ⚫ Needs Allocation: ${noAllocation.length}
      🟢 Less than 50%: ${under50.length}
      🟡 More than 50%: ${over50.length}
      🔴 Almost Completed: ${over80.length}
      🚨 Overused: ${over100.length}`;

          return {
          summary,
          noAllocation,
          under50,
          over50,
          over80,
          over100
        };
}
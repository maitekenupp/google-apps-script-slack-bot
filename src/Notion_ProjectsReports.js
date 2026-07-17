/************************************
 * IZA - Notion Projects Overview
 * File: Notion_ProjectsReports.gs
 ************************************/


/************************************
 * PROJECTS OVERVIEW REPORT
 ************************************/

function buildProjectsOverviewReport_() {
  const rows =
    queryAllDataSourceRows_(PROJECTS_OVERVIEW_DATA_SOURCE_ID);

  const groups = {};

  rows.forEach(row => {
    const p = row.properties;

    const projectName =
      getText_(p["Project Name"]) ||
      "Untitled Project";

    const projectStatus =
      getText_(p["Project Status"]) ||
      "No Status";

    if (shouldHideProjectFromOverview_(projectStatus)) {
      return;
    }

    if (!groups[projectStatus]) {
      groups[projectStatus] = [];
    }

    groups[projectStatus].push(projectName);
  });

  return formatProjectsOverviewReport_(groups);
}


/************************************
 * REPORT FORMATTER
 ************************************/

function formatProjectsOverviewReport_(groups) {
  const order = [
    "Quotation",
    "Not Started",
    "Paused",
    "In progress",
    "For Review",
    "Final Billing",
    "Internal",
    "No Status"
  ];

  const statusIcons = {
    "Quotation": "💰",
    "Not Started": "⚪",
    "Paused": "⏸️",
    "In progress": "🟢",
    "For Review": "🟡",
    "Final Billing": "🟣",
    "Internal": "🔵",
    "No Status": "❓"
  };

  let report =
    "📋 *Projects Overview*\n\n";

  order.forEach(status => {
    const projects =
      groups[status];

    if (!projects || !projects.length) {
      return;
    }

    const icon =
      statusIcons[status] || "📁";

    report +=
      `*${icon} ${status}* (${projects.length})\n`;

    projects
      .sort()
      .forEach(projectName => {
        report += `• ${projectName}\n`;
      });

    report += "\n";
  });

  return report.trim() || "📋 *Projects Overview*\n\nNo active projects found.";
}


/************************************
 * HELPERS
 ************************************/

function shouldHideProjectFromOverview_(projectStatus) {
  return (
    projectStatus === "Done" ||
    projectStatus === "Canceled"
  );
}
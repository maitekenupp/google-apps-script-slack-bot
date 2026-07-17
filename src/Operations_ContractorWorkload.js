/************************************
 * IZA - Contractor Workload Report
 * File: Operations_ContractorWorkload.gs
 ************************************/


/************************************
 * CONTRACTOR WORKLOAD ENTRY POINT
 ************************************/

function handleContractorWorkloadButton_(channelId, messageTs, userId) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildContractorWorkloadLoadingBlocks_(),
    "Loading Contractor Workload"
  );

  const reportText =
    buildContractorWorkloadReport_();

  updateIzaMenu(
    channelId,
    messageTs,
    buildContractorWorkloadBlocks_(reportText),
    "Contractor Workload"
  );
}

function buildContractorWorkloadLoadingBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "👤 *Contractor Workload*\n\n" +
          "Reviewing contractor assignments, billed hours, and remaining hours..."
      }
    }
  ];
}


/************************************
 * CONTRACTOR WORKLOAD REPORT
 ************************************/

function buildContractorWorkloadReport_() {
  const assignmentRows =
    queryAllDataSourceRows_(PROJECT_BY_CONTRACTOR_DATA_SOURCE_ID);

  const projectsById =
    loadContractorWorkloadProjectsById_();

  const contractors = {};

  assignmentRows.forEach(row => {
    const p = row.properties;

    const contractorName =
      getText_(p["Contractor"]);

    if (!contractorName) {
      return;
    }

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
      "Role";

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

    const rate =
      getNumber_(p["Rate per Hour"]);

    if (!contractors[contractorName]) {
      contractors[contractorName] = {
        totalContracted: 0,
        totalBilled: 0,
        totalRemaining: 0,
        totalValue: 0,
        projects: {}
      };
    }

    contractors[contractorName].totalContracted += contractedHours;
    contractors[contractorName].totalBilled += billedTotal;
    contractors[contractorName].totalRemaining += remainingHours;
    contractors[contractorName].totalValue += contractedHours * rate;

    if (!contractors[contractorName].projects[project.name]) {
      contractors[contractorName].projects[project.name] = [];
    }

    contractors[contractorName].projects[project.name].push({
      role,
      projectStatus: project.status,
      contractedHours,
      billedHistorical,
      billedCurrent,
      billedTotal,
      remainingHours,
      rate
    });
  });

  return formatContractorWorkloadReport_(contractors);
}

function formatContractorWorkloadReport_(contractors) {
  let report =
    "👤 *Contractor Workload*\n\n";

  const contractorNames =
    Object.keys(contractors).sort();

  if (!contractorNames.length) {
    return report + "No contractor assignments found.";
  }

  contractorNames.forEach(contractorName => {
    const data =
      contractors[contractorName];

    const totalContracted =
      roundHours_(data.totalContracted);

    const totalBilled =
      roundHours_(data.totalBilled);

    const totalRemaining =
      roundHours_(data.totalRemaining);

    const utilization =
      totalContracted > 0
        ? (totalBilled / totalContracted) * 100
        : 0;

    const projectCount =
      Object.keys(data.projects).length;

    report +=
      `*${contractorName}*\n` +
      `📁 Projects: ${projectCount}\n` +
      `⏱️ Used Hours: ${totalBilled}/${totalContracted}\n` +
      `🧮 Remaining Hours: ${totalRemaining}\n` +
      `📈 Utilization: ${utilization.toFixed(1)}%\n` +
      `💵 Contract Value: ${formatContractorWorkloadMoney_(data.totalValue)}\n`;

    Object.keys(data.projects)
      .sort()
      .forEach(projectName => {
        report += `• *${projectName}*\n`;

        data.projects[projectName]
          .sort((a, b) => a.role.localeCompare(b.role))
          .forEach(item => {
            report +=
              `  - ${item.role}: ` +
              `${item.billedTotal}/${item.contractedHours} hrs ` +
              `(${item.remainingHours} left) ` +
              `| ${item.projectStatus || "No status"}\n`;
          });
      });

    report += "\n";
  });

  return report.trim();
}


/************************************
 * CONTRACTOR WORKLOAD BLOCKS
 ************************************/

function buildContractorWorkloadBlocks_(reportText) {
  const safeText =
    reportText.length > 2900
      ? reportText.substring(0, 2900) + "\n\n_Report shortened for Slack._"
      : reportText;

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: safeText
      }
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "admin_contractors_menu")
      ]
    }
  ];
}


/************************************
 * CONTRACTOR WORKLOAD HELPERS
 ************************************/

function loadContractorWorkloadProjectsById_() {
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

function formatContractorWorkloadMoney_(value) {
  return "$" + Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
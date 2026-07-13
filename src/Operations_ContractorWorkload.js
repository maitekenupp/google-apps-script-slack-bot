/************************************
 * IZA - Contractor Workload Report
 * File: contractorworkload.gs
 ************************************/

function handleContractorWorkloadButton_(channelId, messageTs, userId) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildContractorWorkloadLoadingBlocks_(),
    "Loading Contractor Workload"
  );

  const reportText = buildContractorWorkloadReport_();

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
        text: "👤 *Contractor Workload*\n\nReviewing contractor assignments..."
      }
    }
  ];
}

function buildContractorWorkloadReport_() {
  const assignmentRows = queryAllDataSourceRows_(PROJECT_ASSIGNMENTS_DATA_SOURCE_ID);
  const billedByAssignment = getBilledHoursByAssignment_();

  const contractors = {};

  assignmentRows.forEach(row => {
    const p = row.properties;

    const contractorStatus = getText_(p['Contractor Status']);
    if (contractorStatus.toLowerCase() !== 'active') return;

    const contractor =
      getText_(p['Contractor']) ||
      'Unknown Contractor';

    const contractedHours = getNumber_(p['Hours in Contract']);
    const billedHours = roundHours_(billedByAssignment[row.id] || 0);
    const projectNames = getMultiSelectNames_(p['Projects']);

    if (!contractors[contractor]) {
      contractors[contractor] = {
        totalContracted: 0,
        totalBilled: 0,
        projects: {}
      };
    }

    contractors[contractor].totalContracted += contractedHours;
    contractors[contractor].totalBilled += billedHours;

    projectNames.forEach(projectName => {
      if (!contractors[contractor].projects[projectName]) {
        contractors[contractor].projects[projectName] = {
          contracted: 0,
          billed: 0
        };
      }

      contractors[contractor].projects[projectName].contracted += contractedHours;
      contractors[contractor].projects[projectName].billed += billedHours;
    });
  });

  let report = "👤 *Contractor Workload*\n\n";

  Object.keys(contractors)
    .sort()
    .forEach(contractor => {
      const data = contractors[contractor];

      const projectCount = Object.keys(data.projects).length;
      const totalContracted = roundHours_(data.totalContracted);
      const totalBilled = roundHours_(data.totalBilled);
      const utilization =
            totalContracted > 0
              ? (totalBilled / totalContracted) * 100
              : 0;

      report +=
        `*${contractor}*\n` +
        `📁 Projects: ${projectCount}\n` +
        `⏱️ Used Hours: ${totalBilled}/${totalContracted}\n` +
        `📈 Utilization: ${utilization.toFixed(1)}%\n`;

      Object.keys(data.projects)
        .sort()
        .forEach(projectName => {
          const project = data.projects[projectName];

          report +=
            `• ${projectName}: ` +
            `${roundHours_(project.billed)}/${roundHours_(project.contracted)} hrs\n`;
        });

      report += "\n";
    });

  return report.trim();
}

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
        button_("⬅️ Back", "menu_operations"),
        button_("🏠 Main Menu", "menu_main")
      ]
    }
  ];
}
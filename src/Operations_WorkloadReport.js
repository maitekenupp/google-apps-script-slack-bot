/************************************
 * IZA - Portfolio Overview
 * File: Operations_WorkloadReport.gs
 ************************************/


/************************************
 * PORTFOLIO SUMMARY
 ************************************/

function handleWorkloadReportButton_(channelId, messageTs, userId) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildWorkloadLoadingBlocks_(),
    "Loading Portfolio Overview"
  );

  const report =
    buildPortfolioActionView_();

  updateIzaMenu(
    channelId,
    messageTs,
    buildPortfolioActionSummaryBlocks_(report),
    "Portfolio Overview"
  );
}

function buildWorkloadLoadingBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "📊 *Portfolio Overview*\n\n" +
          "Reviewing project status, end dates, billed hours, and remaining hours..."
      }
    }
  ];
}

function buildPortfolioActionSummaryBlocks_(report) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "📊 *Portfolio Overview*\n\n" +
          `🚨 *Needs Attention:* ${report.needsAttention.length}\n` +
          `🟡 *Watch This Week:* ${report.watchThisWeek.length}\n` +
          `🟢 *On Track:* ${report.onTrack.length}\n` +
          `🟣 *Final Billing:* ${report.finalBilling.length}\n` +
          `⚪ *Pipeline:* ${report.pipeline.length}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("🚨 Needs Attention", "portfolio_needs_attention"),
        button_("🟡 Watch This Week", "portfolio_watch_this_week"),
        button_("🟢 On Track", "portfolio_on_track"),
        button_("🟣 Final Billing", "portfolio_final_billing"),
        button_("⚪ Pipeline", "portfolio_pipeline")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "admin_menu")
      ]
    }
  ];
}


/************************************
 * PORTFOLIO CATEGORY LIST
 ************************************/

function handlePortfolioCategoryButton_(channelId, messageTs, categoryKey, title) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildPortfolioCategoryLoadingBlocks_(title),
    title
  );

  const report =
    buildPortfolioActionView_();

  const items =
    report[categoryKey] || [];

  updateIzaMenu(
    channelId,
    messageTs,
    buildPortfolioCategoryBlocks_(title, categoryKey, items),
    title
  );
}

function buildPortfolioCategoryLoadingBlocks_(title) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${title}*\n\n` +
          "Loading projects..."
      }
    }
  ];
}

function buildPortfolioCategoryBlocks_(title, categoryKey, items) {
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*${title}* (${items.length})\n\n` +
          (
            items.length
              ? "Review the projects below."
              : "No projects in this category right now."
          )
      }
    }
  ];

  items.slice(0, 20).forEach(project => {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: buildPortfolioProjectSummaryText_(project)
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: "Details",
          emoji: true
        },
        action_id: "portfolio_project_details",
        value: project.projectId
      }
    });
  });

  if (items.length > 20) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `_Showing the first 20 projects. ${items.length - 20} more are in this category._`
      }
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      button_("⬅️ Back to Portfolio", "ops_workload")
    ]
  });

  return blocks;
}

function buildPortfolioProjectSummaryText_(project) {
  const endDateText =
    project.endDateDisplay || "No end date";

  const riskText =
    project.risks && project.risks.length
      ? `\nRisk: ${project.risks.join(", ")}`
      : "";

  return (
    `*${project.projectName}*\n` +
    `${project.projectStatus} | Ends ${endDateText} | ` +
    `${project.usage.toFixed(1)}% used | ` +
    `${project.totalRemaining} hrs left` +
    riskText
  );
}


/************************************
 * PROJECT DETAILS MODAL
 ************************************/

function openPortfolioProjectDetailsModal_(payload, userId) {
  const projectId =
    payload.actions[0].value;

  const triggerId =
    payload.trigger_id;

  const loadingView =
    buildPortfolioProjectDetailsLoadingModalView_();

  const opened =
    openSlackModal_(triggerId, loadingView);

  const viewId =
    opened.view?.id;

  if (!viewId) {
    return;
  }

  const project =
    getPortfolioProjectDetails_(projectId);

  const finalView =
    project
      ? buildPortfolioProjectDetailsModalView_(project)
      : buildPortfolioProjectDetailsNotFoundModalView_();

  updateSlackModal_(viewId, finalView);
}

function buildPortfolioProjectDetailsLoadingModalView_() {
  return {
    type: "modal",
    title: {
      type: "plain_text",
      text: "Project Details",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Close",
      emoji: true
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*Project Details*\n\n" +
            "Loading project information..."
        }
      }
    ]
  };
}

function buildPortfolioProjectDetailsNotFoundModalView_() {
  return {
    type: "modal",
    title: {
      type: "plain_text",
      text: "Project Details",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Close",
      emoji: true
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "I could not find this project."
        }
      }
    ]
  };
}

function buildPortfolioProjectDetailsModalView_(project) {
  const teamText =
    project.team.length
      ? project.team
          .map(member =>
            `• ${member.contractor} — ${member.role} — ` +
            `${member.billed}/${member.hours} hrs ` +
            `(${member.remaining} left)`
          )
          .join("\n")
      : "_No assigned contractors._";

  const risksText =
    project.risks.length
      ? project.risks.map(risk => `• ${risk}`).join("\n")
      : "_No current risk flags._";

  return {
    type: "modal",
    title: {
      type: "plain_text",
      text: "Project Details",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Close",
      emoji: true
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*${project.projectName}*\n\n` +
            `*Status:* ${project.projectStatus}\n` +
            `*Dates:* ${project.startDateDisplay || "-"} - ${project.endDateDisplay || "-"}\n` +
            `*Usage:* ${project.usage.toFixed(1)}%\n` +
            `*Hours:* ${project.totalBilled}/${project.totalHours} used\n` +
            `*Remaining:* ${project.totalRemaining} hrs`
        }
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*Team:*\n" +
            teamText
        }
      },
      {
        type: "divider"
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "*Risks:*\n" +
            risksText
        }
      }
    ]
  };
}
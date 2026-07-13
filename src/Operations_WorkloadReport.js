/************************************
 * IZA - Workload Report
 * File: workloadreport.gs
 ************************************/


/************************************
 * WORKLOAD SUMMARY
 ************************************/

function handleWorkloadReportButton_(channelId, messageTs, userId) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildWorkloadLoadingBlocks_(),
    "Loading Workload Report"
  );

  const report = buildManagementViewSections();

  updateIzaMenu(
    channelId,
    messageTs,
    buildWorkloadSummaryBlocks_(report),
    "Workload Report"
  );
}

function buildWorkloadLoadingBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "📦 *Workload Report*\n\nReviewing the Notion tables..."
      }
    }
  ];
}

function buildWorkloadSummaryBlocks_(report) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: report.summary
      }
    },
    {
      type: "actions",
      elements: [
        button_("⚫ Needs Allocation", "workload_needs_allocation"),
        button_("🟢 Less than 50%", "workload_under_50"),
        button_("🟡 More than 50%", "workload_over_50")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("🔴 Almost Completed", "workload_over_80"),
        button_("🚨 Overused", "workload_over_100")
      ]
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


/************************************
 * WORKLOAD CATEGORY DETAIL
 ************************************/

function handleWorkloadCategoryButton_(channelId, messageTs, categoryKey, title) {
  const report = buildManagementViewSections();
  const items = report[categoryKey] || [];

  const text =
    `*${title}*\n\n` +
    (items.length ? items.join("\n\n") : "None");

  updateIzaMenu(
    channelId,
    messageTs,
    buildWorkloadCategoryBlocks_(text),
    title
  );
}

function buildWorkloadCategoryBlocks_(text) {
  const safeText =
    text.length > 2900
      ? text.substring(0, 2900) + "\n\n_Report shortened for Slack._"
      : text;

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
        button_("⬅️ Back to Summary", "ops_workload"),
        button_("🏠 Main Menu", "menu_main")
      ]
    }
  ];
}
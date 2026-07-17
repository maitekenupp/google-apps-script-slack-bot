/************************************
 * IZA - Projects Overview
 * File: Projects_Overview.gs
 ************************************/


/************************************
 * PROJECTS OVERVIEW ENTRY POINT
 ************************************/

function handleProjectsOverviewButton_(channelId, messageTs, userId) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectsOverviewLoadingBlocks_(),
    "Loading Projects Overview"
  );

  const reportText =
    buildProjectsOverviewReport_();

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectsOverviewBlocks_(reportText),
    "Projects Overview"
  );
}


/************************************
 * PROJECTS OVERVIEW BLOCKS
 ************************************/

function buildProjectsOverviewLoadingBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "📋 *Projects Overview*\n\n" +
          "Reviewing the Notion project database..."
      }
    }
  ];
}

function buildProjectsOverviewBlocks_(reportText) {
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
        button_("🔄 Update Project Status", "project_status_update_start")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "admin_projects_menu")
      ]
    }
  ];
}
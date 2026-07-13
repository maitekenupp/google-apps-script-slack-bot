/************************************
 * IZA - Projects Overview
 * File: projectsoverview.gs
 ************************************/


/************************************
 * PROJECTS OVERVIEW BUTTON
 ************************************/

function handleProjectsOverviewButton_(channelId, messageTs, userId) {
  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectsOverviewLoadingBlocks_(),
    "Loading Projects Overview"
  );

  const reportText = buildProjectsOverviewReport_();

  updateIzaMenu(
    channelId,
    messageTs,
    buildProjectsOverviewBlocks_(reportText),
    "Projects Overview"
  );
}

function buildProjectsOverviewLoadingBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "📊 *Projects Overview*\n\nReviewing the Notion project database..."
      }
    }
  ];
}


/************************************
 * PROJECTS OVERVIEW BLOCKS
 ************************************/

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
        button_("⬅️ Back", "menu_projects"),
        button_("🏠 Main Menu", "menu_main")
      ]
    }
  ];
}

/******************************************************
 *
 * IZA
 * File: Bug_Report.gs
 *
 * Purpose:
 * Allows users to report bugs through a Slack modal.
 *
 ******************************************************/

function openBugReportModal_(triggerId, userId, channelId, messageTs) {
  const metadata = JSON.stringify({
    userId,
    channelId,
    messageTs
  });

  openSlackModal_(
    triggerId,
    buildBugReportModalView_(metadata)
  );
}

function buildBugReportModalView_(privateMetadata) {
  return {
    type: "modal",
    callback_id: "bug_report_submit",
    title: {
      type: "plain_text",
      text: "Report Bug",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Submit",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true
    },
    private_metadata: privateMetadata,
    blocks: [
      {
        type: "input",
        block_id: "bug_title_block",
        label: {
          type: "plain_text",
          text: "Title",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "bug_title_value",
          placeholder: {
            type: "plain_text",
            text: "Short title for the issue"
          }
        }
      },
      {
        type: "input",
        block_id: "bug_description_block",
        label: {
          type: "plain_text",
          text: "Describe the issue",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "bug_description_value",
          multiline: true,
          placeholder: {
            type: "plain_text",
            text: "What happened? What were you trying to do?"
          }
        }
      }
    ]
  };
}

function sendBugReportToErrorChannel_(report) {
  const timeText =
    Utilities.formatDate(
      new Date(),
      "America/Los_Angeles",
      "MMMM d, yyyy 'at' h:mm a"
    );

  sendSlackMessage(
    IZA_ERROR_CHANNEL,
    [
      "🐞 *Bug Report*",
      "",
      `*Reported by:* <@${report.userId}>`,
      `*Time:* ${timeText}`,
      "",
      `*Title:* ${report.title}`,
      "",
      "*Description:*",
      report.description
    ].join("\n")
  );
}

function getBugReportSlackUserName_(userId) {
  if (!userId) return "Unknown user";

  try {
    return getSlackUserName_(userId);
  } catch (err) {
    return userId;
  }
}

function handleBugReportModalSubmit_(payload) {
  const values = payload.view.state.values;
  const metadata = JSON.parse(payload.view.private_metadata || "{}");

  const title =
    values.bug_title_block.bug_title_value.value || "";

  const description =
    values.bug_description_block.bug_description_value.value || "";

  const userId =
    payload.user?.id ||
    metadata.userId ||
    "";

  sendBugReportToErrorChannel_({
    userId,
    title,
    description
  });

  if (metadata.channelId && metadata.messageTs) {
    updateIzaMenu(
      metadata.channelId,
      metadata.messageTs,
      buildBugReportSubmittedBlocks_(),
      "Bug Reported"
    );
  }

  return {
    response_action: "clear"
  };
}

function buildBugReportSubmittedBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🐞 *Bug reported!*\n\n" +
          "Thanks. I reported this to the tech team.\n\n" +
           "_Let’s hope it’s not an infestation_ :fist::pensive:"
      }
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "menu_main")
      ]
    }
  ];
}
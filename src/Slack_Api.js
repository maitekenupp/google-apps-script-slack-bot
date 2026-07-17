/******************************************************
 *
 * IZA
 * File: Slack_Api.gs
 *
 * Purpose:
 * Central Slack API communication layer.
 *
 * Responsibilities:
 * - Call Slack API methods
 * - Send Slack messages
 * - Update Slack messages
 * - Send ephemeral messages
 * - Open DMs
 * - Open modals
 *
 ******************************************************/


/************************************
 * CORE SLACK API CALLER
 ************************************/

function callSlackApi_(method, payload) {
  const token = PropertiesService
    .getScriptProperties()
    .getProperty("SLACK_BOT_TOKEN");

  if (!token) {
    throw new Error("Missing SLACK_BOT_TOKEN script property.");
  }

  const response = UrlFetchApp.fetch(
    `https://slack.com/api/${method}`,
    {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${token}`
      },
      payload: JSON.stringify(payload || {}),
      muteHttpExceptions: true
    }
  );

  const raw = response.getContentText();
  const result = JSON.parse(raw);

  if (!result.ok) {
    throw new Error(`${method} failed: ${result.error}`);
  }

  return result;
}


/************************************
 * PUBLIC MESSAGE HELPERS
 ************************************/

function sendSlackMessage(channelId, text, blocks) {
  const payload = {
    channel: channelId,
    text: text || "IZA message"
  };

  if (blocks) {
    payload.blocks = blocks;
  }

  return callSlackApi_("chat.postMessage", payload);
}

function updateIzaMenu(channelId, messageTs, blocks, text) {
  return callSlackApi_("chat.update", {
    channel: channelId,
    ts: messageTs,
    text: text || "IZA Menu",
    blocks: blocks || []
  });
}


/************************************
 * EPHEMERAL MESSAGE HELPER
 ************************************/

function sendEphemeralMessage(channelId, userId, text) {
  return callSlackApi_("chat.postEphemeral", {
    channel: channelId,
    user: userId,
    text: text || "IZA received your action."
  });
}


/************************************
 * DM HELPER
 ************************************/

function openSlackDm(userId) {
  const result = callSlackApi_("conversations.open", {
    users: userId
  });

  return result.channel.id;
}


/************************************
 * MODAL HELPER
 ************************************/

function openSlackModal_(triggerId, view) {
  return callSlackApi_("views.open", {
    trigger_id: triggerId,
    view
  });
}


/************************************
 * MAIN MENU MESSAGE
 ************************************/

function sendIzaMainMenu(channelId, userId) {
  return callSlackApi_("chat.postMessage", {
    channel: channelId,
    text: "IZA Main Menu",
    blocks: buildMainMenuBlocks_(userId)
  });
}


/************************************
 * BACKWARD COMPATIBILITY
 ************************************/

function slackApi_(method, payload) {
  return callSlackApi_(method, payload);
}
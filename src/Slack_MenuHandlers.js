/******************************************************
 *
 * IZA
 * File: Slack_MenuHandlers.gs
 *
 * Purpose:
 * Handles Slack text messages, mentions, and greetings.
 *
 * Responsibilities:
 * - Respond to @IZA mentions
 * - Respond to "Hi IZA" greetings
 * - Open DM menus
 * - Keep text-message routing simple
 *
 ******************************************************/


/************************************
 * APP MENTION HANDLER
 ************************************/

function handleIzaCommand(event) {
  const text = (event.text || "").toLowerCase();
  const channelId = event.channel;
  const userId = event.user;

  if (isGreeting(text)) {
    sendMainMenuToDm_(channelId, userId);
    return;
  }

  if (isManagementViewRequest_(text)) {
    sendManagementViewToDm_(channelId, userId);
    return;
  }

  sendMainMenuToDm_(channelId, userId);
}


/************************************
 * NORMAL MESSAGE HANDLER
 ************************************/

function handleMenuReply(event) {
  const text = (event.text || "").trim();
  const normalizedText = text.toLowerCase();

  const channelId = event.channel;
  const userId = event.user;

  const isDirectMessage =
    event.channel_type === "im" ||
    (channelId && channelId.startsWith("D"));

  if (!isGreeting(normalizedText)) {
    return;
  }

  if (isDirectMessage) {
    sendIzaMainMenu(channelId, userId);
    return;
  }

  if (normalizedText.includes("iza")) {
    sendMainMenuToDm_(channelId, userId);
  }
}


/************************************
 * DM MENU HELPERS
 ************************************/

function sendMainMenuToDm_(sourceChannelId, userId) {
  const dmChannelId = openSlackDm(userId);

  sendEphemeralMessage(
    sourceChannelId,
    userId,
    "Hi 👋 I sent your IZA menu in DM."
  );

  sendIzaMainMenu(dmChannelId, userId);
}

function sendManagementViewToDm_(sourceChannelId, userId) {
  const dmChannelId = openSlackDm(userId);

  sendEphemeralMessage(
    sourceChannelId,
    userId,
    "Got it 👋 I'll send this in DM."
  );

  const report = buildManagementView();

  sendSlackMessage(
    dmChannelId,
    report.summary
  );
}


/************************************
 * TEXT INTENT HELPERS
 ************************************/

function isGreeting(text) {
  return (
    text.includes("hi") ||
    text.includes("hello") ||
    text.includes("hey") ||
    text.includes("good morning") ||
    text.includes("good afternoon")
  );
}

function isManagementViewRequest_(text) {
  return (
    text.includes("management view") ||
    text.includes("portfolio") ||
    text.includes("project view")
  );
}
/******************************************************
 *
 * IZA
 * File: Slack_MenuHandlers.gs
 *
 * Purpose:
 * Handles Slack messages and app mentions.
 *
 * Responsibilities:
 * - Respond to @IZA mentions
 * - Respond to "Hi IZA" greetings
 * - Open DM menus
 * - Route active wizard text replies
 *
 ******************************************************/


/************************************
 * APP MENTION HANDLER
 ************************************/

function handleIzaCommand(event) {
  const text =
    (event.text || "").toLowerCase();

  const channelId =
    event.channel;

  const userId =
    event.user;

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
  const text =
    (event.text || "").trim();

  const normalizedText =
    text.toLowerCase();

  const channelId =
    event.channel;

  const userId =
    event.user;

  const isDirectMessage =
    event.channel_type === "im" ||
    (channelId && channelId.startsWith("D"));

  if (
    handleActiveWizardReply_(
      userId,
      channelId,
      text,
      isDirectMessage
    )
  ) {
    return;
  }

  if (!isGreeting(normalizedText)) {
    return;
  }

  if (isDirectMessage) {
    sendIzaMainMenu(channelId, userId);
    return;
  }

  if (normalizedText.includes("iza")) {
    sendMainMenuToDm_(channelId, userId);
    return;
  }
}


/************************************
 * ACTIVE WIZARD MESSAGE ROUTING
 ************************************/

function handleActiveWizardReply_(userId, channelId, text, isDirectMessage) {
  const projectSession =
    getProjectCreationSession_(userId);

  if (
    isDirectMessage &&
    projectSession &&
    projectSession.status === "creating_project"
  ) {
    handleProjectCreationReply_(userId, channelId, text);
    return true;
  }

  return false;
}


/************************************
 * DM MENU HELPERS
 ************************************/

function sendMainMenuToDm_(sourceChannelId, userId) {
  const dmChannelId =
    openSlackDm(userId);

  sendEphemeralMessage(
    sourceChannelId,
    userId,
    "Hi 👋 I sent your IZA menu in DM."
  );

  sendIzaMainMenu(dmChannelId, userId);
}

function sendManagementViewToDm_(sourceChannelId, userId) {
  const dmChannelId =
    openSlackDm(userId);

  sendEphemeralMessage(
    sourceChannelId,
    userId,
    "Got it 👋 I’ll send this in DM."
  );

  sendSlackMessage(
    dmChannelId,
    "📊 Sure thing. Give me a moment while I review the Notion tables..."
  );

  const reports =
    buildManagementViewSections();

  reports.forEach(message => {
    sendSlackMessage(dmChannelId, message);
  });
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
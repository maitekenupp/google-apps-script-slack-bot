function handleIzaCommand(event) {
  const text = (event.text || "").toLowerCase();
  const channelId = event.channel;
  const userId = event.user;

  if (!requireIzaAdmin_(userId, channelId)) {
    return;
  }

  if (isManagementViewRequest_(text)) {
    sendManagementViewToDm_(channelId, userId);
    return;
  }

  sendMainMenuToDm_(channelId, userId);
}

function handleMenuReply(event) {
  const text = (event.text || "").trim().toLowerCase();
  const channelId = event.channel;
  const userId = event.user;

  const isDirectMessage =
    event.channel_type === "im" ||
    (channelId && channelId.startsWith("D"));

  if (!isGreeting_(text)) {
    return;
  }

  if (!requireIzaAdmin_(userId, channelId)) {
    return;
  }

  if (isDirectMessage) {
    sendIzaMainMenu(channelId, userId);
    return;
  }

  if (text.includes("iza")) {
    sendMainMenuToDm_(channelId, userId);
  }
}

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
    "Got it 👋 I’ll send this in DM."
  );

  sendSlackMessage(
    dmChannelId,
    "📊 Sure thing. Give me a moment while I review the Notion tables..."
  );

  const reports = buildManagementViewSections();

  reports.forEach(message => {
    sendSlackMessage(dmChannelId, message);
  });
}

function isGreeting_(text) {
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
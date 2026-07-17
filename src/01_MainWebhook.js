/******************************************************
 *
 * IZA
 * File: 01_MainWebhook.gs
 *
 * Purpose:
 * Entry point for all Slack requests.
 *
 * Responsibilities:
 * - Receive Slack Events API requests
 * - Receive Slack Block Kit interactions
 * - Receive Slack modal submissions
 * - Route each request to the correct handler
 *
 ******************************************************/


/************************************
 * WEBHOOK ENTRY POINT
 ************************************/

function doPost(e) {
  try {
    if (!e || !e.postData) {
      return ContentService.createTextOutput("No postData");
    }

    const rawBody = e.postData.contents || "";

    if (e.parameter && e.parameter.payload) {
      const payload = JSON.parse(e.parameter.payload);
      return handleSlackInteractionPayload_(payload);
    }

    if (rawBody.indexOf("payload=") === 0) {
      const encodedPayload = rawBody.substring("payload=".length);
      const payload = JSON.parse(decodeURIComponent(encodedPayload));
      return handleSlackInteractionPayload_(payload);
    }

    const data = JSON.parse(rawBody);

    if (data.type === "url_verification") {
      return ContentService.createTextOutput(data.challenge);
    }

    if (isDuplicateSlackEvent_(data)) {
      return ContentService.createTextOutput("Already processed");
    }

    handleSlackEvent_(data);

    return ContentService.createTextOutput("OK");

  } catch (err) {
    handleWebhookError_(err);
    return ContentService.createTextOutput("ERROR");
  }
}


/************************************
 * SLACK INTERACTION ROUTER
 ************************************/

function handleSlackInteractionPayload_(payload) {
  if (payload.type === "block_actions") {
    handleIzaButtonClick_(payload);
    return ContentService.createTextOutput("");
  }

  if (payload.type === "view_submission") {
    const response = handleSlackViewSubmission_(payload);

    return ContentService
      .createTextOutput(
        JSON.stringify(response || { response_action: "clear" })
      )
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput("");
}


/************************************
 * SLACK EVENT ROUTER
 ************************************/

function handleSlackEvent_(data) {
  if (!data.event) return;

  const event = data.event;

  if (event.type === "file_shared") {
    saveSlackFileToDrive(event.file_id);
    return;
  }

  if (event.type === "app_mention") {
    handleIzaCommand(event);
    return;
  }

  if (
    event.type === "message" &&
    !event.bot_id &&
    !event.subtype
  ) {
    handleMenuReply(event);
    return;
  }
}


/************************************
 * DUPLICATE EVENT GUARD
 ************************************/

function isDuplicateSlackEvent_(data) {
  if (!data.event_id) return false;

  const props = PropertiesService.getScriptProperties();
  const eventKey = `EVENT_${data.event_id}`;

  if (props.getProperty(eventKey)) {
    return true;
  }

  props.setProperty(eventKey, new Date().toISOString());
  return false;
}


/************************************
 * DIRECT SLACK POST HELPER
 * Used by flows that send Block Kit messages directly.
 ************************************/

function postSlackMessage_(channelId, blocks, text) {
  const token =
    PropertiesService.getScriptProperties()
      .getProperty("SLACK_BOT_TOKEN");

  if (!token) {
    throw new Error("Missing SLACK_BOT_TOKEN script property.");
  }

  if (!channelId) {
    throw new Error("Missing channelId for Slack message.");
  }

  const payload = {
    channel: channelId,
    text: text || "IZA message",
    blocks: blocks || []
  };

  const response = UrlFetchApp.fetch(
    "https://slack.com/api/chat.postMessage",
    {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${token}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
  );

  const raw = response.getContentText();
  const result = JSON.parse(raw);

  if (!result.ok) {
    throw new Error(`Slack postMessage error: ${result.error} | ${raw}`);
  }

  return result;
}


/************************************
 * ERROR HANDLER
 ************************************/

function handleWebhookError_(err) {
  try {
    sendSlackMessage(
      IZA_ERROR_CHANNEL,
      [
        "❌ *IZA Error*",
        "",
        `*Time:* ${new Date().toLocaleString()}`,
        `*Message:* ${err.message}`,
        "",
        "```",
        err.stack || "No stack trace available",
        "```"
      ].join("\n")
    );
  } catch (ignore) {}
}
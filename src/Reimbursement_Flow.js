/******************************************************
 *
 * IZA
 * File: Reimbursement_Flow.gs
 *
 * Purpose:
 * Admin-only reimbursement tracker flow.
 * Uses a guided Slack message + tiny modals.
 *
 ******************************************************/


/************************************
 * FIELD ORDER
 ************************************/

const REIMBURSEMENT_FIELDS = [
  { key: "telecommunications", label: "Telecommunications", type: "amount" },
  { key: "homeOffice", label: "Home Office", type: "amount" },
  { key: "internet", label: "H.O. Internet", type: "amount" },
  { key: "electricity", label: "H.O. Electricity", type: "amount" },
  { key: "mileage", label: "Bus. Mileage", type: "mileage" },
  { key: "lodging", label: "Bus. Lodging", type: "amount" },
  { key: "meals", label: "Bus. Meals", type: "amount" },
  { key: "parking", label: "Bus. Parking", type: "amount" },
  { key: "gas", label: "H.O. Gas", type: "amount" },
  { key: "notes", label: "Notes", type: "notes" }
];


/************************************
 * CHANNEL ENTRY
 ************************************/

function handleReimbursementChannelGreeting_(event) {
  const channelId = event.channel;
  const userId = event.user;

  if (isDuplicateReimbursementGreeting_(event)) {
    return;
  }

  if (!isIzaAdmin_(userId)) {
    sendEphemeralMessage(
      channelId,
      userId,
      "This reimbursement workflow is only available to admins."
    );
    return;
  }

  if (!isInvoiceSubmissionWindowOpen_()) {
    sendSlackMessage(
      channelId,
      "💸 *Reimbursements*\n\nThe reimbursement window is currently closed."
    );
    return;
  }

  postSlackMessage_(
    channelId,
    buildReimbursementSummaryBlocks_(),
    "Reimbursements"
  );
}

function isDuplicateReimbursementGreeting_(event) {
  const cache = CacheService.getScriptCache();

  const channelId = event.channel || "";
  const userId = event.user || "";
  const eventTs = event.ts || event.event_ts || "";

  const text =
    String(event.text || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();

  const exactKey =
    `REIMBURSEMENT_GREETING_EXACT_${channelId}_${userId}_${eventTs}`;

  if (eventTs && cache.get(exactKey)) {
    return true;
  }

  if (eventTs) {
    cache.put(exactKey, "1", 60);
  }

  const textKey =
    `REIMBURSEMENT_GREETING_TEXT_${channelId}_${userId}_${text}`;

  if (cache.get(textKey)) {
    return true;
  }

  cache.put(textKey, "1", 60);
  return false;
}


/************************************
 * MAIN SUMMARY
 ************************************/

function handleReimbursementSummary_(channelId, messageTs) {
  if (!isInvoiceSubmissionWindowOpen_()) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildReimbursementClosedBlocks_(),
      "Reimbursements Closed"
    );
    return;
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildReimbursementSummaryBlocks_(),
    "Reimbursements"
  );
}

function buildReimbursementSummaryBlocks_() {
  const billingPeriod =
    getReimbursementBillingPeriod_();

  const billingPeriodText =
    invoiceFormatShortDate_(billingPeriod);

  const month =
    formatReimbursementMonth_(billingPeriod);

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "💸 *Reimbursements*\n\n" +
          `*Billing period:* ${billingPeriodText}\n` +
          `*Sheet month:* ${month}\n\n` +
          "*Current tracker summary:*\n" +
          buildReimbursementAllPeopleSummaryText_(month) +
          "\n\nSelect who you want to update."
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Anthony",
            emoji: true
          },
          action_id: "reimbursement_select_anthony",
          value: "anthony"
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Cindy",
            emoji: true
          },
          action_id: "reimbursement_select_cindy",
          value: "cindy"
        }
      ]
    },
    {
      type: "actions",
      elements: [
        button_("Close", "reimbursement_close")
      ]
    }
  ];
}


/************************************
 * PERSON FLOW
 ************************************/

function handleReimbursementPersonSelect_(channelId, messageTs, userId, personValue) {
  const person =
    REIMBURSEMENT_PEOPLE.find(item => item.value === personValue);

  if (!person) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildReimbursementErrorBlocks_({
        message: "Person not found."
      }),
      "Reimbursement Error"
    );
    return;
  }

  const billingPeriod =
    getReimbursementBillingPeriod_();

  const month =
    formatReimbursementMonth_(billingPeriod);

  const current =
    loadReimbursementSummaryForPerson_(person, month);

  const session = {
    channelId,
    messageTs,
    userId,
    person,
    month,
    selectedFieldKey: "",
    values: reimbursementSummaryToDraft_(current),
    createdAt: new Date().toISOString()
  };

  saveReimbursementSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildReimbursementEditBlocks_(session),
    "Reimbursement Entry"
  );
}

function reimbursementSummaryToDraft_(summary) {
  const mileage =
    Number(summary.mileage || 0);

  return {
    telecommunications: Number(summary.telecommunications || 0),
    homeOffice: Number(summary.homeOffice || 0),
    internet: Number(summary.internet || 0),
    electricity: Number(summary.electricity || 0),
    mileage,
    mileageMiles: mileage
      ? roundReimbursementMiles_(mileage / REIMBURSEMENT_MILEAGE_RATE)
      : "",
    lodging: Number(summary.lodging || 0),
    meals: Number(summary.meals || 0),
    parking: Number(summary.parking || 0),
    gas: Number(summary.gas || 0),
    notes: summary.notes || ""
  };
}

function handleReimbursementFieldSelect_(payload, channelId, messageTs, userId) {
  const session =
    getReimbursementSession_(userId);

  if (!session) {
    handleReimbursementSummary_(channelId, messageTs);
    return;
  }

  session.selectedFieldKey =
    payload.actions[0].selected_option?.value || "";

  saveReimbursementSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildReimbursementEditBlocks_(session),
    "Reimbursement Entry"
  );
}

function handleReimbursementNextStep_(channelId, messageTs, userId) {
  const session =
    getReimbursementSession_(userId);

  if (!session) {
    handleReimbursementSummary_(channelId, messageTs);
    return;
  }

  session.stepIndex =
    Math.min(
      session.stepIndex + 1,
      REIMBURSEMENT_FIELDS.length
    );

  saveReimbursementSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildReimbursementStepBlocks_(session),
    "Reimbursement Entry"
  );
}

function handleReimbursementPreviousStep_(channelId, messageTs, userId) {
  const session =
    getReimbursementSession_(userId);

  if (!session) {
    handleReimbursementSummary_(channelId, messageTs);
    return;
  }

  session.stepIndex =
    Math.max(session.stepIndex - 1, 0);

  saveReimbursementSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    buildReimbursementStepBlocks_(session),
    "Reimbursement Entry"
  );
}

function handleReimbursementCancel_(channelId, messageTs, userId) {
  clearReimbursementSession_(userId);

  updateIzaMenu(
    channelId,
    messageTs,
    buildReimbursementSummaryBlocks_(),
    "Reimbursements"
  );
}

function handleReimbursementClose_(channelId, messageTs) {
  updateIzaMenu(
    channelId,
    messageTs,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "💸 *Reimbursements closed.*"
        }
      }
    ],
    "Reimbursements Closed"
  );
}


/************************************
 * TINY MODAL
 ************************************/

function handleReimbursementEnterValue_(payload, channelId, messageTs, userId) {
  const session =
    getReimbursementSession_(userId);

  if (!session) {
    handleReimbursementSummary_(channelId, messageTs);
    return;
  }

  const field =
    REIMBURSEMENT_FIELDS.find(item =>
      item.key === session.selectedFieldKey
    );

  if (!field) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildReimbursementEditBlocks_(session),
      "Reimbursement Entry"
    );
    return;
  }

  if (field.key === "mileage") {
    handleReimbursementEnterMiles_(
      payload,
      channelId,
      messageTs,
      userId
    );
    return;
  }

  openSlackModal_(
    payload.trigger_id,
    buildReimbursementValueModalView_(session, field)
  );
}

function buildReimbursementValueModalView_(session, field) {
  const isNotes =
    field.type === "notes";

  const label =
    field.type === "mileage"
      ? `${field.label} - amount`
      : field.label;

  const currentValue =
    session.values[field.key] || "";

  const element = {
    type: "plain_text_input",
    action_id: "value_input",
    multiline: isNotes,
    placeholder: {
      type: "plain_text",
      text: isNotes ? "Add notes" : "0.00"
    }
  };

  if (String(currentValue || "").trim()) {
    element.initial_value = String(currentValue);
  }

  return {
    type: "modal",
    callback_id: "reimbursement_value_modal_submit",
    title: {
      type: "plain_text",
      text: "Reimbursement",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Save",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true
    },
    private_metadata: JSON.stringify({
      userId: session.userId,
      fieldKey: field.key
    }),
    blocks: [
      {
        type: "input",
        block_id: "value_block",
        optional: true,
        label: {
          type: "plain_text",
          text: label,
          emoji: true
        },
        element
      }
    ]
  };
}

function handleReimbursementValueModalSubmit_(payload) {
  const metadata =
    JSON.parse(payload.view.private_metadata || "{}");

  const userId =
    metadata.userId || payload.user.id;

  const fieldKey =
    metadata.fieldKey || "";

  const session =
    getReimbursementSession_(userId);

  if (!session) {
    return {
      response_action: "clear"
    };
  }

  const field =
    REIMBURSEMENT_FIELDS.find(item => item.key === fieldKey);

  if (!field) {
    return {
      response_action: "clear"
    };
  }

  const raw =
    payload.view.state.values.value_block.value_input.value || "";

  if (field.type !== "notes") {
    const parsed =
      parseReimbursementNumber_(raw);

    if (parsed === null) {
      return {
        response_action: "errors",
        errors: {
          value_block: "Please enter a valid number."
        }
      };
    }

    session.values[field.key] = parsed;
  } else {
    session.values[field.key] = raw;
  }

  saveReimbursementSession_(userId, session);

  updateIzaMenu(
    session.channelId,
    session.messageTs,
    buildReimbursementEditBlocks_(session),
    "Reimbursement Entry"
  );

  return {
    response_action: "clear"
  };
}

function buildReimbursementEditBlocks_(session) {
  const selectedField =
    REIMBURSEMENT_FIELDS.find(field =>
      field.key === session.selectedFieldKey
    );

  const actionButtons =
    selectedField?.key === "mileage"
      ? [
          button_("Enter Miles", "reimbursement_enter_miles")
        ]
      : [
          button_("Enter / Edit Value", "reimbursement_enter_value")
        ];

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "💸 *Reimbursement Entry*\n\n" +
          `*Person:* ${session.person.label}\n` +
          `*Month:* ${session.month}\n\n` +
          "*Current tracker values:*\n" +
          buildReimbursementDraftSummaryLines_(session.values) +
          `\n\n*Selected field:* ${selectedField?.label || "-"}`
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "static_select",
          action_id: "reimbursement_field_select",
          placeholder: {
            type: "plain_text",
            text: "Select field",
            emoji: true
          },
          options: REIMBURSEMENT_FIELDS.map(field => ({
            text: {
              type: "plain_text",
              text: field.label,
              emoji: true
            },
            value: field.key
          })),
          ...(selectedField
            ? {
                initial_option: {
                  text: {
                    type: "plain_text",
                    text: selectedField.label,
                    emoji: true
                  },
                  value: selectedField.key
                }
              }
            : {})
        },
        ...actionButtons
      ]
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Save to Sheet",
            emoji: true
          },
          style: "primary",
          action_id: "reimbursement_save_confirm"
        },
        button_("⬅️ Summary", "reimbursement_summary"),
        button_("Cancel", "reimbursement_cancel")
      ]
    }
  ];
}

function handleReimbursementEnterMiles_(payload, channelId, messageTs, userId) {
  const session =
    getReimbursementSession_(userId);

  if (!session) {
    handleReimbursementSummary_(channelId, messageTs);
    return;
  }

  session.selectedFieldKey = "mileage";
  saveReimbursementSession_(userId, session);

  openSlackModal_(
    payload.trigger_id,
    buildReimbursementMilesModalView_(session)
  );
}

function buildReimbursementMilesModalView_(session) {
  const currentMiles =
    session.values.mileageMiles || "";

  const element = {
    type: "plain_text_input",
    action_id: "miles_input",
    placeholder: {
      type: "plain_text",
      text: "0"
    }
  };

  if (String(currentMiles || "").trim()) {
    element.initial_value = String(currentMiles);
  }

  return {
    type: "modal",
    callback_id: "reimbursement_miles_modal_submit",
    title: {
      type: "plain_text",
      text: "Mileage",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Save",
      emoji: true
    },
    close: {
      type: "plain_text",
      text: "Cancel",
      emoji: true
    },
    private_metadata: JSON.stringify({
      userId: session.userId
    }),
    blocks: [
      {
        type: "input",
        block_id: "miles_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "Business miles",
          emoji: true
        },
        element
      }
    ]
  };
}

function handleReimbursementMilesModalSubmit_(payload) {
  const metadata =
    JSON.parse(payload.view.private_metadata || "{}");

  const userId =
    metadata.userId || payload.user.id;

  const session =
    getReimbursementSession_(userId);

  if (!session) {
    return {
      response_action: "clear"
    };
  }

  const raw =
    payload.view.state.values.miles_block.miles_input.value || "";

  const miles =
    parseReimbursementNumber_(raw);

  if (miles === null) {
    return {
      response_action: "errors",
      errors: {
        miles_block: "Please enter a valid number of miles."
      }
    };
  }

  session.values.mileageMiles = miles;
  session.values.mileage =
    reimbursementMileageAmount_(miles);

  session.values.notes =
    mergeReimbursementNotes_(
      removeMileageNote_(session.values.notes),
      miles > 0
        ? `${miles} miles x ${REIMBURSEMENT_MILEAGE_RATE} per mile`
        : ""
    );

  saveReimbursementSession_(userId, session);

  updateIzaMenu(
    session.channelId,
    session.messageTs,
    buildReimbursementEditBlocks_(session),
    "Reimbursement Entry"
  );

  return {
    response_action: "clear"
  };
}

function roundReimbursementMiles_(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function removeMileageNote_(notes) {
  return String(notes || "")
    .split("\n")
    .filter(line =>
      !line.toLowerCase().includes("miles x") &&
      !line.toLowerCase().includes("per mile")
    )
    .join("\n")
    .trim();
}


/************************************
 * FINAL SAVE
 ************************************/

function handleReimbursementSaveConfirm_(channelId, messageTs, userId) {
  const session =
    getReimbursementSession_(userId);

  if (!session) {
    handleReimbursementSummary_(channelId, messageTs);
    return;
  }

  updateIzaMenu(
    channelId,
    messageTs,
    buildReimbursementSavingBlocks_(session.person),
    "Saving Reimbursement"
  );

  try {
    const saved =
      addOrUpdateReimbursementRow_(
        session.person,
        session.month,
        session.values
      );

    clearReimbursementSession_(userId);

    updateIzaMenu(
      channelId,
      messageTs,
      buildReimbursementSavedBlocks_(
        session.person,
        session.month,
        saved
      ),
      "Reimbursement Saved"
    );

  } catch (err) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildReimbursementErrorBlocks_(err),
      "Reimbursement Error"
    );

    handleWebhookError_(err);
  }
}


/************************************
 * BLOCKS
 ************************************/

function buildReimbursementStepBlocks_(session) {
  if (session.stepIndex >= REIMBURSEMENT_FIELDS.length) {
    return buildReimbursementReviewBlocks_(session);
  }

  const field =
    REIMBURSEMENT_FIELDS[session.stepIndex];

  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "💸 *Reimbursement Entry*\n\n" +
          `*Person:* ${session.person.label}\n` +
          `*Month:* ${session.month}\n\n` +
          "*This entry so far:*\n" +
          buildReimbursementDraftSummaryLines_(session.values) +
          "\n\n" +
          `*Current step:* ${field.label}\n` +
          getReimbursementFieldInstruction_(field)
      }
    },
    {
      type: "actions",
      elements: buildReimbursementStepButtons_(session)
    }
  ];
}

function buildReimbursementStepButtons_(session) {
  const buttons = [];

  if (session.stepIndex > 0) {
    buttons.push(button_("⬅️ Previous", "reimbursement_previous_step"));
  }

  buttons.push(button_("Enter Value", "reimbursement_enter_value"));
  buttons.push(button_("Next", "reimbursement_next_step"));
  buttons.push(button_("Cancel", "reimbursement_cancel"));

  return buttons;
}

function buildReimbursementReviewBlocks_(session) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "💸 *Review Reimbursement*\n\n" +
          `*Person:* ${session.person.label}\n` +
          `*Month:* ${session.month}\n\n` +
          buildReimbursementDraftSummaryLines_(session.values) +
          `\n\n*Entry total:* ${invoiceFormatMoney_(calculateReimbursementDraftTotal_(session.values))}\n\n` +
          "After saving, please upload the related receipts/documents in this chat."
      }
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Previous", "reimbursement_previous_step"),
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "Save to Sheet",
            emoji: true
          },
          style: "primary",
          action_id: "reimbursement_save_confirm"
        },
        button_("Cancel", "reimbursement_cancel")
      ]
    }
  ];
}

function buildReimbursementSavedBlocks_(person, month, saved) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "✅ *Reimbursement saved*\n\n" +
          `*Person:* ${person.label}\n` +
          `*Month:* ${month}\n\n` +
          "*Updated monthly summary:*\n" +
          buildReimbursementSummaryLines_(saved) +
          `\n\n*Total:* ${invoiceFormatMoney_(saved.total)}\n\n` +
          "Please upload the related receipts/documents in this chat as well."
      }
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "➕ Add More",
            emoji: true
          },
          action_id: `reimbursement_select_${person.value}`,
          value: person.value
        },
        button_("⬅️ Summary", "reimbursement_summary"),
        button_("Close", "reimbursement_close")
      ]
    }
  ];
}

function buildReimbursementSavingBlocks_(person) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "💸 *Reimbursements*\n\n" +
          `Updating ${person.label}'s reimbursement tracker...`
      }
    }
  ];
}

function buildReimbursementClosedBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "💸 *Reimbursements*\n\n" +
          "The reimbursement window is currently closed."
      }
    },
    {
      type: "actions",
      elements: [
        button_("Close", "reimbursement_close")
      ]
    }
  ];
}

function buildReimbursementErrorBlocks_(err) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "❌ *I had trouble saving this reimbursement.*\n\n" +
          `Error: ${err.message}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Summary", "reimbursement_summary"),
        button_("Close", "reimbursement_close")
      ]
    }
  ];
}


/************************************
 * SUMMARY TEXT
 ************************************/

function buildReimbursementAllPeopleSummaryText_(month) {
  return REIMBURSEMENT_PEOPLE
    .map(person => {
      const summary =
        loadReimbursementSummaryForPerson_(person, month);

      return (
        `*${person.label}:* ${invoiceFormatMoney_(summary.total)}\n` +
        buildReimbursementSummaryLines_(summary)
      );
    })
    .join("\n\n");
}

function buildReimbursementSummaryLines_(saved) {
  const lines = [
    ["Telecommunications", saved.telecommunications],
    ["Home Office", saved.homeOffice],
    ["H.O. Internet", saved.internet],
    ["H.O. Electricity", saved.electricity],
    ["Bus. Mileage", saved.mileage],
    ["Bus. Lodging", saved.lodging],
    ["Bus. Meals", saved.meals],
    ["Bus. Parking", saved.parking],
    ["H.O. Gas", saved.gas]
  ];

  return lines
    .map(item => `• ${item[0]}: ${invoiceFormatMoney_(item[1])}`)
    .join("\n");
}

function buildReimbursementDraftSummaryLines_(values) {
  const summary = {
    telecommunications: values.telecommunications,
    homeOffice: values.homeOffice,
    internet: values.internet,
    electricity: values.electricity,
    mileage: values.mileage,
    lodging: values.lodging,
    meals: values.meals,
    parking: values.parking,
    gas: values.gas
  };

  let text =
    buildReimbursementSummaryLines_(summary);

  if (Number(values.mileage || 0) > 0) {
    const miles =
      values.mileageMiles ||
      roundReimbursementMiles_(
        Number(values.mileage || 0) / REIMBURSEMENT_MILEAGE_RATE
      );

    text += `\n• Mileage miles: ${miles}`;
  }

  if (values.notes) {
    text += `\n• Notes: ${values.notes}`;
  }

  return text;
}

function getReimbursementFieldInstruction_(field) {
  if (field.type === "mileage") {
    return "Click *Enter Value* and enter the number of miles.";
  }

  if (field.type === "notes") {
    return "Click *Enter Value* and add any notes.";
  }

  return "Click *Enter Value* and enter the amount.";
}


/************************************
 * SHEET WRITE
 ************************************/

function addOrUpdateReimbursementRow_(person, month, data) {
  const sheet =
    SpreadsheetApp
      .openById(REIMBURSEMENT_SPREADSHEET_ID)
      .getSheetByName(person.sheetName);

  if (!sheet) {
    throw new Error(`Missing reimbursement sheet tab: ${person.sheetName}`);
  }

  let row =
    findReimbursementMonthRow_(sheet, month);

  if (!row) {
    row = Math.max(2, sheet.getLastRow() + 1);
  }

  const total =
    calculateReimbursementDraftTotal_(data);

  const rowValues = [
    month,
    Number(data.telecommunications || 0),
    Number(data.homeOffice || 0),
    Number(data.internet || 0),
    Number(data.electricity || 0),
    Number(data.mileage || 0),
    Number(data.lodging || 0),
    Number(data.meals || 0),
    Number(data.parking || 0),
    Number(data.gas || 0),
    total,
    data.notes || ""
  ];

  sheet
    .getRange(row, 1, 1, rowValues.length)
    .setValues([rowValues]);

  sheet
    .getRange(row, 2, 1, 10)
    .setNumberFormat("$#,##0.00");

  sheet
    .getRange(row, 11)
    .setNumberFormat("$#,##0.00");

  return {
    row,
    telecommunications: rowValues[1],
    homeOffice: rowValues[2],
    internet: rowValues[3],
    electricity: rowValues[4],
    mileage: rowValues[5],
    lodging: rowValues[6],
    meals: rowValues[7],
    parking: rowValues[8],
    gas: rowValues[9],
    total: rowValues[10],
    notes: rowValues[11]
  };
}


/************************************
 * SHEET READ
 ************************************/

function loadReimbursementSummaryForPerson_(person, month) {
  const sheet =
    SpreadsheetApp
      .openById(REIMBURSEMENT_SPREADSHEET_ID)
      .getSheetByName(person.sheetName);

  if (!sheet) {
    throw new Error(`Missing reimbursement sheet tab: ${person.sheetName}`);
  }

  const row =
    findReimbursementMonthRow_(sheet, month);

  if (!row) {
    return emptyReimbursementSummary_();
  }

  const values =
    sheet
      .getRange(row, 1, 1, 12)
      .getValues()[0];

  return {
    row,
    telecommunications: Number(values[1] || 0),
    homeOffice: Number(values[2] || 0),
    internet: Number(values[3] || 0),
    electricity: Number(values[4] || 0),
    mileage: Number(values[5] || 0),
    lodging: Number(values[6] || 0),
    meals: Number(values[7] || 0),
    parking: Number(values[8] || 0),
    gas: Number(values[9] || 0),
    total: Number(values[10] || 0),
    notes: values[11] || ""
  };
}

function findReimbursementMonthRow_(sheet, month) {
  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const months =
    sheet
      .getRange(2, 1, lastRow - 1, 1)
      .getDisplayValues();

  for (let i = 0; i < months.length; i++) {
    if (String(months[i][0] || "").trim() === month) {
      return i + 2;
    }
  }

  return null;
}


/************************************
 * SESSION
 ************************************/

function saveReimbursementSession_(userId, session) {
  PropertiesService
    .getScriptProperties()
    .setProperty(
      `REIMBURSEMENT_SESSION_${userId}`,
      JSON.stringify(session)
    );
}

function getReimbursementSession_(userId) {
  const raw =
    PropertiesService
      .getScriptProperties()
      .getProperty(`REIMBURSEMENT_SESSION_${userId}`);

  return raw ? JSON.parse(raw) : null;
}

function clearReimbursementSession_(userId) {
  PropertiesService
    .getScriptProperties()
    .deleteProperty(`REIMBURSEMENT_SESSION_${userId}`);
}


/************************************
 * CLOSE SUMMARY
 ************************************/

function buildReimbursementWindowCloseSummary_() {
  const billingPeriod =
    getReimbursementBillingPeriod_();

  const month =
    formatReimbursementMonth_(billingPeriod);

  let text =
    "💸 *Reimbursement Window Closed*\n\n" +
    `*Month:* ${month}\n\n`;

  let grandTotal = 0;

  REIMBURSEMENT_PEOPLE.forEach(person => {
    const summary =
      loadReimbursementSummaryForPerson_(person, month);

    grandTotal += Number(summary.total || 0);

    text +=
      `*${person.label}:* ${invoiceFormatMoney_(summary.total)}\n`;
  });

  text +=
    `\n*Total reimbursements:* ${invoiceFormatMoney_(grandTotal)}`;

  return text.trim();
}


/************************************
 * GENERIC HELPERS
 ************************************/

function getReimbursementBillingPeriod_() {
  const window =
    getInvoiceSubmissionWindow_();

  return window.billingPeriod || invoiceLastDayOfCurrentMonth_();
}

function buildEmptyReimbursementDraft_() {
  return {
    telecommunications: 0,
    homeOffice: 0,
    internet: 0,
    electricity: 0,
    mileage: 0,
    mileageMiles: "",
    lodging: 0,
    meals: 0,
    parking: 0,
    gas: 0,
    notes: ""
  };
}

function emptyReimbursementSummary_() {
  return {
    telecommunications: 0,
    homeOffice: 0,
    internet: 0,
    electricity: 0,
    mileage: 0,
    lodging: 0,
    meals: 0,
    parking: 0,
    gas: 0,
    total: 0,
    notes: ""
  };
}

function calculateReimbursementDraftTotal_(values) {
  return roundReimbursementMoney_(
    Number(values.telecommunications || 0) +
    Number(values.homeOffice || 0) +
    Number(values.internet || 0) +
    Number(values.electricity || 0) +
    Number(values.mileage || 0) +
    Number(values.lodging || 0) +
    Number(values.meals || 0) +
    Number(values.parking || 0) +
    Number(values.gas || 0)
  );
}

function reimbursementMileageAmount_(miles) {
  return roundReimbursementMoney_(
    Number(miles || 0) * REIMBURSEMENT_MILEAGE_RATE
  );
}

function mergeReimbursementNotes_(existingNotes, newNotes) {
  return [
    String(existingNotes || "").trim(),
    String(newNotes || "").trim()
  ]
    .filter(Boolean)
    .join("\n");
}

function parseReimbursementNumber_(raw) {
  const text =
    String(raw || "")
      .replace(/[$,]/g, "")
      .trim();

  if (!text) {
    return 0;
  }

  const value =
    Number(text);

  if (isNaN(value) || value < 0) {
    return null;
  }

  return value;
}

function formatReimbursementMonth_(dateString) {
  const date =
    new Date(`${dateString}T00:00:00`);

  return Utilities.formatDate(
    date,
    "America/Los_Angeles",
    "MMM-yy"
  );
}

function roundReimbursementMoney_(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
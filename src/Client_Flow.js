function openClientModal_(userId, channelId, messageTs, triggerId) {
  const metadata = JSON.stringify({
    userId,
    channelId,
    messageTs
  });

  const view = buildClientModalView_(metadata);

  openSlackModal_(triggerId, view);
}

function openClientEditModal_(userId, channelId, messageTs, triggerId) {
  const session = getClientSession_(userId);

  if (!session || !session.clientData) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildProjectsMenuBlocks_(),
      "IZA Projects Menu"
    );
    return;
  }

  const metadata = JSON.stringify({
    userId,
    channelId,
    messageTs
  });

  const view = buildClientModalView_(
    metadata,
    session.clientData
  );

  openSlackModal_(triggerId, view);
}

function buildClientModalView_(privateMetadata, clientData) {
  clientData = clientData || {};

  const clientTypes = ["RFP", "Non-RFP"];
  const selectedClientType = clientData.clientType || "";

  return {
    type: "modal",
    callback_id: "client_modal_submit",
    title: {
      type: "plain_text",
      text: "New Client",
      emoji: true
    },
    submit: {
      type: "plain_text",
      text: "Review",
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
        block_id: "client_name_block",
        label: {
          type: "plain_text",
          text: "Client Name",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "client_name_value",
          ...(clientData.name
            ? { initial_value: clientData.name }
            : {})
        }
      },
      {
        type: "input",
        block_id: "client_type_block",
        label: {
          type: "plain_text",
          text: "Client Type",
          emoji: true
        },
        element: {
          type: "static_select",
          action_id: "client_type_value",
          placeholder: {
            type: "plain_text",
            text: "Select client type",
            emoji: true
          },
          options: clientTypes.map(type => ({
            text: {
              type: "plain_text",
              text: type,
              emoji: true
            },
            value: type
          })),
          ...(selectedClientType
            ? {
                initial_option: {
                  text: {
                    type: "plain_text",
                    text: selectedClientType,
                    emoji: true
                  },
                  value: selectedClientType
                }
              }
            : {})
        }
      },
      {
        type: "input",
        block_id: "contact_person_block",
        label: {
          type: "plain_text",
          text: "Contact Person",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "contact_person_value",
          ...(clientData.contactPerson
            ? { initial_value: clientData.contactPerson }
            : {})
        }
      },
      {
        type: "input",
        block_id: "contact_email_block",
        label: {
          type: "plain_text",
          text: "Contact Email",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "contact_email_value",
          ...(clientData.contactEmail
            ? { initial_value: clientData.contactEmail }
            : {})
        }
      },
      {
        type: "input",
        block_id: "phone_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "Phone Number",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "phone_value",
          ...(clientData.phoneNumber
            ? { initial_value: clientData.phoneNumber }
            : {})
        }
      },
      {
        type: "input",
        block_id: "address_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "Address",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "address_value",
          multiline: true,
          ...(clientData.address
            ? { initial_value: clientData.address }
            : {})
        }
      },
      {
        type: "input",
        block_id: "website_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "Website",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "website_value",
          ...(clientData.website
            ? { initial_value: clientData.website }
            : {})
        }
      },
      {
        type: "input",
        block_id: "notes_block",
        optional: true,
        label: {
          type: "plain_text",
          text: "Notes",
          emoji: true
        },
        element: {
          type: "plain_text_input",
          action_id: "notes_value",
          multiline: true,
          ...(clientData.notes
            ? { initial_value: clientData.notes }
            : {})
        }
      }
    ]
  };
}

function handleClientModalSubmit_(payload) {
  const metadata = JSON.parse(payload.view.private_metadata);
  const values = payload.view.state.values;

  const clientData = {
    name:
      values.client_name_block.client_name_value.value,
    clientType:
      values.client_type_block.client_type_value.selected_option.value,
    contactPerson:
      values.contact_person_block.contact_person_value.value,
    contactEmail:
      values.contact_email_block.contact_email_value.value,
    phoneNumber:
      values.phone_block.phone_value.value || "",
    address:
      values.address_block.address_value.value || "",
    website:
      values.website_block.website_value.value || "",
    notes:
      values.notes_block.notes_value.value || ""
  };

  saveClientSession_(metadata.userId, {
    status: "reviewing_client",
    clientData,
    userId: metadata.userId,
    channelId: metadata.channelId,
    messageTs: metadata.messageTs,
    lastActivity: Date.now()
  });

  updateIzaMenu(
    metadata.channelId,
    metadata.messageTs,
    buildClientReviewBlocks_(clientData),
    "Review Client"
  );

  return { response_action: "clear" };
}

function buildClientReviewBlocks_(clientData) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          "🏢 *Review Client*\n\n" +
          `*Name:* ${clientData.name || "-"}\n` +
          `*Client Type:* ${clientData.clientType || "-"}\n` +
          `*Contact Person:* ${clientData.contactPerson || "-"}\n` +
          `*Contact Email:* ${clientData.contactEmail || "-"}\n` +
          `*Phone:* ${clientData.phoneNumber || "-"}\n` +
          `*Address:* ${clientData.address || "-"}\n` +
          `*Website:* ${clientData.website || "-"}\n` +
          `*Notes:* ${clientData.notes || "-"}`
      }
    },
    {
      type: "actions",
      elements: [
        button_("✅ Create Client", "client_create_confirm"),
        button_("✏️ Edit", "client_edit"),
        button_("❌ Cancel", "client_create_cancel")
      ]
    }
  ];
}

function handleClientCreateConfirm_(userId, channelId, messageTs) {
  const session = getClientSession_(userId);

  if (!session || !session.clientData) {
    updateIzaMenu(
      channelId,
      messageTs,
      buildProjectsMenuBlocks_(),
      "IZA Projects Menu"
    );
    return;
  }

  if (
    session.status === "creating_client" ||
    session.status === "client_created"
  ) {
    return;
  }

  const clientName = session.clientData.name || "New Client";

  session.status = "creating_client";
  session.lastActivity = Date.now();
  saveClientSession_(userId, session);

  updateIzaMenu(
    channelId,
    messageTs,
    [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            "⏳ *Creating client in Notion...*\n\n" +
            `*${clientName}*\n\n` +
            "Please wait a moment."
        }
      }
    ],
    "Creating Client"
  );

  try {
    const client = createNotionClient_(session.clientData);

    session.status = "client_created";
    session.createdClient = {
      ...client,
      name: clientName
    };
    session.lastActivity = Date.now();

    saveClientSession_(userId, session);

    CacheService
      .getScriptCache()
      .remove("NOTION_CLIENT_OPTIONS");

    updateIzaMenu(
      channelId,
      messageTs,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "🎉 *Client created successfully!*\n\n" +
              `*${clientName}*\n\n` +
              `<${client.url}|📂 Open in Notion>`
          }
        },
        {
          type: "actions",
          elements: [
            button_("➕ New Project", "project_new"),
            button_("📋 Projects", "menu_projects"),
            button_("👋 Bye IZA", "menu_close")
          ]
        }
      ],
      "Client Created"
    );

  } catch (err) {
    session.status = "client_create_failed";
    session.lastError = err.message;
    session.lastActivity = Date.now();

    saveClientSession_(userId, session);

    updateIzaMenu(
      channelId,
      messageTs,
      [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              "❌ *I had trouble creating this client in Notion.*\n\n" +
              `*${clientName}*\n\n` +
              `Error: ${err.message}`
          }
        },
        {
          type: "actions",
          elements: [
            button_("⬅️ Projects", "menu_projects"),
            button_("🏠 Main Menu", "menu_main")
          ]
        }
      ],
      "Client Creation Failed"
    );
  }
}
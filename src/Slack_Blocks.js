function button_(text, actionId) {
  return {
    type: "button",
    text: {
      type: "plain_text",
      text,
      emoji: true
    },
    action_id: actionId,
    value: actionId
  };
}

function buildMainMenuBlocks_(userId) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `Hi <@${userId}> 👋\nHow can I help you today?`
      }
    },
    {
      type: "actions",
      elements: [
        button_("📊 Projects", "menu_projects"),
        button_("👥 Operations", "menu_operations"),
        button_("🐞 Report Bug", "bug_report_open")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("👋 Bye IZA", "menu_close")
      ]
    }
  ];
}

function buildProjectsMenuBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "📊 *Projects*"
      }
    },
    {
      type: "actions",
      elements: [
        button_("📋 Overview", "projects_overview"),
        button_("➕ Create", "projects_create_menu"),
        button_("🛠️ Admin", "projects_admin_menu")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "menu_main")
      ]
    }
  ];
}

function buildProjectsCreateMenuBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "➕ *Create*"
      }
    },
    {
      type: "actions",
      elements: [
        button_("📁 New Project", "project_new"),
        button_("🏢 New Client", "client_new")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "menu_projects")
      ]
    }
  ];
}

function buildProjectsAdminMenuBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "🛠️ *Projects Admin*"
      }
    },
    {
      type: "actions",
      elements: [
        button_("👥 Add Roles", "existing_project_add_roles"),
        button_("👷 Assign Contractors", "existing_project_assign_contractors"),
        button_("📌 Role Claims", "claims_admin_menu"),
        button_("🗓️ Invoice Window", "invoice_window_admin")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "menu_projects")
      ]
    }
  ];
}

function buildOperationsMenuBlocks_() {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "👥 *Operations*\nChoose a report:"
      }
    },
    {
      type: "actions",
      elements: [
        button_("📁 Portfolio Overview", "ops_workload"),
        button_("👤 Contractor Workload", "ops_contractor_workload"),
        button_("💵 Submit Invoice", "invoice_start")
      ]
    },
    {
      type: "actions",
      elements: [
        button_("⬅️ Back", "menu_main")
      ]
    }
  ];
}

function buildGoodbyeBlocks_(userId) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `👋 Bye <@${userId}>!\n\n` +
          "Whenever you need me again, just say *Hi IZA*."
      }
    }
  ];
}

function buildComingSoonBlocks_(title) {
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${title}*\n\nThis feature is not connected yet.`
      }
    },
    {
      type: "actions",
      elements: [
        button_("🏠 Main Menu", "menu_main")
      ]
    }
  ];
}
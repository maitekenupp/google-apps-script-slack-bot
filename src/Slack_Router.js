function handleIzaButtonClick_(payload) {
  const context = getSlackActionContext_(payload);
  const actionId = context.actionId;
  const channelId =
    payload.channel?.id ||
    payload.container?.channel_id ||
    payload.view?.private_metadata?.channelId;

  const messageTs =
    payload.message?.ts ||
    payload.container?.message_ts ||
    payload.view?.private_metadata?.messageTs;

  const userId =
    payload.user?.id;

  const publicActions = [
    "project_role_claim_start",
    "project_role_claim_submit_ephemeral",
    "role_claim_checkbox_select"
  ];

  if (!publicActions.includes(actionId)) {
    if (!requireIzaAdmin_(context.userId, context.channelId)) {
      return;
    }
  }

  if (actionId === "menu_main") {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildMainMenuBlocks_(context.userId),
      "IZA Main Menu"
    );
    return;
  }

  if (actionId === "menu_projects") {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildProjectsMenuBlocks_(),
      "IZA Projects Menu"
    );
    return;
  }

  if (actionId === "projects_create_menu") {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildProjectsCreateMenuBlocks_(),
      "Projects Create Menu"
    );
    return;
  }

  if (actionId === "projects_admin_menu") {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildProjectsAdminMenuBlocks_(),
      "Projects Admin Menu"
    );
    return;
  }

  if (actionId === "menu_operations") {
    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildOperationsMenuBlocks_(),
      "IZA Operations Menu"
    );
    return;
  }

  if (actionId === "menu_close") {
    clearProjectSession_(context.userId);
    clearClientSession_(context.userId);

    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildGoodbyeBlocks_(context.userId),
      "Goodbye"
    );
    return;
  }

  if (actionId === "projects_overview") {
    handleProjectsOverviewButton_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return;
  }

  if (actionId === "ops_workload") {
    handleWorkloadReportButton_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return;
  }

  if (actionId === "ops_contractor_workload") {
    handleContractorWorkloadButton_(
      context.channelId,
      context.messageTs,
      context.userId
    );
    return;
  }

  if (actionId === "project_new") {
    startProjectFlow_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "project_client_select") {
    handleProjectClientSelect_(payload);
    return;
  }

  if (actionId === "project_client_next") {
    handleProjectClientNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "project_open_details_modal") {
    openProjectDetailsModal_(
      context.userId,
      context.channelId,
      context.messageTs,
      context.triggerId
    );
    return;
  }

  if (actionId === "project_details_previous") {
    handleProjectDetailsPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "project_details_next") {
    handleProjectDetailsNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (
    actionId === "project_start_date_select" ||
    actionId === "project_end_date_select"
  ) {
    handleProjectDateSelect_(payload);
    return;
  }

  if (actionId === "project_dates_previous") {
    handleProjectDatesPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "project_dates_next") {
    handleProjectDatesNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (
    actionId === "project_status_quotation" ||
    actionId === "project_status_not_started" ||
    actionId === "project_status_in_progress"
  ) {
    handleProjectStatusSelect_(
      context.userId,
      context.channelId,
      context.messageTs,
      actionId
    );
    return;
  }

  if (actionId === "project_status_previous") {
    handleProjectStatusPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "project_status_next") {
    handleProjectStatusNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "project_open_links_modal") {
    openProjectLinksModal_(
      context.userId,
      context.channelId,
      context.messageTs,
      context.triggerId
    );
    return;
  }

  if (actionId === "project_links_previous") {
    handleProjectLinksPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "project_links_next") {
    handleProjectLinksNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "project_review_previous") {
    handleProjectReviewPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "project_create_confirm") {
    handleProjectCreateConfirm_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "project_create_cancel") {
    clearProjectSession_(context.userId);

    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildProjectsCreateMenuBlocks_(),
      "IZA Create Menu"
    );
    return;
  }

  if (actionId === "role_create_start") {
    startRoleFlow_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "role_pricing_cdef") {
    handleRolePricingSelect_(
      context.userId,
      context.channelId,
      context.messageTs,
      true
    );
    return;
  }

  if (actionId === "role_pricing_standard") {
    handleRolePricingSelect_(
      context.userId,
      context.channelId,
      context.messageTs,
      false
    );
    return;
  }

  if (actionId === "role_select") {
    handleRoleSelect_(payload);
    return;
  }

  if (actionId === "role_select_next") {
    handleRoleSelectNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "role_open_details_modal") {
    openRoleDetailsModal_(
      context.userId,
      context.channelId,
      context.messageTs,
      context.triggerId
    );
    return;
  }

  if (actionId === "role_details_previous") {
    handleRoleDetailsPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "role_details_next") {
    handleRoleDetailsNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "role_review_previous") {
    handleRoleReviewPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "role_add_to_list") {
    handleRoleAddToList_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "role_add_another") {
    handleRoleAddAnother_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "roles_create_confirm") {
    handleRolesCreateConfirm_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "roles_cancel") {
    handleRolesCancel_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "contractor_assign_start") {
    startContractorFlow_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "contractor_select") {
    handleContractorSelect_(payload);
    return;
  }

  if (actionId === "contractor_previous") {
    handleContractorPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "contractor_next") {
    handleContractorNext_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "contractor_review_previous") {
    handleContractorReviewPrevious_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "contractor_create_confirm") {
    handleContractorCreateConfirm_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "contractor_cancel") {
    handleContractorCancel_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "project_role_claim_start") {
    openProjectRoleClaimModal_(
      context.userId,
      context.channelId,
      context.messageTs,
      context.triggerId,
      context.actionValue
    );
    return;
  }

  if (actionId === "project_role_claim_submit_ephemeral") {
    handleProjectRoleClaimEphemeralSubmit_(payload);
    return;
  }

  if (actionId === "project_role_claim_submit_ephemeral") {
    handleProjectRoleClaimEphemeralSubmit_(payload);
    return;
  }

  if (actionId === "role_claim_checkbox_select") {
    return;
  }

  if (actionId === "claims_view_single_claim") {
    handleClaimsViewSingleClaim_(
      context.channelId,
      context.messageTs,
      context.actionValue
    );
    return;
  }

  if (actionId === "claims_back_to_single_claim_message") {
    handleClaimsBackToSingleClaimMessage_(
      context.channelId,
      context.messageTs,
      context.actionValue
    );
    return;
  }

  if (actionId === "client_new") {
    openClientModal_(
      context.userId,
      context.channelId,
      context.messageTs,
      context.triggerId
    );
    return;
  }

  if (actionId === "client_edit") {
    openClientEditModal_(
      context.userId,
      context.channelId,
      context.messageTs,
      context.triggerId
    );
    return;
  }

  if (actionId === "client_create_confirm") {
    handleClientCreateConfirm_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "client_create_cancel") {
    clearClientSession_(context.userId);

    updateIzaMenu(
      context.channelId,
      context.messageTs,
      buildProjectsMenuBlocks_(),
      "IZA Projects Menu"
    );
    return;
  }

  if (actionId === "claims_admin_menu") {
    showClaimsAdminMenu_(
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "claims_view_project") {
    handleClaimsViewProject_(
      context.channelId,
      context.messageTs,
      context.actionValue
    );
    return;
  }

  if (actionId === "claims_view_role") {
    handleClaimsViewRole_(
      context.channelId,
      context.messageTs,
      context.actionValue
    );
    return;
  }

  if (actionId === "claims_assign_person") {
    handleClaimsAssignPerson_(
      context.channelId,
      context.messageTs,
      context.actionValue
    );
    return;
  }

  if (actionId === "claims_close_announcement") {
    handleClaimsCloseAnnouncement_(
      context.channelId,
      context.messageTs,
      context.actionValue
    );
    return;
  }

  if (actionId === "existing_project_add_roles") {
  showExistingProjectRoleSelect_(
    context.userId,
    context.channelId,
    context.messageTs
  );
  return;
}

  if (actionId === "existing_project_assign_contractors") {
    showExistingProjectContractorSelect_(
      context.userId,
      context.channelId,
      context.messageTs
    );
    return;
  }

  if (actionId === "existing_project_roles_select") {
    handleExistingProjectRolesSelect_(payload);
    return;
  }

  if (actionId === "existing_project_contractors_select") {
    handleExistingProjectContractorsSelect_(payload);
    return;
  }

  if (actionId === "invoice_start") {
    handleInvoiceStart_(channelId, messageTs, userId);
    return;
  }

  if (actionId === "invoice_assignment_select") {
    handleInvoiceAssignmentSelect_(payload, channelId, messageTs, userId);
    return;
  }

  if (actionId === "invoice_open_line_modal") {
    handleInvoiceOpenLineModal_(payload, channelId, messageTs, userId);
    return;
  }

  if (actionId === "invoice_create_confirm") {
    handleInvoiceCreateConfirm_(channelId, messageTs, userId);
    return;
  }

  if (actionId === "invoice_cancel") {
    handleInvoiceCancel_(channelId, messageTs, userId);
    return;
  }

  if (actionId === "invoice_pay_to_yes") {
    handleInvoicePayToYes_(channelId, messageTs, userId);
    return;
  }

  if (actionId === "invoice_pay_to_edit") {
    handleInvoicePayToEdit_(payload, channelId, messageTs, userId);
    return;
  }

  if (actionId === "invoice_add_another") {
    handleInvoiceAddAnother_(channelId, messageTs, userId);
    return;
  }

  if (actionId === "invoice_window_admin") {
    handleInvoiceWindowAdmin_(channelId, messageTs, userId);
    return;
  }

  if (actionId === "invoice_window_open_modal") {
    handleInvoiceWindowOpenModal_(payload, channelId, messageTs, userId);
    return;
  }

  if (actionId === "invoice_window_close") {
    handleInvoiceWindowClose_(channelId, messageTs, userId);
    return;
  }

  sendEphemeralMessage(
    context.channelId,
    context.userId,
    "I received that action, but it is not connected yet."
  );
}

function handleSlackViewSubmission_(payload) {
  if (payload.view.callback_id === "project_details_submit") {
    return handleProjectDetailsSubmit_(payload);
  }

  if (payload.view.callback_id === "project_links_submit") {
    return handleProjectLinksSubmit_(payload);
  }

  if (payload.view.callback_id === "role_details_submit") {
    return handleRoleDetailsSubmit_(payload);
  }

  if (payload.view.callback_id === "project_role_claim_submit") {
    return handleProjectRoleClaimSubmit_(payload);
  }

  if (payload.view.callback_id === "client_modal_submit") {
    return handleClientModalSubmit_(payload);
  }

  if (payload.view.callback_id === "invoice_line_submit") {
    return handleInvoiceLineModalSubmission_(payload);
  }

  if (payload.view.callback_id === "invoice_pay_to_submit") {
    return handleInvoicePayToModalSubmission_(payload);
  }

  if (payload.view.callback_id === "invoice_window_submit") {
    return handleInvoiceWindowModalSubmission_(payload);
  }

  return { response_action: "clear" };
}

function getSlackActionContext_(payload) {
  const action = payload.actions[0];

  return {
    actionId: action.action_id,
    actionValue: action.value || null,
    triggerId: payload.trigger_id || null,

    channelId:
      payload.channel && payload.channel.id
        ? payload.channel.id
        : payload.container.channel_id,

    messageTs:
      payload.message && payload.message.ts
        ? payload.message.ts
        : payload.container.message_ts,

    userId:
      payload.user && payload.user.id
        ? payload.user.id
        : null
  };
}
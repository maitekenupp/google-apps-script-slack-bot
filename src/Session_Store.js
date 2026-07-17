/******************************************************
 *
 * IZA
 * File: Session_Store.gs
 *
 * Purpose:
 * Small wrappers around Script Properties for active
 * user sessions.
 *
 * Notes:
 * - These sessions are temporary workflow state.
 * - Long-term records live in Notion, not here.
 *
 ******************************************************/


/************************************
 * GENERIC SESSION HELPERS
 ************************************/

function saveSession_(prefix, userId, session) {
  PropertiesService.getScriptProperties()
    .setProperty(
      `${prefix}_${userId}`,
      JSON.stringify(session || {})
    );
}

function getSession_(prefix, userId) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(`${prefix}_${userId}`);

  return raw ? JSON.parse(raw) : null;
}

function clearSession_(prefix, userId) {
  PropertiesService.getScriptProperties()
    .deleteProperty(`${prefix}_${userId}`);
}


/************************************
 * PROJECT SESSION
 ************************************/

function saveProjectSession_(userId, session) {
  saveSession_("PROJECT_SESSION", userId, session);
}

function getProjectSession_(userId) {
  return getSession_("PROJECT_SESSION", userId);
}

function clearProjectSession_(userId) {
  clearSession_("PROJECT_SESSION", userId);
}


/************************************
 * CLIENT SESSION
 ************************************/

function saveClientSession_(userId, session) {
  saveSession_("CLIENT_SESSION", userId, session);
}

function getClientSession_(userId) {
  return getSession_("CLIENT_SESSION", userId);
}

function clearClientSession_(userId) {
  clearSession_("CLIENT_SESSION", userId);
}
function saveProjectSession_(userId, session) {
  PropertiesService.getScriptProperties()
    .setProperty(
      `PROJECT_SESSION_${userId}`,
      JSON.stringify(session)
    );
}

function getProjectSession_(userId) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(`PROJECT_SESSION_${userId}`);

  return raw ? JSON.parse(raw) : null;
}

function clearProjectSession_(userId) {
  PropertiesService.getScriptProperties()
    .deleteProperty(`PROJECT_SESSION_${userId}`);
}

function saveClientSession_(userId, session) {
  PropertiesService.getScriptProperties()
    .setProperty(
      `CLIENT_SESSION_${userId}`,
      JSON.stringify(session)
    );
}

function getClientSession_(userId) {
  const raw = PropertiesService.getScriptProperties()
    .getProperty(`CLIENT_SESSION_${userId}`);

  return raw ? JSON.parse(raw) : null;
}

function clearClientSession_(userId) {
  PropertiesService.getScriptProperties()
    .deleteProperty(`CLIENT_SESSION_${userId}`);
}
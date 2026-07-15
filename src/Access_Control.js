function loadTeamDirectoryUsers_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("TEAM_DIRECTORY_USERS");

  if (cached) {
    return JSON.parse(cached);
  }

  const rows = queryAllDataSourceRows_(TEAM_DIRECTORY_DATA_SOURCE_ID);

  const users = rows
    .map(row => {
      const name = getText_(row.properties["Name"]);
      const rate = getNumber_(row.properties["Standard Rate"]);
      const slackId = getText_(row.properties["Slack UID"]);
      const izaRole = normalizeIzaRole_(
        getText_(row.properties["IZA Role"])
      );

      return {
        id: row.id,
        name,
        label: name,
        value: row.id,
        rate,
        slackId,
        izaRole
      };
    })
    .filter(user => user.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  cache.put("TEAM_DIRECTORY_USERS", JSON.stringify(users), 300);

  return users;
}

function normalizeIzaRole_(role) {
  return String(role || "")
    .trim()
    .toLowerCase();
}

function getIzaUser_(slackUserId) {
  const users = loadTeamDirectoryUsers_();

  return users.find(user => user.slackId === slackUserId) || null;
}

function getIzaUserRole_(slackUserId) {
  const user = getIzaUser_(slackUserId);

  return user?.izaRole || "inactive";
}

function isIzaOwner_(slackUserId) {
  return getIzaUserRole_(slackUserId).includes("owner");
}

function isIzaAdmin_(slackUserId) {
  const role = getIzaUserRole_(slackUserId);

  return (
    role.includes("owner") ||
    role.includes("admin")
  );
}

function isIzaContractor_(slackUserId) {
  const role = getIzaUserRole_(slackUserId);

  return (
    role.includes("owner") ||
    role.includes("admin") ||
    role.includes("contractor")
  );
}

function requireIzaAdmin_(userId, channelId) {
  if (isIzaAdmin_(userId)) {
    return true;
  }

  sendEphemeralMessage(
    channelId,
    userId,
    "Sorry, this IZA menu is only available to admins."
  );

  return false;
}

function requireIzaContractor_(userId, channelId) {
  if (isIzaContractor_(userId)) {
    return true;
  }

  sendEphemeralMessage(
    channelId,
    userId,
    "Sorry, this action is only available to IZA contractors."
  );

  return false;
}
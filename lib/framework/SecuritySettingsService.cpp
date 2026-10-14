#include <SecuritySettingsService.h>

#if FT_ENABLED(FT_SECURITY)

SecuritySettingsService::SecuritySettingsService(AsyncWebServer* server, FS* fs) :
    _httpEndpoint(SecuritySettings::read, SecuritySettings::update, this, server, SECURITY_SETTINGS_PATH, this),
    _fsPersistence(SecuritySettings::read, SecuritySettings::update, this, fs, SECURITY_SETTINGS_FILE),
    _jwtHandler(FACTORY_JWT_SECRET) {
  addUpdateHandler([&](const String& originId) { configureJWTHandler(); }, false);

  // Endpoint para que cualquier usuario autenticado (incluso no-admin) cambie su propia contraseña
  AsyncCallbackJsonWebHandler* changePasswordHandler = new AsyncCallbackJsonWebHandler(
      "/rest/changePassword",
      [this](AsyncWebServerRequest* request, JsonVariant& json) {
        Authentication auth = authenticateRequest(request);
        if (!auth.authenticated || !auth.user) {
          request->send(401);
          return;
        }
        if (!json.is<JsonObject>()) {
          request->send(400);
          return;
        }
        const char* newPass = json["password"];
        if (!newPass || strlen(newPass) < 4) {
          AsyncJsonResponse* response = new AsyncJsonResponse(false);
          JsonObject resObj = response->getRoot().to<JsonObject>();
          resObj["error"] = "Contraseña debe tener al menos 4 caracteres";
          response->setLength();
          request->send(response);
          return;
        }

        String targetUser = auth.user->username;
        bool changed = false;
        this->update([&](SecuritySettings& settings) {
          for (User& u : settings.users) {
            if (u.username == targetUser) {
              u.password = String(newPass);
              changed = true;
              return StateUpdateResult::CHANGED;
            }
          }
          return StateUpdateResult::UNCHANGED;
        }, "user_self_pwd");

        AsyncJsonResponse* response = new AsyncJsonResponse(false);
        JsonObject resObj = response->getRoot().to<JsonObject>();
        resObj["success"] = changed;
        resObj["username"] = targetUser;
        response->setLength();
        request->send(response);
      });
  server->addHandler(changePasswordHandler);
}

void SecuritySettingsService::begin() {
  _fsPersistence.readFromFS();
  configureJWTHandler();
}

Authentication SecuritySettingsService::authenticateRequest(AsyncWebServerRequest* request) {
  const AsyncWebHeader* authorizationHeader = request->getHeader(AUTHORIZATION_HEADER);
  if (authorizationHeader) {
    String value = authorizationHeader->value();
    if (value.startsWith(AUTHORIZATION_HEADER_PREFIX)) {
      value = value.substring(AUTHORIZATION_HEADER_PREFIX_LEN);
      return authenticateJWT(value);
    }
  } else if (request->hasParam(ACCESS_TOKEN_PARAMATER)) {
    const AsyncWebParameter* tokenParamater = request->getParam(ACCESS_TOKEN_PARAMATER);
    String value = tokenParamater->value();
    return authenticateJWT(value);
  }
  return Authentication();
}

void SecuritySettingsService::configureJWTHandler() {
  _jwtHandler.setSecret(_state.jwtSecret);
}

Authentication SecuritySettingsService::authenticateJWT(String& jwt) {
  JsonDocument payloadDocument;
  _jwtHandler.parseJWT(jwt, payloadDocument);
  if (payloadDocument.is<JsonObject>()) {
    JsonObject parsedPayload = payloadDocument.as<JsonObject>();
    String username = parsedPayload["username"];
    for (User _user : _state.users) {
      if (_user.username == username && validatePayload(parsedPayload, &_user)) {
        return Authentication(_user);
      }
    }
  }
  return Authentication();
}

Authentication SecuritySettingsService::authenticate(const String& username, const String& password) {
  for (User _user : _state.users) {
    if (_user.username == username && _user.password == password) {
      return Authentication(_user);
    }
  }
  return Authentication();
}

inline void populateJWTPayload(JsonObject& payload, User* user) {
  payload["username"] = user->username;
  payload["admin"] = user->admin;
}

boolean SecuritySettingsService::validatePayload(JsonObject& parsedPayload, User* user) {
  JsonDocument jsonDocument;
  JsonObject payload = jsonDocument.to<JsonObject>();
  populateJWTPayload(payload, user);
  return payload == parsedPayload;
}

String SecuritySettingsService::generateJWT(User* user) {
  JsonDocument jsonDocument;
  JsonObject payload = jsonDocument.to<JsonObject>();
  populateJWTPayload(payload, user);
  return _jwtHandler.buildJWT(payload);
}

ArRequestFilterFunction SecuritySettingsService::filterRequest(AuthenticationPredicate predicate) {
  return [this, predicate](AsyncWebServerRequest* request) {
    Authentication authentication = authenticateRequest(request);
    return predicate(authentication);
  };
}

ArRequestHandlerFunction SecuritySettingsService::wrapRequest(ArRequestHandlerFunction onRequest,
                                                              AuthenticationPredicate predicate) {
  return [this, onRequest, predicate](AsyncWebServerRequest* request) {
    Authentication authentication = authenticateRequest(request);
    if (!predicate(authentication)) {
      request->send(401);
      return;
    }
    onRequest(request);
  };
}

ArJsonRequestHandlerFunction SecuritySettingsService::wrapCallback(ArJsonRequestHandlerFunction onRequest,
                                                                   AuthenticationPredicate predicate) {
  return [this, onRequest, predicate](AsyncWebServerRequest* request, JsonVariant& json) {
    Authentication authentication = authenticateRequest(request);
    if (!predicate(authentication)) {
      request->send(401);
      return;
    }
    onRequest(request, json);
  };
}

#else

User ADMIN_USER = User(FACTORY_ADMIN_USERNAME, FACTORY_ADMIN_PASSWORD, true);

SecuritySettingsService::SecuritySettingsService(AsyncWebServer* server, FS* fs) : SecurityManager() {
}
SecuritySettingsService::~SecuritySettingsService() {
}

ArRequestFilterFunction SecuritySettingsService::filterRequest(AuthenticationPredicate predicate) {
  return [this, predicate](AsyncWebServerRequest* request) { return true; };
}

// Return the admin user on all request - disabling security features
Authentication SecuritySettingsService::authenticateRequest(AsyncWebServerRequest* request) {
  return Authentication(ADMIN_USER);
}

// Return the function unwrapped
ArRequestHandlerFunction SecuritySettingsService::wrapRequest(ArRequestHandlerFunction onRequest,
                                                              AuthenticationPredicate predicate) {
  return onRequest;
}

ArJsonRequestHandlerFunction SecuritySettingsService::wrapCallback(ArJsonRequestHandlerFunction onRequest,
                                                                   AuthenticationPredicate predicate) {
  return onRequest;
}

#endif

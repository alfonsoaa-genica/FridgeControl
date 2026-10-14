#ifndef Features_h
#define Features_h

#define FT_ENABLED(feature) ((feature) == 1)

// project feature (deshabilitado por defecto a menos que se defina en features.ini)
#ifndef FT_PROJECT
#define FT_PROJECT 0
#endif

// security feature (deshabilitado por defecto a menos que se defina en features.ini)
#ifndef FT_SECURITY
#define FT_SECURITY 0
#endif

// mqtt feature (deshabilitado por defecto a menos que se defina en features.ini)
#ifndef FT_MQTT
#define FT_MQTT 0
#endif

// ntp feature (deshabilitado por defecto a menos que se defina en features.ini)
#ifndef FT_NTP
#define FT_NTP 0
#endif

// ota feature (deshabilitado por defecto a menos que se defina en features.ini)
#ifndef FT_OTA
#define FT_OTA 0
#endif

// upload firmware feature (deshabilitado por defecto a menos que se defina en features.ini)
#ifndef FT_UPLOAD_FIRMWARE
#define FT_UPLOAD_FIRMWARE 0
#endif

// upload filesystem feature (deshabilitado por defecto a menos que se defina en features.ini)
#ifndef FT_UPLOAD_FILESYSTEM
#define FT_UPLOAD_FILESYSTEM 0
#endif

#ifndef FT_UPLOAD_FS
#define FT_UPLOAD_FS FT_UPLOAD_FILESYSTEM
#endif

// language feature (deshabilitado por defecto a menos que se defina en features.ini)
#ifndef FT_USE_LANGUAGE
#define FT_USE_LANGUAGE 0
#endif

#endif


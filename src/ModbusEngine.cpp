#include "ModbusEngine.h"
#include <time.h>

ModbusEngine modbusEngine;

ModbusEngine::ModbusEngine() 
    : _serialFridgeIO(1), _serialKide(2), _cavas(nullptr), _cavaCount(0), _currentCavaIdx(0),
      _signalingNodes(nullptr), _signalingNodeCount(0), _currentSignalingIdx(0),
      _lastPollTime(0), _lastSignalingPollTime(0), _lastTrendSampleTime(0),
      _queueFridgeIO(nullptr), _queueKide(nullptr),
      _scanTarget(SCAN_TARGET_NONE), _scanCurrentId(1), _scanEndId(32), _scanFoundCount(0),
      _scanResults("[]"), _onSlaveDiscovered(nullptr), _onScanCompleted(nullptr) {
    memset(&_kideBusDiag, 0, sizeof(ModbusDiagnostics));
    memset(&_fridgeIOBusDiag, 0, sizeof(ModbusDiagnostics));
}

void ModbusEngine::begin() {
    // 1. Inicializar Puerto 1: Bus RS-485 Nativo para Auxiliares FridgeIO (2 hilos Half-Duplex)
    _serialFridgeIO.begin(RS485_BAUD_DEFAULT, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);

#if (RS485_DE_RE_PIN >= 0)
    pinMode(RS485_DE_RE_PIN, OUTPUT);
    digitalWrite(RS485_DE_RE_PIN, LOW); // Modo escucha por defecto
    _nodeFridgeIO.preTransmission([]() {
        digitalWrite(RS485_DE_RE_PIN, HIGH);
        delayMicroseconds(80);
    });
    _nodeFridgeIO.postTransmission([]() {
        delayMicroseconds(80);
        digitalWrite(RS485_DE_RE_PIN, LOW);
    });
    log_i("[RS485] Control de dirección DE/RE activo en GPIO %d", RS485_DE_RE_PIN);
#endif

    _serialFridgeIO.setTimeout(350);
    _nodeFridgeIO.begin(100, _serialFridgeIO);
    log_i("[RS485] Puerto 1 inicializado en TX:%d, RX:%d a %d bps (Auxiliares FridgeIO)", RS485_TX_PIN, RS485_RX_PIN, RS485_BAUD_DEFAULT);

    // 2. Inicializar Puerto 2: Bus RS-422 (4 Hilos) vía MAX3232 + FA-ISOCON para Cavas KIDE
    _serialKide.begin(KIDE_RS422_BAUD_DEFAULT, SERIAL_8N1, KIDE_RS422_RX_PIN, KIDE_RS422_TX_PIN);
    _serialKide.setTimeout(350);
    _nodeKide.begin(1, _serialKide);
    log_i("[RS422] Puerto 2 inicializado en TX:%d, RX:%d a %d bps (Cavas KIDE)", KIDE_RS422_TX_PIN, KIDE_RS422_RX_PIN, KIDE_RS422_BAUD_DEFAULT);

    // 3. Crear colas de comandos asíncronas independientes por bus físico
    _queueFridgeIO = xQueueCreate(20, sizeof(ModbusWriteCommand));
    _queueKide = xQueueCreate(20, sizeof(ModbusWriteCommand));

    _scanResults = "[]";
    _lastTrendSampleTime = millis();
}

void ModbusEngine::setCavas(CavaState* cavasArray, size_t count) {
    _cavas = cavasArray;
    _cavaCount = count;
    _currentCavaIdx = 0;
}

void ModbusEngine::setSignalingNodes(SignalingNode* nodesArray, size_t count) {
    _signalingNodes = nodesArray;
    _signalingNodeCount = count;
    _currentSignalingIdx = 0;
}

SignalingNode* ModbusEngine::getSignalingNodeById(uint8_t modbus_id) {
    if (!_signalingNodes) return nullptr;
    for (size_t i = 0; i < _signalingNodeCount; i++) {
        if (_signalingNodes[i].modbus_id == modbus_id) return &_signalingNodes[i];
    }
    return nullptr;
}

CavaState* ModbusEngine::getCava(size_t index) {
    if (index < _cavaCount) return &_cavas[index];
    return nullptr;
}

CavaState* ModbusEngine::getCavaById(const char* id) {
    if (!_cavas) return nullptr;
    for (size_t i = 0; i < _cavaCount; i++) {
        if (strcmp(_cavas[i].id, id) == 0) return &_cavas[i];
    }
    return nullptr;
}

// =============================================================================
// GESTIÓN DE COLA 1: AUXILIARES FRIDGE_IO (Puerto 1 / RS-485)
// =============================================================================
bool ModbusEngine::queueFridgeIOWriteCoil(uint8_t slaveId, uint16_t coilIndex, bool value) {
    if (!_queueFridgeIO) return false;
    ModbusWriteCommand cmd;
    cmd.modbus_id = slaveId;
    cmd.register_address = coilIndex;
    cmd.raw_value = value ? 1 : 0;
    cmd.is_coil = true;
    cmd.is_multiple_coils = false;
    cmd.count = 1;
    return xQueueSend(_queueFridgeIO, &cmd, pdMS_TO_TICKS(100)) == pdPASS;
}

bool ModbusEngine::queueFridgeIOWriteCoilsMask(uint8_t slaveId, uint16_t coilMask, uint16_t numCoils) {
    if (!_queueFridgeIO) return false;
    ModbusWriteCommand cmd;
    cmd.modbus_id = slaveId;
    cmd.register_address = 0x0000;
    cmd.raw_value = (int16_t)coilMask;
    cmd.is_coil = true;
    cmd.is_multiple_coils = true;
    cmd.count = numCoils;
    return xQueueSend(_queueFridgeIO, &cmd, pdMS_TO_TICKS(100)) == pdPASS;
}

bool ModbusEngine::queueFridgeIOWriteRegister(uint8_t slaveId, uint16_t regAddress, uint16_t value) {
    if (!_queueFridgeIO) return false;
    ModbusWriteCommand cmd;
    cmd.modbus_id = slaveId;
    cmd.register_address = regAddress;
    cmd.raw_value = (int16_t)value;
    cmd.is_coil = false;
    cmd.is_multiple_coils = false;
    cmd.count = 1;
    return xQueueSend(_queueFridgeIO, &cmd, pdMS_TO_TICKS(100)) == pdPASS;
}

// =============================================================================
// GESTIÓN DE COLA 2: CAVAS KIDE (Puerto 2 / RS-422)
// =============================================================================
bool ModbusEngine::queueKideWriteRegister(uint8_t slaveId, uint16_t regAddress, uint16_t value) {
    if (!_queueKide) return false;
    ModbusWriteCommand cmd;
    cmd.modbus_id = slaveId;
    cmd.register_address = regAddress;
    cmd.raw_value = (int16_t)value;
    cmd.is_coil = false;
    cmd.is_multiple_coils = false;
    cmd.count = 1;
    return xQueueSend(_queueKide, &cmd, pdMS_TO_TICKS(100)) == pdPASS;
}

bool ModbusEngine::queueWriteSetpointTemp(const char* cavaId, float temp_sp) {
    CavaState* c = getCavaById(cavaId);
    if (!c || !_queueKide) return false;

    ModbusWriteCommand cmd;
    cmd.modbus_id = c->modbus_id;
    cmd.register_address = 0x0064; // Registro 40101 (SP Temp x10)
    cmd.raw_value = (int16_t)(temp_sp * 10.0f);
    cmd.is_coil = false;
    cmd.is_multiple_coils = false;
    cmd.count = 1;

    return xQueueSend(_queueKide, &cmd, pdMS_TO_TICKS(100)) == pdPASS;
}

bool ModbusEngine::queueWriteSetpointHR(const char* cavaId, float hr_sp) {
    CavaState* c = getCavaById(cavaId);
    if (!c || !c->has_humidity || !_queueKide) return false;

    ModbusWriteCommand cmd;
    cmd.modbus_id = c->modbus_id;
    cmd.register_address = 0x0065; // Registro 40102 (SP HR x10)
    cmd.raw_value = (int16_t)(hr_sp * 10.0f);
    cmd.is_coil = false;
    cmd.is_multiple_coils = false;
    cmd.count = 1;

    return xQueueSend(_queueKide, &cmd, pdMS_TO_TICKS(100)) == pdPASS;
}

void ModbusEngine::update() {
    if (_scanTarget != SCAN_TARGET_NONE) {
        performScanStep();
        return;
    }

    // Procesar ambas colas de forma no bloqueante e independiente
    processFridgeIOWriteQueue();
    processKideWriteQueue();

    unsigned long now = millis();
    // Sondeo de Cavas KIDE (Puerto 2 / RS-422)
    if (now - _lastPollTime >= 300) {
        _lastPollTime = now;
        pollCurrentCava();
    }

    // Sondeo de Auxiliares FridgeIO (Puerto 1 / RS-485)
    if (now - _lastSignalingPollTime >= 500) {
        _lastSignalingPollTime = now;
        pollSignalingNodes();
    }

    processTrendSampling();
}

void ModbusEngine::processFridgeIOWriteQueue() {
    if (!_queueFridgeIO) return;
    ModbusWriteCommand cmd;
    while (xQueueReceive(_queueFridgeIO, &cmd, 0) == pdPASS) {
        _nodeFridgeIO.begin(cmd.modbus_id, _serialFridgeIO);
        _fridgeIOBusDiag.recordTx();

        uint8_t result = 0;
        if (cmd.is_multiple_coils) {
            _nodeFridgeIO.setTransmitBuffer(0, (uint16_t)cmd.raw_value);
            result = _nodeFridgeIO.writeMultipleCoils(cmd.register_address, cmd.count);
        } else if (cmd.is_coil) {
            result = _nodeFridgeIO.writeSingleCoil(cmd.register_address, cmd.raw_value != 0);
        } else {
            _nodeFridgeIO.setTransmitBuffer(0, (uint16_t)cmd.raw_value);
            result = _nodeFridgeIO.writeSingleRegister(cmd.register_address, (uint16_t)cmd.raw_value);
        }

        if (result == _nodeFridgeIO.ku8MBSuccess) {
            _fridgeIOBusDiag.recordSuccess(15);
            log_i("[QUEUE-RS485] Comando Auxiliar FridgeIO ejecutado: ID %u, Addr 0x%04X = %d", cmd.modbus_id, cmd.register_address, cmd.raw_value);
        } else {
            _fridgeIOBusDiag.recordTimeout();
            log_w("[QUEUE-RS485] Error comando Auxiliar FridgeIO ID %u: 0x%02X", cmd.modbus_id, result);
        }
        delay(15);
    }
}

void ModbusEngine::processKideWriteQueue() {
    if (!_queueKide) return;
    ModbusWriteCommand cmd;
    while (xQueueReceive(_queueKide, &cmd, 0) == pdPASS) {
        _nodeKide.begin(cmd.modbus_id, _serialKide);
        _kideBusDiag.recordTx();

        _nodeKide.setTransmitBuffer(0, (uint16_t)cmd.raw_value);
        uint8_t result = _nodeKide.writeSingleRegister(cmd.register_address, (uint16_t)cmd.raw_value);

        if (result == _nodeKide.ku8MBSuccess) {
            _kideBusDiag.recordSuccess(15);
            log_i("[QUEUE-RS422] Setpoint KIDE ejecutado: ID %u, Addr 0x%04X = %d", cmd.modbus_id, cmd.register_address, cmd.raw_value);
        } else {
            _kideBusDiag.recordTimeout();
            log_w("[QUEUE-RS422] Error comando KIDE ID %u: 0x%02X", cmd.modbus_id, result);
        }
        delay(15);
    }
}

void ModbusEngine::pollCurrentCava() {
    if (_cavaCount == 0 || !_cavas) return;

    CavaState& cava = _cavas[_currentCavaIdx];
    _nodeKide.begin(cava.modbus_id, _serialKide);

    // Selección de lectura según el modelo de controlador configurado
    if (cava.controller_model == KIDEMATIC_970) {
        readKidematic970(cava);
    } else {
        readKideKP100(cava);
    }

    _currentCavaIdx = (_currentCavaIdx + 1) % _cavaCount;
}

void ModbusEngine::pollSignalingNodes() {
    if (_signalingNodeCount == 0 || !_signalingNodes) return;

    SignalingNode& node = _signalingNodes[_currentSignalingIdx];
    _nodeFridgeIO.begin(node.modbus_id, _serialFridgeIO);

    unsigned long startMs = millis();
    node.diag.recordTx();
    _fridgeIOBusDiag.recordTx();

    // 1. Lectura de Entradas Digitales (Discrete Inputs 10001..10008, offset 0x0000, 8 entradas)
    uint8_t resDI = _nodeFridgeIO.readDiscreteInputs(0x0000, 8);
    uint16_t rtt = (uint16_t)(millis() - startMs);

    if (resDI == _nodeFridgeIO.ku8MBSuccess) {
        node.diag.recordSuccess(rtt);
        _fridgeIOBusDiag.recordSuccess(rtt);
        node.online = true;
        node.last_seen = millis();

        uint16_t diByte = _nodeFridgeIO.getResponseBuffer(0);
        node.door_closed_a = (diByte & (1 << 0)) != 0;
        node.door_closed_b = (diByte & (1 << 1)) != 0;
        node.ack_pressed_a = (diByte & (1 << 2)) != 0;
        node.ack_pressed_b = (diByte & (1 << 3)) != 0;
        node.kide_alarm_a  = (diByte & (1 << 4)) != 0;
        node.kide_alarm_b  = (diByte & (1 << 5)) != 0;

        // Actualizar estados en Cava A asociada
        if (strlen(node.cava_a_id) > 0) {
            CavaState* ca = getCavaById(node.cava_a_id);
            if (ca) {
                ca->door_closed = node.door_closed_a;
                ca->kide_hw_alarm_contact = node.kide_alarm_a;
                if (node.ack_pressed_a) {
                    ca->ack_pressed = true;
                    ca->ack_timestamp = millis();
                }
            }
        }

        // Actualizar estados en Cava B asociada
        if (strlen(node.cava_b_id) > 0) {
            CavaState* cb = getCavaById(node.cava_b_id);
            if (cb) {
                cb->door_closed = node.door_closed_b;
                cb->kide_hw_alarm_contact = node.kide_alarm_b;
                if (node.ack_pressed_b) {
                    cb->ack_pressed = true;
                    cb->ack_timestamp = millis();
                }
            }
        }
    } else {
        if (resDI == _nodeFridgeIO.ku8MBInvalidCRC) {
            node.diag.recordCrcError();
            _fridgeIOBusDiag.recordCrcError();
        } else {
            node.diag.recordTimeout();
            _fridgeIOBusDiag.recordTimeout();
        }
        node.online = false;
    }

    // 2. Transmisión del estado de las 8 Salidas a Relé hacia el módulo auxiliar
    if (node.online) {
        uint8_t coilsByte = node.packCoilsByte();
        queueFridgeIOWriteCoilsMask(node.modbus_id, coilsByte, 8);
    }

    _currentSignalingIdx = (_currentSignalingIdx + 1) % _signalingNodeCount;
}

void ModbusEngine::readKideKP100(CavaState& cava) {
    unsigned long startMs = millis();
    cava.diag.recordTx();
    _kideBusDiag.recordTx();

    // KP-100: Input Registers 30001 (Temp Cámara), 30002 (Temp Evap)
    uint8_t result = _nodeKide.readInputRegisters(0x0000, 2);
    uint16_t rtt = (uint16_t)(millis() - startMs);

    if (result == _nodeKide.ku8MBSuccess) {
        cava.diag.recordSuccess(rtt);
        _kideBusDiag.recordSuccess(rtt);
        cava.comm_online = true;
        cava.last_seen = millis();

        int16_t raw_temp = (int16_t)_nodeKide.getResponseBuffer(0);
        cava.temp_pv = raw_temp / 10.0f;

        int16_t raw_evap = (int16_t)_nodeKide.getResponseBuffer(1);
        cava.temp_evap = raw_evap / 10.0f;
    } else {
        if (result == _nodeKide.ku8MBInvalidCRC) {
            cava.diag.recordCrcError();
            _kideBusDiag.recordCrcError();
        } else {
            cava.diag.recordTimeout();
            _kideBusDiag.recordTimeout();
        }
        cava.comm_online = false;
    }

    // Leer Setpoint de Temperatura (Holding Register 40101, offset 0x0064)
    if (cava.comm_online) {
        uint8_t resSP = _nodeKide.readHoldingRegisters(0x0064, 1);
        if (resSP == _nodeKide.ku8MBSuccess) {
            cava.temp_sp = ((int16_t)_nodeKide.getResponseBuffer(0)) / 10.0f;
        }
    }
}

void ModbusEngine::readKidematic970(CavaState& cava) {
    unsigned long startMs = millis();
    cava.diag.recordTx();
    _kideBusDiag.recordTx();

    // KIDEMATIC 970: Input Registers 30001 (Temp), 30002 (Humedad), 30003 (Evap)
    uint8_t result = _nodeKide.readInputRegisters(0x0000, 3);
    uint16_t rtt = (uint16_t)(millis() - startMs);

    if (result == _nodeKide.ku8MBSuccess) {
        cava.diag.recordSuccess(rtt);
        _kideBusDiag.recordSuccess(rtt);
        cava.comm_online = true;
        cava.last_seen = millis();

        int16_t raw_temp = (int16_t)_nodeKide.getResponseBuffer(0);
        cava.temp_pv = raw_temp / 10.0f;

        uint16_t raw_hr = _nodeKide.getResponseBuffer(1);
        cava.hr_pv = raw_hr / 10.0f;

        int16_t raw_evap = (int16_t)_nodeKide.getResponseBuffer(2);
        cava.temp_evap = raw_evap / 10.0f;
    } else {
        if (result == _nodeKide.ku8MBInvalidCRC) {
            cava.diag.recordCrcError();
            _kideBusDiag.recordCrcError();
        } else {
            cava.diag.recordTimeout();
            _kideBusDiag.recordTimeout();
        }
        cava.comm_online = false;
    }

    // Leer Setpoints 40101 (Temp SP) y 40102 (HR SP)
    if (cava.comm_online) {
        uint8_t resSP = _nodeKide.readHoldingRegisters(0x0064, 2);
        if (resSP == _nodeKide.ku8MBSuccess) {
            cava.temp_sp = ((int16_t)_nodeKide.getResponseBuffer(0)) / 10.0f;
            cava.hr_sp   = _nodeKide.getResponseBuffer(1) / 10.0f;
        }
    }
}

void ModbusEngine::processTrendSampling() {
    unsigned long now = millis();
    if (now - _lastTrendSampleTime < 30000) return; // Muestreo cada 30 segundos
    _lastTrendSampleTime = now;

    time_t nowSec = time(nullptr);
    for (size_t i = 0; i < _cavaCount; i++) {
        CavaState& c = _cavas[i];
        if (c.comm_online) {
            c.trends.add(nowSec, c.temp_pv, c.hr_pv, c.has_humidity);
        }
    }
}

// =============================================================================
// DIAGNÓSTICO Y DESCUBRIMIENTO INDEPENDIENTE POR PUERTO
// =============================================================================
PingResult ModbusEngine::pingKide(uint8_t id) {
    PingResult pr;
    pr.id = id;
    pr.success = false;
    pr.rtt_ms = 0;
    pr.detected_model = "UNKNOWN";
    pr.temp_pv = 0.0f;
    pr.hr_pv = 0.0f;

    unsigned long startMs = millis();
    _nodeKide.begin(id, _serialKide);
    uint8_t res = _nodeKide.readInputRegisters(0x0000, 2);
    pr.rtt_ms = (uint16_t)(millis() - startMs);

    if (res == _nodeKide.ku8MBSuccess) {
        pr.success = true;
        pr.temp_pv = ((int16_t)_nodeKide.getResponseBuffer(0)) / 10.0f;
        uint16_t raw_hr = _nodeKide.getResponseBuffer(1);
        if (raw_hr > 200 && raw_hr <= 1000) {
            pr.hr_pv = raw_hr / 10.0f;
            pr.detected_model = "KIDEMATIC_970";
        } else {
            pr.detected_model = "KIDE_KP100";
        }
    }
    return pr;
}

PingResult ModbusEngine::pingFridgeIO(uint8_t id) {
    PingResult pr;
    pr.id = id;
    pr.success = false;
    pr.rtt_ms = 0;
    pr.detected_model = "UNKNOWN";
    pr.temp_pv = 0.0f;
    pr.hr_pv = 0.0f;

    unsigned long startMs = millis();
    _nodeFridgeIO.begin(id, _serialFridgeIO);
    uint8_t res = _nodeFridgeIO.readHoldingRegisters(0x0000, 1);
    pr.rtt_ms = (uint16_t)(millis() - startMs);

    if (res == _nodeFridgeIO.ku8MBSuccess) {
        pr.success = true;
        pr.detected_model = "FRIDGE_IO";
    }
    return pr;
}

PingResult ModbusEngine::pingSlave(uint8_t id) {
    if (id >= 100) {
        return pingFridgeIO(id);
    } else {
        return pingKide(id);
    }
}

void ModbusEngine::startKideScan(uint8_t startId, uint8_t endId) {
    _scanTarget = SCAN_TARGET_KIDE;
    _scanCurrentId = (startId == 0) ? 1 : startId;
    _scanEndId = (endId > 99) ? 99 : endId;
    _scanFoundCount = 0;
    _scanResults = "[";
    log_i("[SCAN-KIDE] Iniciando barrido RS-422 IDs %u a %u", _scanCurrentId, _scanEndId);
}

void ModbusEngine::startFridgeIOScan(uint8_t startId, uint8_t endId) {
    _scanTarget = SCAN_TARGET_FRIDGE_IO;
    _scanCurrentId = (startId < 100) ? 100 : startId;
    _scanEndId = (endId > 247) ? 247 : endId;
    _scanFoundCount = 0;
    _scanResults = "[";
    log_i("[SCAN-FRIDGEIO] Iniciando barrido RS-485 IDs %u a %u", _scanCurrentId, _scanEndId);
}

void ModbusEngine::startBusScan(uint8_t startId, uint8_t endId, ScanTarget target) {
    if (target == SCAN_TARGET_KIDE || (target == SCAN_TARGET_ALL && endId < 100)) {
        startKideScan(startId, endId);
    } else if (target == SCAN_TARGET_FRIDGE_IO || (target == SCAN_TARGET_ALL && startId >= 100)) {
        startFridgeIOScan(startId, endId);
    } else {
        _scanTarget = SCAN_TARGET_ALL;
        _scanCurrentId = (startId == 0) ? 1 : startId;
        _scanEndId = (endId > 247) ? 247 : endId;
        _scanFoundCount = 0;
        _scanResults = "[";
        log_i("[SCAN-ALL] Iniciando barrido combinado IDs %u a %u", _scanCurrentId, _scanEndId);
    }
}

void ModbusEngine::stopBusScan() {
    if (_scanTarget != SCAN_TARGET_NONE) {
        _scanTarget = SCAN_TARGET_NONE;
        if (_scanResults.endsWith(",")) _scanResults.remove(_scanResults.length() - 1);
        _scanResults += "]";
        log_i("[SCAN] Barrido abortado por el usuario en ID %u.", _scanCurrentId);
    }
}

void ModbusEngine::performScanStep() {
    if (_scanCurrentId > _scanEndId) {
        _scanTarget = SCAN_TARGET_NONE;
        if (_scanResults.endsWith(",")) _scanResults.remove(_scanResults.length() - 1);
        _scanResults += "]";
        if (_onScanCompleted) {
            _onScanCompleted(_scanFoundCount);
        }
        return;
    }

    PingResult pr;
    if (_scanTarget == SCAN_TARGET_KIDE) {
        pr = pingKide(_scanCurrentId);
    } else if (_scanTarget == SCAN_TARGET_FRIDGE_IO) {
        pr = pingFridgeIO(_scanCurrentId);
    } else {
        pr = pingSlave(_scanCurrentId);
    }

    if (pr.success) {
        _scanFoundCount++;
        _scanResults += "{\"id\":" + String(pr.id) + 
                        ",\"model\":\"" + String(pr.detected_model) + "\"" + 
                        ",\"rtt_ms\":" + String(pr.rtt_ms) + 
                        ",\"temp\":" + String(pr.temp_pv, 1) + 
                        (pr.hr_pv > 0 ? ",\"hr\":" + String(pr.hr_pv, 1) : "") + 
                        "},";
        if (_onSlaveDiscovered) {
            _onSlaveDiscovered(pr.id, pr.detected_model, pr.temp_pv, pr.hr_pv);
        }
    }

    _scanCurrentId++;
    delay(10);
}

String ModbusEngine::getScanResultsJson() {
    if (_scanTarget != SCAN_TARGET_NONE) {
        return "{\"status\":\"scanning\",\"target\":" + String((int)_scanTarget) + ",\"current_id\":" + String(_scanCurrentId) + "}";
    }
    return _scanResults;
}

bool ModbusEngine::commissionSignalingSlave(uint8_t currentId, uint8_t newId) {
    if (newId < 1 || newId > 247) return false;

    _nodeFridgeIO.begin(currentId, _serialFridgeIO);

    // 1. Escribir el nuevo ID en el registro de retención 40001 (offset 0)
    uint8_t res1 = _nodeFridgeIO.writeSingleRegister(0x0000, newId);
    delay(50);
    if (res1 != _nodeFridgeIO.ku8MBSuccess) {
        log_e("[COMMISSION] Error escribiendo nuevo ID %u en esclavo %u (err: 0x%02X)", newId, currentId, res1);
        return false;
    }

    // 2. Enviar comando de guardar en Flash NVS (0x55AA = 21930) en registro 40004 (offset 3)
    uint8_t res2 = _nodeFridgeIO.writeSingleRegister(0x0003, 0x55AA);
    delay(50);

    // 3. Reiniciar satélite auxiliar vía registro 40005 (0x0001 = Reboot)
    _nodeFridgeIO.writeSingleRegister(0x0004, 0x0001);

    log_i("[COMMISSION] Auxiliar %u reprogramado a nuevo ID %u con éxito.", currentId, newId);
    return true;
}

ModbusEngine::CavaDiagnosticPing ModbusEngine::pingCavaAndCompanion(const char* cavaId) {
    CavaDiagnosticPing result;
    memset(&result, 0, sizeof(result));
    strncpy(result.cava_id, cavaId, sizeof(result.cava_id) - 1);

    CavaState* cava = getCavaById(cavaId);
    if (!cava) {
        result.diagnosis_summary = "Cava no registrada en configuración.";
        return result;
    }

    result.kide_id = cava->modbus_id;

    // 1. Diagnóstico del Controlador KIDE en Puerto 2 (RS-422)
    PingResult pk = pingKide(cava->modbus_id);
    result.kide_online = pk.success;
    result.kide_rtt_ms = pk.rtt_ms;
    result.temp_pv = pk.temp_pv;
    result.hr_pv = pk.hr_pv;

    // 2. Diagnóstico del Módulo Auxiliar Compañero en Puerto 1 (RS-485)
    result.companion_node_id = cava->signaling_node_id;
    result.companion_channel = cava->signaling_channel;

    if (cava->signaling_node_id > 0) {
        PingResult pf = pingFridgeIO(cava->signaling_node_id);
        result.companion_online = pf.success;
        result.companion_rtt_ms = pf.rtt_ms;
    }

    // Resumen de diagnóstico
    if (result.kide_online && result.companion_online) {
        result.diagnosis_summary = "OK: Enlace óptimo en KIDE (RS-422) y Auxiliar FridgeIO (RS-485).";
    } else if (result.kide_online && !result.companion_online) {
        result.diagnosis_summary = "ALERTA: KIDE respondiendo pero Auxiliar FridgeIO sin comunicación.";
    } else if (!result.kide_online && result.companion_online) {
        result.diagnosis_summary = "CRÍTICO: Controlador KIDE fuera de línea. Auxiliar FridgeIO activo.";
    } else {
        result.diagnosis_summary = "FALLA TOTAL: Ambos subsistemas fuera de línea para esta cava.";
    }

    return result;
}

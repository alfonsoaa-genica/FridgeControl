#include "ModbusEngine.h"
#include <time.h>

ModbusEngine modbusEngine;

ModbusEngine::ModbusEngine() 
    : _serialFridgeIO(1), _serialKide(2), _cavas(nullptr), _cavaCount(0), _currentCavaIdx(0),
      _signalingNodes(nullptr), _signalingNodeCount(0), _currentSignalingIdx(0),
      _lastPollTime(0), _lastSignalingPollTime(0), _lastTrendSampleTime(0), _isScanning(false),
      _scanCurrentId(1), _scanEndId(32), _scanFoundCount(0),
      _scanResults("[]"), _onSlaveDiscovered(nullptr), _onScanCompleted(nullptr) {
}

void ModbusEngine::begin() {
    // 1. Inicializar Puerto 1: Bus RS-485 para Satélites FridgeIO (2 hilos Half-Duplex)
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
    log_i("[RS485] Puerto 1 inicializado en TX:%d, RX:%d a %d bps (Satélites FridgeIO)", RS485_TX_PIN, RS485_RX_PIN, RS485_BAUD_DEFAULT);

    // 2. Inicializar Puerto 2: Bus RS-422 (4 Hilos) vía MAX3232 + FA-ISOCON para Cavas KIDE
    _serialKide.begin(KIDE_RS422_BAUD_DEFAULT, SERIAL_8N1, KIDE_RS422_RX_PIN, KIDE_RS422_TX_PIN);
    _serialKide.setTimeout(350);
    _nodeKide.begin(1, _serialKide);
    log_i("[RS422] Puerto 2 inicializado en TX:%d, RX:%d a %d bps (Cavas KIDE)", KIDE_RS422_TX_PIN, KIDE_RS422_RX_PIN, KIDE_RS422_BAUD_DEFAULT);

    _writeQueue = xQueueCreate(20, sizeof(ModbusWriteCommand));
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
    for (size_t i = 0; i < _cavaCount; i++) {
        if (strcmp(_cavas[i].id, id) == 0) return &_cavas[i];
    }
    return nullptr;
}

bool ModbusEngine::queueWriteCoil(uint8_t slaveId, uint16_t coilIndex, bool value) {
    ModbusWriteCommand cmd;
    cmd.modbus_id = slaveId;
    cmd.register_address = coilIndex;
    cmd.raw_value = value ? 1 : 0;
    cmd.is_coil = true;
    cmd.is_multiple_coils = false;
    cmd.count = 1;
    return xQueueSend(_writeQueue, &cmd, pdMS_TO_TICKS(100)) == pdPASS;
}

bool ModbusEngine::queueWriteCoilsMask(uint8_t slaveId, uint16_t coilMask, uint16_t numCoils) {
    ModbusWriteCommand cmd;
    cmd.modbus_id = slaveId;
    cmd.register_address = 0x0000;
    cmd.raw_value = (int16_t)coilMask;
    cmd.is_coil = true;
    cmd.is_multiple_coils = true;
    cmd.count = numCoils;
    return xQueueSend(_writeQueue, &cmd, pdMS_TO_TICKS(100)) == pdPASS;
}

bool ModbusEngine::queueWriteSetpointTemp(const char* cavaId, float temp_sp) {
    CavaState* c = getCavaById(cavaId);
    if (!c) return false;

    ModbusWriteCommand cmd;
    cmd.modbus_id = c->modbus_id;
    cmd.register_address = 0x0064; // 100 (40101)
    cmd.raw_value = (int16_t)(temp_sp * 10.0f);
    cmd.is_coil = false;
    cmd.is_multiple_coils = false;
    cmd.count = 1;

    return xQueueSend(_writeQueue, &cmd, pdMS_TO_TICKS(100)) == pdPASS;
}

bool ModbusEngine::queueWriteSetpointHR(const char* cavaId, float hr_sp) {
    CavaState* c = getCavaById(cavaId);
    if (!c || !c->has_humidity) return false;

    ModbusWriteCommand cmd;
    cmd.modbus_id = c->modbus_id;
    cmd.register_address = 0x0065; // 101 (40102)
    cmd.raw_value = (int16_t)(hr_sp * 10.0f);
    cmd.is_coil = false;
    cmd.is_multiple_coils = false;
    cmd.count = 1;

    return xQueueSend(_writeQueue, &cmd, pdMS_TO_TICKS(100)) == pdPASS;
}

void ModbusEngine::update() {
    if (_isScanning) {
        performScanStep();
        return;
    }

    processWriteQueue();

    unsigned long now = millis();
    if (now - _lastPollTime >= 300) {
        _lastPollTime = now;
        pollCurrentCava();
    }

    if (now - _lastSignalingPollTime >= 500) {
        _lastSignalingPollTime = now;
        pollSignalingNodes();
    }

    processTrendSampling();
}

void ModbusEngine::processWriteQueue() {
    ModbusWriteCommand cmd;
    while (xQueueReceive(_writeQueue, &cmd, 0) == pdPASS) {
        if (cmd.is_coil || cmd.modbus_id >= 100) {
            // Destino: Satélites FridgeIO (Puerto 1 / RS-485)
            _nodeFridgeIO.begin(cmd.modbus_id, _serialFridgeIO);

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
                log_i("[QUEUE-RS485] Comando FridgeIO ejecutado: ID %u, Addr 0x%04X = %d", cmd.modbus_id, cmd.register_address, cmd.raw_value);
            } else {
                log_w("[QUEUE-RS485] Error comando FridgeIO ID %u: 0x%02X", cmd.modbus_id, result);
            }
            delay(15);
        } else {
            // Destino: Controladores KIDE (Puerto 2 / RS-422)
            _nodeKide.begin(cmd.modbus_id, _serialKide);

            _nodeKide.setTransmitBuffer(0, (uint16_t)cmd.raw_value);
            uint8_t result = _nodeKide.writeSingleRegister(cmd.register_address, (uint16_t)cmd.raw_value);

            if (result == _nodeKide.ku8MBSuccess) {
                log_i("[QUEUE-RS422] Setpoint KIDE ejecutado: ID %u, Addr 0x%04X = %d", cmd.modbus_id, cmd.register_address, cmd.raw_value);
            } else {
                log_w("[QUEUE-RS422] Error comando KIDE ID %u: 0x%02X", cmd.modbus_id, result);
            }
            delay(15);
        }
    }
}

void ModbusEngine::pollCurrentCava() {
    if (_cavaCount == 0 || !_cavas) return;

    CavaState& cava = _cavas[_currentCavaIdx];
    _nodeKide.begin(cava.modbus_id, _serialKide);

    if (cava.tipo == CAVA_CONSERVACION) {
        readKideKP100(cava);
    } else {
        readKidematic970(cava);
    }

    cava.evaluateAlarms();
    _currentCavaIdx = (_currentCavaIdx + 1) % _cavaCount;
}

void ModbusEngine::pollSignalingNodes() {
    if (_signalingNodeCount == 0 || !_signalingNodes) return;

    SignalingNode& node = _signalingNodes[_currentSignalingIdx];
    _currentSignalingIdx = (_currentSignalingIdx + 1) % _signalingNodeCount;

    _nodeFridgeIO.begin(node.modbus_id, _serialFridgeIO);
    node.diag.recordTx();
    unsigned long startMs = millis();

    // 1. Leer las 8 entradas discretas del nodo FridgeIO (Función 02)
    uint8_t res = _nodeFridgeIO.readDiscreteInputs(0x0000, 8);
    unsigned long rtt = millis() - startMs;

    if (res == _nodeFridgeIO.ku8MBSuccess) {
        node.diag.recordSuccess((uint16_t)rtt);
        node.online = true;
        node.last_seen = millis();

        uint8_t rawIn = (uint8_t)(_nodeFridgeIO.getResponseBuffer(0) & 0xFF);
        node.door_closed_a = (rawIn & (1 << 0)) != 0;
        node.door_closed_b = (rawIn & (1 << 1)) != 0;
        node.ack_pressed_a = (rawIn & (1 << 2)) != 0;
        node.ack_pressed_b = (rawIn & (1 << 3)) != 0;
        node.kide_alarm_a  = (rawIn & (1 << 4)) != 0;
        node.kide_alarm_b  = (rawIn & (1 << 5)) != 0;

        uint32_t nowMs = millis();

        // 1b. Si 1-Wire está habilitado, leer temperaturas de respaldo (Input Registers 30007 y 30008)
        if (node.enable_1wire) {
            if (_nodeFridgeIO.readInputRegisters(0x0006, 2) == _nodeFridgeIO.ku8MBSuccess) {
                int16_t rawTA = (int16_t)_nodeFridgeIO.getResponseBuffer(0);
                int16_t rawTB = (int16_t)_nodeFridgeIO.getResponseBuffer(1);
                node.temp_backup_a = (rawTA != -999) ? (rawTA / 10.0f) : -999.0f;
                node.temp_backup_b = (rawTB != -999) ? (rawTB / 10.0f) : -999.0f;
            }
        }

        // 2. Sincronizar y evaluar Cava A (si está mapeada)
        if (strlen(node.cava_a_id) > 0) {
            CavaState* ca = getCavaById(node.cava_a_id);
            if (ca) {
                // Si el Kide de la cava se apaga o falla, usar la sonda 1-Wire como temperatura de respaldo
                if (!ca->comm_online && node.enable_1wire && node.temp_backup_a > -50.0f) {
                    ca->temp_pv = node.temp_backup_a;
                }

                if (ca->door_closed && !node.door_closed_a) {
                    ca->door_open_epoch = nowMs;
                }
                ca->door_closed = node.door_closed_a;

                if (node.ack_pressed_a && !ca->ack_pressed) {
                    ca->ack_pressed = true;
                    ca->ack_timestamp = nowMs;
                }
                ca->kide_hw_alarm_contact = node.kide_alarm_a;
                ca->updateSignalingLogic(nowMs);
            }
        }

        // 3. Sincronizar y evaluar Cava B (si está mapeada)
        if (strlen(node.cava_b_id) > 0) {
            CavaState* cb = getCavaById(node.cava_b_id);
            if (cb) {
                // Si el Kide de la cava se apaga o falla, usar la sonda 1-Wire como temperatura de respaldo
                if (!cb->comm_online && node.enable_1wire && node.temp_backup_b > -50.0f) {
                    cb->temp_pv = node.temp_backup_b;
                }

                if (cb->door_closed && !node.door_closed_b) {
                    cb->door_open_epoch = nowMs;
                }
                cb->door_closed = node.door_closed_b;

                if (node.ack_pressed_b && !cb->ack_pressed) {
                    cb->ack_pressed = true;
                    cb->ack_timestamp = nowMs;
                }
                cb->kide_hw_alarm_contact = node.kide_alarm_b;
                cb->updateSignalingLogic(nowMs);
            }
        }

        delay(15); // Pausa inter-trama estricta Half-Duplex (3.5 char silence) para cambio TX->RX en RS-485

        // 4. Leer el estado real de los 8 relés gobernados autónomamente por el esclavo (Función 01)
        if (_nodeFridgeIO.readCoils(0x0000, 8) == _nodeFridgeIO.ku8MBSuccess) {
            uint8_t coilsReported = (uint8_t)(_nodeFridgeIO.getResponseBuffer(0) & 0xFF);
            node.green_a  = (coilsReported & (1 << 0)) != 0;
            node.yellow_a = (coilsReported & (1 << 1)) != 0;
            node.red_a    = (coilsReported & (1 << 2)) != 0;
            node.buzzer_a = (coilsReported & (1 << 3)) != 0;
            node.green_b  = (coilsReported & (1 << 4)) != 0;
            node.yellow_b = (coilsReported & (1 << 5)) != 0;
            node.red_b    = (coilsReported & (1 << 6)) != 0;
            node.buzzer_b = (coilsReported & (1 << 7)) != 0;
        }
    } else {
        node.diag.recordTimeout();
        if (millis() - node.last_seen > 10000) {
            node.online = false;
        }
    }
}

void ModbusEngine::readKideKP100(CavaState& cava) {
    cava.diag.recordTx();
    unsigned long startMs = millis();

    uint8_t res = _nodeKide.readInputRegisters(0x0000, 2);
    if (res != _nodeKide.ku8MBSuccess) {
        res = _nodeKide.readHoldingRegisters(0x0000, 2);
    }

    uint16_t rtt = (uint16_t)(millis() - startMs);

    if (res == _nodeKide.ku8MBSuccess) {
        cava.comm_online = true;
        cava.comm_errors = 0;
        cava.last_seen = (uint32_t)time(nullptr);
        cava.diag.recordSuccess(rtt);

        int16_t raw_temp = (int16_t)_nodeKide.getResponseBuffer(0);
        int16_t raw_evap = (int16_t)_nodeKide.getResponseBuffer(1);
        cava.temp_pv = raw_temp / 10.0f;
        cava.temp_evap = raw_evap / 10.0f;
    } else {
        cava.comm_errors++;
        if (res == _nodeKide.ku8MBResponseTimedOut) {
            cava.diag.recordTimeout();
        } else {
            cava.diag.recordCrcError();
        }
        if (cava.comm_errors >= 3) cava.comm_online = false;
        return;
    }

    // 2. Lectura de Setpoint (40101, 40102)
    if (_nodeKide.readHoldingRegisters(0x0064, 2) == _nodeKide.ku8MBSuccess) {
        cava.temp_sp = ((int16_t)_nodeKide.getResponseBuffer(0)) / 10.0f;
        cava.temp_diff = ((int16_t)_nodeKide.getResponseBuffer(1)) / 10.0f;
    }

    // 3. Lectura de Coils (00001, 00002, 00003)
    if (_nodeKide.readCoils(0x0000, 3) == _nodeKide.ku8MBSuccess) {
        uint8_t coils = _nodeKide.getResponseBuffer(0);
        cava.cooling_active = (coils & 0x01) != 0;
        cava.fan_active     = (coils & 0x02) != 0;
        cava.defrost_active = (coils & 0x04) != 0;
    }
}

void ModbusEngine::readKidematic970(CavaState& cava) {
    cava.diag.recordTx();
    unsigned long startMs = millis();

    uint8_t res = _nodeKide.readInputRegisters(0x0000, 3);
    if (res != _nodeKide.ku8MBSuccess) {
        res = _nodeKide.readHoldingRegisters(0x0000, 3);
    }

    uint16_t rtt = (uint16_t)(millis() - startMs);

    if (res == _nodeKide.ku8MBSuccess) {
        cava.comm_online = true;
        cava.comm_errors = 0;
        cava.last_seen = (uint32_t)time(nullptr);
        cava.diag.recordSuccess(rtt);

        int16_t raw_temp = (int16_t)_nodeKide.getResponseBuffer(0);
        uint16_t raw_hr  = _nodeKide.getResponseBuffer(1);
        int16_t raw_evap = (int16_t)_nodeKide.getResponseBuffer(2);

        cava.temp_pv = raw_temp / 10.0f;
        cava.hr_pv   = raw_hr / 10.0f;
        cava.temp_evap = raw_evap / 10.0f;
    } else {
        cava.comm_errors++;
        if (res == _nodeKide.ku8MBResponseTimedOut) {
            cava.diag.recordTimeout();
        } else {
            cava.diag.recordCrcError();
        }
        if (cava.comm_errors >= 3) cava.comm_online = false;
        return;
    }

    // 2. Lectura de Setpoints (40101 a 40104)
    if (_nodeKide.readHoldingRegisters(0x0064, 4) == _nodeKide.ku8MBSuccess) {
        cava.temp_sp   = ((int16_t)_nodeKide.getResponseBuffer(0)) / 10.0f;
        cava.hr_sp     = ((uint16_t)_nodeKide.getResponseBuffer(1)) / 10.0f;
        cava.temp_diff = ((int16_t)_nodeKide.getResponseBuffer(2)) / 10.0f;
        cava.hr_diff   = ((uint16_t)_nodeKide.getResponseBuffer(3)) / 10.0f;
    }

    // 3. Lectura de Coils
    if (_nodeKide.readCoils(0x0000, 5) == _nodeKide.ku8MBSuccess) {
        uint8_t coils = _nodeKide.getResponseBuffer(0);
        cava.cooling_active = (coils & 0x01) != 0;
        cava.heating_active = (coils & 0x02) != 0;
        cava.humid_active   = (coils & 0x04) != 0;
        cava.exhaust_active = (coils & 0x08) != 0;
        cava.fan_active     = (coils & 0x10) != 0;
    }
}

void ModbusEngine::processTrendSampling() {
    unsigned long now = millis();
    if (now - _lastTrendSampleTime >= TREND_INTERVAL_MS) {
        _lastTrendSampleTime = now;
        uint32_t current_ts = (uint32_t)time(nullptr);
        if (current_ts < 100000) current_ts = now / 1000;

        for (size_t i = 0; i < _cavaCount; i++) {
            if (_cavas[i].comm_online) {
                _cavas[i].trends.add(current_ts, _cavas[i].temp_pv, _cavas[i].hr_pv, _cavas[i].has_humidity);
            }
        }
    }
}

PingResult ModbusEngine::pingSlave(uint8_t id) {
    PingResult pr;
    pr.id = id;
    pr.success = false;
    pr.rtt_ms = 0;
    pr.detected_model = "UNKNOWN";
    pr.temp_pv = 0.0f;
    pr.hr_pv = 0.0f;

    unsigned long startMs = millis();

    if (id >= 100) {
        // Identificación de Satélites de Señalización FridgeIO por bus RS-485
        _nodeFridgeIO.begin(id, _serialFridgeIO);
        uint8_t res = _nodeFridgeIO.readHoldingRegisters(0x0000, 1);
        pr.rtt_ms = (uint16_t)(millis() - startMs);
        if (res == _nodeFridgeIO.ku8MBSuccess) {
            pr.success = true;
            pr.detected_model = "FRIDGE_IO";
        }
        return pr;
    }

    // Controladores KIDE por bus RS-422: consultar 30001 y 30002
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

void ModbusEngine::startBusScan(uint8_t startId, uint8_t endId) {
    _isScanning = true;
    _scanCurrentId = (startId == 0) ? 1 : startId;
    _scanEndId = (endId > 247) ? 247 : endId;
    _scanFoundCount = 0;
    _scanResults = "[";
}

void ModbusEngine::stopBusScan() {
    if (_isScanning) {
        _isScanning = false;
        if (_scanResults.endsWith(",")) _scanResults.remove(_scanResults.length() - 1);
        _scanResults += "]";
        log_i("[SCAN] Barrido abortado por el usuario en ID %u.", _scanCurrentId);
    }
}

void ModbusEngine::performScanStep() {
    if (_scanCurrentId > _scanEndId) {
        _isScanning = false;
        if (_scanResults.endsWith(",")) _scanResults.remove(_scanResults.length() - 1);
        _scanResults += "]";
        if (_onScanCompleted) {
            _onScanCompleted(_scanFoundCount);
        }
        return;
    }

    PingResult pr = pingSlave(_scanCurrentId);
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
    if (_isScanning) return "{\"status\":\"scanning\",\"current_id\":" + String(_scanCurrentId) + "}";
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
    delay(100);
    if (res2 != _nodeFridgeIO.ku8MBSuccess) {
        log_e("[COMMISSION] Error enviando comando 0x55AA a esclavo %u (err: 0x%02X)", currentId, res2);
        return false;
    }

    // 3. Enviar comando de reinicio remoto (0xDEAD = 57005) en registro 40005 (offset 4)
    _nodeFridgeIO.writeSingleRegister(0x0004, 0xDEAD);
    delay(150);

    log_i("[COMMISSION] Esclavo %u comisionado con éxito a nuevo ID %u.", currentId, newId);
    return true;
}

ModbusEngine::CavaDiagnosticPing ModbusEngine::pingCavaAndCompanion(const char* cavaId) {
    CavaDiagnosticPing diag;
    memset(&diag, 0, sizeof(diag));
    strncpy(diag.cava_id, cavaId, sizeof(diag.cava_id) - 1);

    CavaState* cava = getCavaById(cavaId);
    if (!cava) {
        diag.diagnosis_summary = "Cava no registrada en el sistema";
        return diag;
    }

    diag.kide_id = cava->modbus_id;
    diag.companion_node_id = cava->signaling_node_id;
    diag.companion_channel = cava->signaling_channel;

    // 1. Probar el controlador de frío KIDE
    PingResult prKide = pingSlave(cava->modbus_id);
    diag.kide_online = prKide.success;
    diag.kide_rtt_ms = prKide.rtt_ms;
    diag.temp_pv = prKide.temp_pv;
    diag.hr_pv = prKide.hr_pv;

    // 2. Probar el satélite compañero de señalización (FridgeIO)
    if (cava->signaling_node_id > 0) {
        PingResult prIO = pingSlave(cava->signaling_node_id);
        diag.companion_online = prIO.success;
        diag.companion_rtt_ms = prIO.rtt_ms;
    }

    // 3. Elaborar diagnóstico integral
    if (diag.kide_online && (cava->signaling_node_id == 0 || diag.companion_online)) {
        diag.diagnosis_summary = "Enlace 100% operativo. Controlador Kide y satélite FridgeIO respondiendo.";
    } else if (!diag.kide_online && diag.companion_online) {
        diag.diagnosis_summary = "Línea RS-485 física OK (el satélite FridgeIO responde). El controlador KIDE local no responde (verificar alimentación o bornera B5 del Kide).";
    } else if (diag.kide_online && !diag.companion_online) {
        diag.diagnosis_summary = "Controlador KIDE respondiendo OK, pero el satélite FridgeIO compañero no contesta en ID " + String(cava->signaling_node_id) + ".";
    } else {
        diag.diagnosis_summary = "Sin respuesta de ningún equipo en la cava. Posible cable cortado o bus abierto.";
    }

    return diag;
}

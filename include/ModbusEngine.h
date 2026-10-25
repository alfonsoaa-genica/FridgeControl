#pragma once
#include <Arduino.h>
#include <ModbusMaster.h>
#include <functional>
#include "AppConfig.h"
#include "ModbusTraceStream.h"

struct PingResult {
    uint8_t id;
    bool success;
    uint16_t rtt_ms;
    const char* detected_model; // "KIDE_KP100", "KIDEMATIC_970", "FRIDGE_IO", o "UNKNOWN"
    float temp_pv;
    float hr_pv;
};

// Modos de escaneo independientes por bus físico
enum ScanTarget {
    SCAN_TARGET_NONE,
    SCAN_TARGET_KIDE,      // Puerto 2: RS-422 (Cavas KIDE IDs 1..99)
    SCAN_TARGET_FRIDGE_IO, // Puerto 1: RS-485 (Auxiliares FridgeIO IDs 100..247)
    SCAN_TARGET_ALL        // Ambos buses
};

class ModbusEngine {
public:
    ModbusEngine();
    void begin();
    void update();
    void setTraceCallback(const ModbusTraceStream::FrameCallback& callback);

    // Gestión de Cavas (Puerto 2 / RS-422 KIDE)
    void setCavas(CavaState* cavasArray, size_t count);
    CavaState* getCava(size_t index);
    CavaState* getCavaById(const char* id);
    size_t getCavaCount() const { return _cavaCount; }

    // Gestión de Nodos Auxiliares / Señalización (Puerto 1 / RS-485 FridgeIO)
    void setSignalingNodes(SignalingNode* nodesArray, size_t count);
    SignalingNode* getSignalingNodes() { return _signalingNodes; }
    size_t getSignalingNodeCount() const { return _signalingNodeCount; }
    SignalingNode* getSignalingNodeById(uint8_t modbus_id);

    // Comisionamiento Remoto de Esclavos Auxiliares (Puerto 1 / RS-485)
    bool commissionSignalingSlave(uint8_t currentId, uint8_t newId);

    // =========================================================================
    // 1. COLAS DE COMANDOS ASÍNCRONAS INDEPENDIENTES (Thread-Safe)
    // =========================================================================
    // Cola 1: Auxiliares / FridgeIO (Puerto 1 / RS-485 Nativo)
    bool queueFridgeIOWriteCoil(uint8_t slaveId, uint16_t coilIndex, bool value);
    bool queueFridgeIOWriteCoilsMask(uint8_t slaveId, uint16_t coilMask, uint16_t numCoils);
    bool queueFridgeIOWriteRegister(uint8_t slaveId, uint16_t regAddress, uint16_t value);

    // Aliases para compatibilidad con llamadas existentes
    bool queueWriteCoil(uint8_t slaveId, uint16_t coilIndex, bool value) {
        return queueFridgeIOWriteCoil(slaveId, coilIndex, value);
    }
    bool queueWriteCoilsMask(uint8_t slaveId, uint16_t coilMask, uint16_t numCoils) {
        return queueFridgeIOWriteCoilsMask(slaveId, coilMask, numCoils);
    }

    // Cola 2: Cavas KIDE (Puerto 2 / RS-422 4-Hilos vía FA-ISOCON)
    bool queueKideWriteRegister(uint8_t slaveId, uint16_t regAddress, uint16_t value);
    bool queueWriteSetpointTemp(const char* cavaId, float temp_sp);
    bool queueWriteSetpointHR(const char* cavaId, float hr_sp);

    // =========================================================================
    // 2. SISTEMAS DE AUTO-DESCUBRIMIENTO INDEPENDIENTES
    // =========================================================================
    typedef std::function<void(uint8_t id, const char* model, float temp, float hr)> SlaveDiscoveredCallback;
    typedef std::function<void(size_t totalFound)> ScanCompletedCallback;

    void onSlaveDiscovered(SlaveDiscoveredCallback cb) { _onSlaveDiscovered = cb; }
    void onScanCompleted(ScanCompletedCallback cb) { _onScanCompleted = cb; }

    // Escaneo Red KIDE (RS-422)
    void startKideScan(uint8_t startId = 1, uint8_t endId = 32);
    // Escaneo Red Auxiliares (RS-485)
    void startFridgeIOScan(uint8_t startId = 100, uint8_t endId = 108);
    // Escaneo unificado con selector de bus
    void startBusScan(uint8_t startId, uint8_t endId, ScanTarget target = SCAN_TARGET_ALL);
    void stopBusScan();
    bool isScanning() const { return _scanTarget != SCAN_TARGET_NONE; }
    ScanTarget getScanTarget() const { return _scanTarget; }
    String getScanResultsJson();

    // Pings rápidos independientes por bus
    PingResult pingKide(uint8_t id);
    PingResult pingFridgeIO(uint8_t id);
    PingResult pingSlave(uint8_t id);

    // Diagnóstico Dual: Cava Kide + Satélite Auxiliar Compañero
    struct CavaDiagnosticPing {
        char cava_id[8];
        uint8_t kide_id;
        bool kide_online;
        uint16_t kide_rtt_ms;
        float temp_pv;
        float hr_pv;

        uint8_t companion_node_id;
        char companion_channel;
        bool companion_online;
        uint16_t companion_rtt_ms;

        String diagnosis_summary;
    };
    CavaDiagnosticPing pingCavaAndCompanion(const char* cavaId);

    // Métricas globales de diagnóstico por bus físico
    const ModbusDiagnostics& getKideBusDiagnostics() const { return _kideBusDiag; }
    const ModbusDiagnostics& getFridgeIOBusDiagnostics() const { return _fridgeIOBusDiag; }

private:
    HardwareSerial _serialFridgeIO; // Puerto 1: RS-485 Half-Duplex (Auxiliares FridgeIO)
    ModbusTraceStream _traceFridgeIO;
    ModbusMaster _nodeFridgeIO;

    HardwareSerial _serialKide;     // Puerto 2: RS-422 4-Hilos (Cavas KIDE vía MAX3232 -> FA-ISOCON)
    ModbusTraceStream _traceKide;
    ModbusMaster _nodeKide;

    CavaState* _cavas;
    size_t _cavaCount;
    size_t _currentCavaIdx;

    SignalingNode* _signalingNodes;
    size_t _signalingNodeCount;
    size_t _currentSignalingIdx;

    unsigned long _lastPollTime;
    unsigned long _lastSignalingPollTime;
    unsigned long _lastTrendSampleTime;

    // Dos colas de comandos completamente separadas
    QueueHandle_t _queueFridgeIO;
    QueueHandle_t _queueKide;

    // Métricas globales acumuladas por bus
    ModbusDiagnostics _kideBusDiag;
    ModbusDiagnostics _fridgeIOBusDiag;

    // Estado del escáner de bus
    ScanTarget _scanTarget;
    uint8_t _scanCurrentId;
    uint8_t _scanEndId;
    size_t _scanFoundCount;
    String _scanResults;

    SlaveDiscoveredCallback _onSlaveDiscovered;
    ScanCompletedCallback _onScanCompleted;

    void pollCurrentCava();
    void pollSignalingNodes();
    void readKideKP100(CavaState& cava);
    void readKidematic970(CavaState& cava);
    void processFridgeIOWriteQueue();
    void processKideWriteQueue();
    void processTrendSampling();
    void performScanStep();
};

extern ModbusEngine modbusEngine;

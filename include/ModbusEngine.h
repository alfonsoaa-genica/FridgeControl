#pragma once
#include <Arduino.h>
#include <ModbusMaster.h>
#include <functional>
#include "AppConfig.h"

struct PingResult {
    uint8_t id;
    bool success;
    uint16_t rtt_ms;
    const char* detected_model; // "KIDE_KP100", "KIDEMATIC_970", o "UNKNOWN"
    float temp_pv;
    float hr_pv;
};

class ModbusEngine {
public:
    ModbusEngine();
    void begin();
    void update();

    void setCavas(CavaState* cavasArray, size_t count);
    CavaState* getCava(size_t index);
    CavaState* getCavaById(const char* id);
    size_t getCavaCount() const { return _cavaCount; }

    // Gestión de Nodos de Señalización (FridgeIO)
    void setSignalingNodes(SignalingNode* nodesArray, size_t count);
    SignalingNode* getSignalingNodes() { return _signalingNodes; }
    size_t getSignalingNodeCount() const { return _signalingNodeCount; }
    SignalingNode* getSignalingNodeById(uint8_t modbus_id);

    // Comisionamiento Remoto y Control Directo de Esclavos por Bus RS-485
    bool commissionSignalingSlave(uint8_t currentId, uint8_t newId);
    // Cola de Comandos Asíncrona Half-Duplex (Thread-Safe para evitar colisiones en bus)
    bool queueWriteCoil(uint8_t slaveId, uint16_t coilIndex, bool value);
    bool queueWriteCoilsMask(uint8_t slaveId, uint16_t coilMask, uint16_t numCoils);
    bool queueWriteSetpointTemp(const char* cavaId, float temp_sp);
    bool queueWriteSetpointHR(const char* cavaId, float hr_sp);

    // Callbacks de Auto-Descubrimiento
    typedef std::function<void(uint8_t id, const char* model, float temp, float hr)> SlaveDiscoveredCallback;
    typedef std::function<void(size_t totalFound)> ScanCompletedCallback;

    void onSlaveDiscovered(SlaveDiscoveredCallback cb) { _onSlaveDiscovered = cb; }
    void onScanCompleted(ScanCompletedCallback cb) { _onScanCompleted = cb; }

    // Herramientas de Diagnóstico y Descubrimiento
    void startBusScan(uint8_t startId, uint8_t endId);
    void stopBusScan();
    bool isScanning() const { return _isScanning; }
    String getScanResultsJson();
    PingResult pingSlave(uint8_t id);

    // Diagnóstico Dual: Cava Kide + Satélite Compañero FridgeIO
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

private:
    HardwareSerial _serial;
    ModbusMaster _node;
    CavaState* _cavas;
    size_t _cavaCount;
    size_t _currentCavaIdx;

    SignalingNode* _signalingNodes;
    size_t _signalingNodeCount;
    size_t _currentSignalingIdx;

    unsigned long _lastPollTime;
    unsigned long _lastSignalingPollTime;
    unsigned long _lastTrendSampleTime;

    QueueHandle_t _writeQueue;

    // Escáner de bus
    bool _isScanning;
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
    void processWriteQueue();
    void processTrendSampling();
    void performScanStep();
};

extern ModbusEngine modbusEngine;

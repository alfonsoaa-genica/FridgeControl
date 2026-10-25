#pragma once

#include <Arduino.h>
#include <HardwareSerial.h>
#include <functional>

class ModbusTraceStream : public Stream {
public:
    using FrameCallback = std::function<void(const char*, const char*, const uint8_t*, size_t, bool)>;

    ModbusTraceStream(HardwareSerial& serial, const char* label)
        : _serial(serial), _label(label), _txLength(0), _rxLength(0),
          _txOverflow(false), _rxOverflow(false) {}

    void setFrameCallback(const FrameCallback& callback) {
        _frameCallback = callback;
    }

    template <typename Transaction>
    uint8_t execute(Transaction transaction) {
#if defined(FT_MODBUS_SERIAL_TRACE) && FT_MODBUS_SERIAL_TRACE
        _txLength = 0;
        _rxLength = 0;
        _txOverflow = false;
        _rxOverflow = false;
#endif

        const uint8_t result = transaction();

#if defined(FT_MODBUS_SERIAL_TRACE) && FT_MODBUS_SERIAL_TRACE
        if (_txLength > 0) {
            printFrame("TX", _tx, _txLength, _txOverflow);
            if (_frameCallback) _frameCallback(_label, "TX", _tx, _txLength, _txOverflow);
        }
        if (_rxLength > 0) {
            printFrame("RX", _rx, _rxLength, _rxOverflow);
            if (_frameCallback) _frameCallback(_label, "RX", _rx, _rxLength, _rxOverflow);
        }
        Serial.printf("[MODBUS][%s][RESULT] 0x%02X %s\n", _label, result, resultName(result));
#endif
        return result;
    }

    int available() override {
        return _serial.available();
    }

    int read() override {
        const int value = _serial.read();
#if defined(FT_MODBUS_SERIAL_TRACE) && FT_MODBUS_SERIAL_TRACE
        if (value >= 0 && _txLength > 0) {
            capture(_rx, _rxLength, _rxOverflow, static_cast<uint8_t>(value));
        }
#endif
        return value;
    }

    int peek() override {
        return _serial.peek();
    }

    void flush() override {
        _serial.flush();
    }

    size_t write(uint8_t value) override {
        const size_t written = _serial.write(value);
#if defined(FT_MODBUS_SERIAL_TRACE) && FT_MODBUS_SERIAL_TRACE
        if (written > 0) {
            capture(_tx, _txLength, _txOverflow, value);
        }
#endif
        return written;
    }

    using Print::write;

private:
    static constexpr size_t kMaxFrameLength = 256;

    HardwareSerial& _serial;
    const char* _label;
    FrameCallback _frameCallback;
    uint8_t _tx[kMaxFrameLength];
    uint8_t _rx[kMaxFrameLength];
    size_t _txLength;
    size_t _rxLength;
    bool _txOverflow;
    bool _rxOverflow;

#if defined(FT_MODBUS_SERIAL_TRACE) && FT_MODBUS_SERIAL_TRACE
    static void capture(uint8_t* buffer, size_t& length, bool& overflow, uint8_t value) {
        if (length < kMaxFrameLength) {
            buffer[length++] = value;
        } else {
            overflow = true;
        }
    }

    void printFrame(const char* direction, const uint8_t* frame, size_t length, bool overflow) const {
        Serial.printf("[MODBUS][%s][%s][%u bytes]", _label, direction, static_cast<unsigned>(length));
        for (size_t i = 0; i < length; ++i) {
            Serial.printf(" %02X", frame[i]);
        }
        if (overflow) {
            Serial.print(" ...");
        }
        Serial.println();
    }

    static const char* resultName(uint8_t result) {
        switch (result) {
            case 0x00: return "OK";
            case 0xE0: return "INVALID_SLAVE_ID";
            case 0xE1: return "INVALID_FUNCTION";
            case 0xE2: return "TIMEOUT";
            case 0xE3: return "INVALID_CRC";
            case 0x01: return "EXCEPTION_ILLEGAL_FUNCTION";
            case 0x02: return "EXCEPTION_ILLEGAL_ADDRESS";
            case 0x03: return "EXCEPTION_ILLEGAL_VALUE";
            case 0x04: return "EXCEPTION_SLAVE_FAILURE";
            default: return "MODBUS_ERROR";
        }
    }
#endif
};

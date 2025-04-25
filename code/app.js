const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');
var cliport = process.env.CLI_PORT || 8080;
var connectorsvc= process.env.CONNECTOR_SVC || "mm-ws-connector.mm-ws-connector.svc.cluster.local";
const socket = io('http://' + connectorsvc + ':' + cliport, { extraHeaders: { origin: 'controller-arduino' } });
const ARDUINO_PATH = process.env.ARDUINO_PATH || '/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_AJ031EOX-if00-port0';
socket.on('connect', () => {
    console.log('Connected to Socket.IO server');
});

let arduino = null;

function handleArduinoError(err) {
    console.log('Arduino error/disconnection:', err ? err.message : 'Connection lost');
    if (arduino) {
        arduino.close();
        arduino = null;
    }
}

function tryConnectArduino() {
    if (arduino) {
        return; // Connection already established
    }

    console.log('Attempting to connect to Arduino...');
    arduino = new SerialPort({
        path: ARDUINO_PATH,
        baudRate: 115200,
        autoOpen: false
    });

    arduino.open((err) => {
        if (err) {
            handleArduinoError(err);
            return;
        }

        console.log('Port opened successfully');
        const parser = arduino.pipe(new ReadlineParser({ delimiter: '\r\n' }));
        
        // Connection verification timeout
        const connectionTimeout = setTimeout(() => {
            handleArduinoError(new Error('Connection timeout'));
        }, 2000);

        parser.on('data', (data) => {
            console.log('Received data:', data.toString());
            if (data.toString() === '0') {
                clearTimeout(connectionTimeout);
                console.log('Arduino connected successfully');
                startSerial(arduino);
            }
        });

        arduino.write('0\n', (err) => {
            if (err) {
                handleArduinoError(err);
            }
        });
    });

    arduino.on('error', handleArduinoError);
    arduino.on('close', () => handleArduinoError());
}

// Try to connect every 5 seconds
setInterval(tryConnectArduino, 5000);

// Try first connection immediately
tryConnectArduino();

function startSerial(arduino) {
    if (arduino) {
        arduino.open((err) => {
            if (err) {
            return console.log('Error opening port:', err.message);
            }
            console.log('Arduino connected');
            const parser = arduino.pipe(new ReadlineParser({ delimiter: '\r\n' }));
         
            parser.on('data', (data) => {
                let command = '';
                let params = '';
                console.log("received from arduino: " + data.toString());
                if (data.includes(',')) {
                    command = data.split(',')[0];
                    params = data.split(',')[1];
                    
                } else {
                    command = data;
                }
                if (command == '0') {
                    console.log('Pong!');
                } else if (command == '1') {
                    socket.emit('selectedColors', {colors: params});
                } else if (command == '5') {
                    socket.emit('winner', {winner: params, time: Date.now()});
                }
            });
            socket.on('led', (data) => {
                console.log(data.toString());
                if (data == 1) {
                    console.log("Led on");
                    arduino.write('4,1\n');
                } else {
                    console.log("Led off");
                    arduino.write('4,0\n');
                }
            }
            );
            arduino.on('error', (err) => {
                console.error('Error:', err);
            });

            socket.on('startGame', (data) => {
                console.log('Starting:', data);
                let players = data.players;
                arduino.write('1,' + players + '\n');
            });

            socket.on('stopGame', (data) => {
                console.log('Stop Game:', data);
                arduino.write('2\n');
            });

            socket.on('position', (data) => {
                arduino.write('3\n');
            });
        });
    }
}
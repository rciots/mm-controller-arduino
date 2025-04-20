const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');
const socket = io('http://localhost:8081', { query: { id: 'controller-arduino' } });

socket.on('connect', () => {
    console.log('Connected to Socket.IO server');
});

let arduino  = null;
const serialDevices = fs.readdirSync('/dev')
    .filter(file => file.startsWith('ttyUSB'))
    .map(file => path.join('/dev', file));

let ttyUSB = "";
for (let i = 0; i < serialDevices.length; i++) {
    ttyUSB = serialDevices[i];
    console.log('Path:', ttyUSB);
    let arduinotest = new SerialPort({
        path: ttyUSB,
        baudRate: 250000
    });
    arduinotest.write('0\n', () => {
        
    });
    let ttyTimeout = setTimeout(() => {
        console.log('Timeout, closing port:', arduinotest.path);
        arduinotest.close(); 
        return;
    }, 1000);
    arduinotest.on('data', (data) => {
        if (data.toString() == "0\n") {
            clearTimeout(ttyTimeout);
            console.log('arduino port:', arduinotest.path);
            arduinotest.close();
            arduino = new SerialPort({
                path: ttyUSB,
                baudRate: 250000
            });
            startSerial(arduino);
        } else {
            console.log('MKS founded, skiping to next device');
            console.log("MKS path:", mksporttest.path);
            clearTimeout(ttyTimeout);
            arduinotest.close(); 
        }
    });
}

function startSerial(arduino) {
    if (arduino) {
        const parser = arduino.pipe(new ReadlineParser({ delimiter: '\r\n' }));
        arduino.open((err) => {
            if (err) {
            return console.log('Error opening port:', err.message);
            }
            console.log('Arduino connected');
            setTimeout(() => {
                arduino.write('4,1\n', (err) => {
                    if (err) {
                    return console.log('Error turning light on:', err.message);
                    }
                    console.log('Light turned on.');
                });
            }, 1000);
        }); 
        parser.on('data', (data) => {
            let command = '';
            let params = '';
            if (data.includes(',')) {
                command = data.split(',')[0];
                params = data.split(',')[1];
                
            } else {
                command = data;
            }
            if (command == '0') {
                console.log('Pong!');
            }
        });
        socket.on('led', (data) => {
            console.log('Led:', data);
            if (data == 1) {
                arduino.write('4,1\n');
            } else {
                arduino.write('4,0\n');
            }
        }
        );
        arduino.on('error', (err) => {
            console.error('Error:', err);
        });

        socket.on('startGame', (data) => {
            console.log('Iniciando:', data);
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
    }
}
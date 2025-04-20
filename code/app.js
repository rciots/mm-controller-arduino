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

async function checkPort(tempttyUSB) {
    return new Promise((resolve) => {
        console.log('Path:', tempttyUSB);
        let arduinotest = new SerialPort({
            path: tempttyUSB,
            baudRate: 250000,
            autoOpen: false
        });

        let ttyTimeout = setTimeout(() => {
            console.log('Timeout, closing port:', arduinotest.path);
            arduinotest.close();
            resolve(false);
        }, 10000);

        arduinotest.open((err) => {
            if (err) {
                console.log('Error opening port1: ', tempttyUSB, ' >>> ', err.message);
                arduinotest.close();
                clearTimeout(ttyTimeout);
                resolve(false);
                return;
            }
            console.log('Port opened');
            setTimeout(() => {
                arduinotest.write('0\n', (err) => {
                    if (err) {
                        console.log('Error writing to port2: ', tempttyUSB, ' >>> ', err.message);
                        arduinotest.close();
                        clearTimeout(ttyTimeout);
                        resolve(false);
                        return;
                    }
                });
            }, 1000);
        });

        let errorLogged = false;
        arduinotest.on('error', (err) => {
            if (!errorLogged) {
                console.log('Error opening port3: ', tempttyUSB, ' >>> ', err.message);
                errorLogged = true;
            }
            console.log('Error opening port4: ', tempttyUSB, ' >>> ', err.message);
            arduinotest.close();
            clearTimeout(ttyTimeout);
            resolve(false);
        });

        arduinotest.on('data', (data) => {
            if (data.toString('hex') == '0000') {
                clearTimeout(ttyTimeout);
                console.log('arduino port:', arduinotest.path);
                arduinotest.close();
                arduino = new SerialPort({
                    path: tempttyUSB,
                    baudRate: 250000,
                    autoOpen: false
                });
                startSerial(arduino);
                resolve(true);
            } else {
                console.log('MKS founded, skiping to next device');
                console.log("MKS path:", arduinotest.path);
                clearTimeout(ttyTimeout);
                arduinotest.close();
                resolve(false);
            }
        });
    });
}

async function findArduino() {
    for (let i = 0; i < serialDevices.length; i++) {
        const found = await checkPort(serialDevices[i]);
        if (found) {
            break;
        }
    }
}

findArduino();

function startSerial(arduino) {
    if (arduino) {
        const parser = arduino.pipe(new ReadlineParser({ delimiter: '\r\n' }));
        arduino.open((err) => {
            if (err) {
            return console.log('Error opening port:', err.message);
            }
            console.log('Arduino connected');
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
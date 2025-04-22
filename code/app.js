const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');
var cliport = process.env.CLI_PORT || 8080;
var connectorsvc= process.env.CONNECTOR_SVC || "mm-ws-connector.mm-ws-connector.svc.cluster.local";
const socket = io('http://' + connectorsvc + ':' + cliport, { extraHeaders: { origin: 'controller-arduino' } });

socket.on('connect', () => {
    console.log('Connected to Socket.IO server');
});

let arduino  = null;
const serialDevices = fs.readdirSync('/dev')
    .filter(file => file.startsWith('ttyUSB0'))
    .map(file => path.join('/dev', file));

for (let i = 0; i < serialDevices.length; i++) {
    let tempttyUSB = serialDevices[i];
    console.log('Path:', tempttyUSB);
    let arduinotest = new SerialPort({
        path: tempttyUSB,
        baudRate: 250000,
        autoOpen: false
    });
    arduinotest.open((err) => {
        if (err) {
            console.log('Error opening port1: ', tempttyUSB, ' >>> ',   err.message);
            arduinotest.close();
            return;
        }
        console.log('Port opened');
        const parser = arduinotest.pipe(new ReadlineParser({ delimiter: '\r\n' }));
        parser.on('data', (data) => { 
            if (data.toString() == '0') {
                clearTimeout(ttyTimeout);
                console.log('arduino port:', arduinotest.path);
                arduinotest.close();
                arduino = new SerialPort({
                    path: tempttyUSB,
                    baudRate: 250000,
                    autoOpen: false
                });
                startSerial(arduino);
            } else {
                console.log('MKS founded, skiping to next device');
                console.log("MKS path:", arduinotest.path);
                clearTimeout(ttyTimeout);
                arduinotest.close(); 
            }
        });
        setTimeout(() => {
            arduinotest.write('0\n', (err) => {
                if (err) {
                    console.log('Error writing to port3: ', tempttyUSB, ' >>> ',   err.message);
                    arduinotest.close();
                    return;
                }
            });
        }, 1000);
        // if the port is in use, skip to next device
    let errorLogged = false;
    arduinotest.on('error', (err) => {
        if (!errorLogged) {
            console.log('Error opening port4: ', tempttyUSB, ' >>> ',   err.message);
            errorLogged = true;
        }
        console.log('Error opening port5: ', tempttyUSB, ' >>> ',   err.message);
        arduinotest.close();
        return;
    });
    let ttyTimeout = setTimeout(() => {
        console.log('Timeout, closing port:', arduinotest.path);
        arduinotest.close(); 
        return;
    }, 10000);
    

    });
    
}

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
                }
            });
            socket.on('led', (data) => {
                console.log(data.toString());
                if (data == 1) {
                    console.log("Led on");
                    arduino.write('4,1');
                } else {
                    console.log("Led off");
                    arduino.write('4,0');
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
        });
    }
}
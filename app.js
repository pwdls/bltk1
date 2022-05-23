const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const config = require('config');

const PORT = config.get('port') || 5000;
const index = require('./routes/index');

const app = express();
app.use(index);

const server = http.createServer(app)
const io = socketIo(server, {
    cors: {
        origin: '*',
    }
});

const mysql = require('mysql');
const connection = mysql.createConnection({
    host: config.get('hostDB'),
    user: config.get('userDB'),
    password: config.get('passwordDB'),
    database: config.get('dataBaseDB')
});

const currentState = require("./services/socketAPI/currentState");
const movingWagons = require("./services/socketAPI/movingWagons");

connection.connect();

io.on("connection", (socket) => {
    console.log(`New client connection ${socket.id}`);
    currentState(socket, connection);

    socket.on("updateAll", ()=>{
        currentState(socket, connection);
    });

    socket.on("movingWagons", data => {
        movingWagons(data, io, connection);
    });

    socket.on("disconnect", () => {
        console.log(`Client disconnected ${socket.id}`);
    });
});

server.listen(PORT, () => console.log(`Listening on port ${PORT}`));

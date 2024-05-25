const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const connectDB = require('./db');
const CryptoJS = require('crypto-js');
const { Message, Round, Room } = require('./models');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: '*',
    }
});

const PORT = process.env.PORT || 4000;
const secretKey = process.env.SECRETKEY || 'secretkey';

connectDB();

io.on('connection', (socket) => {
    console.log('Nuevo cliente conectado');

    socket.on('createRoom', async ({ room, user }) => {
        console.log(`Intentando crear sala: ${room} por el usuario: ${user.displayName}`);
        console.log('Photo URL:', user.photoURL);
        let roomData = await Room.findOne({ name: room });

        if (roomData) {
            console.log(`La sala ${room} ya existe`);
            socket.emit('error', { message: 'La sala ya existe' });
            return;
        }

        roomData = new Room({
            name: room,
            users: [{ ...user, id: socket.id, vote: '', online: true, role: 'admin' }],
            messages: [],
            topic: '',
            rounds: [],
        });

        await roomData.save();

        console.log(`Sala ${room} creada exitosamente`);
        socket.join(room);
        socket.emit('init', { users: roomData.users, messages: roomData.messages, topic: roomData.topic });
        io.in(room).emit('updateUsers', roomData.users);
    });

    socket.on('joinRoom', async ({ room, user }) => {
        console.log(`Usuario ${user.displayName} intentando unirse a la sala: ${room}`);
        let roomData = await Room.findOne({ name: room });

        if (!roomData) {
            console.log(`La sala ${room} no existe`);
            socket.emit('error', { message: 'La sala no existe' });
            return;
        }

        const existingUser = roomData.users.find(u => u.uid === user.uid);
        if (existingUser) {
            existingUser.id = socket.id;
            existingUser.online = true;
        } else {
            const newUser = { ...user, id: socket.id, vote: '', online: true, role: 'member' };
            roomData.users.push(newUser);
        }

        await roomData.save();

        console.log(`Usuario ${user.displayName} se ha unido a la sala: ${room}`);
        socket.join(room);
        socket.emit('init', { users: roomData.users, messages: roomData.messages, topic: roomData.topic });
        io.in(room).emit('updateUsers', roomData.users);

        // Broadcast a todos los usuarios de la sala
        const joinMessage = { user, content: `${user.displayName} se ha unido a la sala`, timestamp: new Date() };
        roomData.messages.push(joinMessage);
        await roomData.save();
        io.in(room).emit('updateMessages', roomData.messages);
    });

    socket.on('disconnect', async () => {
        console.log('Cliente desconectado');
        const rooms = await Room.find();

        rooms.forEach(async room => {
            const user = room.users.find(user => user.id === socket.id);
            if (user) {
                user.online = false;
                // Broadcast a todos los usuarios de la sala
                const leaveMessage = { user, content: `${user.displayName} ha abandonado la sala`, timestamp: new Date() };
                room.messages.push(leaveMessage);
                await room.save();
                io.in(room.name).emit('updateMessages', room.messages);
            }
            await room.save();
            io.in(room.name).emit('updateUsers', room.users);
        });
    });

    socket.on('newMessage', async ({ room, message }) => {
        console.log(`Nuevo mensaje en la sala ${room} por el usuario: ${message.user.displayName}, mensaje: ${message.content}`);
        const roomData = await Room.findOne({ name: room });

        const newMessage = new Message(message);
        roomData.messages.push(newMessage);
        await roomData.save();

        io.in(room).emit('updateMessages', roomData.messages);
    });

    socket.on('vote', async ({ room, userId, vote }) => {
        console.log(`Nuevo voto en la sala ${room} por el usuario ID: ${userId}, voto: ${vote}`);
        const roomData = await Room.findOne({ name: room });
        // encripta solo si es distinto de string vacio, no null, sino string vacio
        const encryptedVote = vote ? CryptoJS.AES.encrypt(vote, secretKey).toString() : '';


        roomData.users = roomData.users.map(user => {
            if (user.uid === userId) {
                return { ...user, vote: encryptedVote };
            }
            return user;
        });
        await roomData.save();

        io.in(room).emit('updateUsers', roomData.users);

        if (vote) {
            // broadcast a los demás usuarios sobre que el usuario votó
            const user = roomData.users.find(user => user.uid === userId);
            const voteMessage = { user, content: `ha votado.`, timestamp: new Date() };
            roomData.messages.push(voteMessage);
            await roomData.save();
            io.in(room).emit('updateMessages', roomData.messages);
        }
    });

    socket.on('revealVotes', async (room) => {
        console.log(`Revelar votos en la sala ${room}`);
        const roomData = await Room.findOne({ name: room });

        roomData.users = roomData.users.map(user => {
            if (user.vote) {
                const bytes = CryptoJS.AES.decrypt(user.vote, secretKey);
                const originalVote = bytes.toString(CryptoJS.enc.Utf8);
                return { ...user, vote: originalVote };
            }
            return user;
        });

        const votes = roomData.users.filter(user => user.vote).map(user => user.vote);
        const results = calculateResults(votes);

        // Guardar los resultados de la ronda
        const newRound = new Round({
            topic: roomData.topic,
            results,
            users: roomData.users,
        });
        roomData.rounds.push(newRound);
        await roomData.save();

        io.in(room).emit('results', { users: roomData.users, results });

        // Emitir un broadcast message con los resultados formateados como texto
        const resultMessageContent = `[SYSTEM] Los resultados son: \nPromedio = ${results.avg},\nMínimo = ${results.min},\nMáximo = ${results.max},\nRatio = ${results.ratio.toFixed(2)}%`;
        const resultMessage = { user: { displayName: 'Sistema', photoURL: "https://firebasestorage.googleapis.com/v0/b/lumo-tasks.appspot.com/o/public%2Flogo.svg?alt=media&token=e1f607d1-b67e-49ef-beee-d17db1389553" }, content: resultMessageContent, timestamp: new Date() };
        roomData.messages.push(resultMessage);
        await roomData.save();
        io.in(room).emit('updateMessages', roomData.messages);



    });

    socket.on('changeTopic', async ({ room, newTopic }) => {
        console.log(`Cambiar tópico en la sala ${room} a: ${newTopic}`);
        const roomData = await Room.findOne({ name: room });

        roomData.topic = newTopic;
        roomData.users = roomData.users.map(user => ({ ...user, vote: '' }));
        await roomData.save();

        io.in(room).emit('newTopic', newTopic);
        io.in(room).emit('updateUsers', roomData.users);
    });

    socket.on('resetRoom', async ({ room }) => {
        console.log(`Reiniciar sala ${room}`);
        const roomData = await Room.findOne({ name: room });

        roomData.users = roomData.users.map(user => ({ ...user, vote: '' }));
        roomData.messages = [];
        await roomData.save();

        // se debe emitir results para que los votos se limpien en el frontend
        io.in(room).emit('results', { users: roomData.users, results: { avg: 0, min: 0, max: 0, ratio: 0, reset: true } });
    });

    socket.on('getVote', async ({ room, userId }) => {
        const roomData = await Room.findOne({ name: room });
        const user = roomData.users.find(user => user.uid === userId);

        if (user && user.vote) {
            const bytes = CryptoJS.AES.decrypt(user.vote, secretKey);
            const originalVote = bytes.toString(CryptoJS.enc.Utf8);
            socket.emit('receiveVote', originalVote);
        } else {
            socket.emit('receiveVote', '');
        }
    });

});

function calculateResults(votes) {
    let avg = votes.reduce((a, b) => a + parseFloat(b), 0) / votes.length;
    const min = Math.min(...votes.map(v => parseFloat(v)));
    const max = Math.max(...votes.map(v => parseFloat(v)));
    // acercar avg a un valor de la escala de fibonacci [1, 2, 3, 5, 8]
    const fibonacci = [1, 2, 3, 5, 8];
    avg = fibonacci.reduce((prev, curr) => Math.abs(curr - avg) < Math.abs(prev - avg) ? curr : prev);

    const agreedWithAvg = votes.filter(vote => parseFloat(vote) === avg).length;
    const ratio = (agreedWithAvg / votes.length) * 100;

    console.log('agreedWithAvg', agreedWithAvg, 'votes.length', votes.length, 'ratio', ratio);

    return { avg, min, max, ratio };
}

server.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));

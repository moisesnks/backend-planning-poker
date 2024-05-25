const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    displayName: String,
    photoURL: {
        type: String,
        default: function () {
            return `https://ui-avatars.com/api/?name=${this.displayName}&background=random`;
        }
    },
    online: Boolean,
    uid: String,
    vote: String,
    role: String,
    id: String,
    _id: false,
});

const messageSchema = new mongoose.Schema({
    user: userSchema,
    content: String,
    timestamp: { type: Date, default: Date.now },
});

const roundSchema = new mongoose.Schema({
    topic: String,
    results: {
        avg: Number,
        min: Number,
        max: Number,
        ratio: Number,
        reset: { type: Boolean, default: false }
    },
    users: [userSchema],
    timestamp: { type: Date, default: Date.now },
});

const roomSchema = new mongoose.Schema({
    name: String,
    users: [userSchema],
    messages: [messageSchema],
    topic: String,
    rounds: [roundSchema],
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Round = mongoose.model('Round', roundSchema);
const Room = mongoose.model('Room', roomSchema);

module.exports = { User, Message, Round, Room };

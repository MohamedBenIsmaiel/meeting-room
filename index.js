const express = require('express');
const path    = require('path');

const app     = express();
const server  =  app.listen(4000, () => console.log('server is running '));
const io= require('socket.io')(server, {
    allowEIO3: true,
});

app.use(express.static(path.join(__dirname, '')));

const userConnections = [];

io.on('connection', (socket) => {
    console.log('socket id ', socket.id)
    socket.on('userConnect', ({userId, meetingId}) => {
        // get all users in specific meeting
        const meetingUsers = userConnections.filter((meeting) => meeting.meetingId == meetingId);

        userConnections.push({ // push new users to users connection 
            connectionId: socket.id,
            userId, 
            meetingId,
        });

        if(meetingUsers.length){
            // if there is users in meeting room 
            // i will notify them there is a new users has been joined
            meetingUsers.forEach(user => {
                socket.to(user.connectionId).emit('userJoined', {
                    userId,
                    connectionId: socket.id,
                });
            })
        }
    })
})
class App{
    constructor(userId, meetingId){
        this.peersConnectionIds = [];
        this.peersConnection = [];
        this.remoteVideoStream = [];
        this.remoteAudioStream = [];
        this.serverProcess = this.SDP;
        this.socket = io.connect();
        this.userId = userId;
        this.meetingId = meetingId;
        this.myConnectionId;
        this.localDev;
        this.audio;
        this.isAudioMute = true;
        this.rtpAudioSenders = [];
        this.videoStates = {
            None: 0,
            Camera: 1,
            ScreenShare: 2,
        }
        this.videoSt = this.videoStates.None;
        this.videoCamTrack;
        this.rtpVideoSenders = [];

        this.initApp(userId);
        this.initEventProcess();
        this.userJoined();
    }

    initApp(userId, ){
        $('#meetingContainer').show();
        $('#me h2').text(userId+" (Me)")
        document.title = userId;
    }

    async initEventProcess(){
        this.socket.on('connect', async() => {
            if(this.socket.connected){

                await this.init(this.SDP, this.socket.id)

                if(this.userId && this.meetingId){
                    this.socket.emit('userConnect', {
                        userId: this.userId,
                        meetingId: this.meetingId,
                    });
                }
            }
        })
    }

    async SDPProcess(message, fromConnectionId){
        const getMessage = JSON.parse(message)
        if(getMessage.answer){
            await this.peersConnection[fromConnectionId]
                .setRemoteDescription(new RTCSessionDescription(getMessage.answer))

        }else if(getMessage.offer){
            if(!this.peersConnection[fromConnectionId]){
                await this.setConnection(fromConnectionId);
            }

            await this.peersConnection[fromConnectionId]
                .setRemoteDescription(new RTCSessionDescription(getMessage.offer))

            const answer = this.peersConnection[fromConnectionId].createAnswer();
            await this.peersConnection[fromConnectionId].setLocalDescription(answer);

            this.serverProcess(JSON.stringify({
                 answer,
            }), fromConnectionId)

        }else if(getMessage.icecandidate){

            if(!this.peersConnection[fromConnectionId]){
                await this.setConnection(fromConnectionId)

                try{
                    await this.peersConnection[fromConnectionId].addIceCandidate(getMessage.icecandidate);
                }catch(e){
                    console.log('#### error ### ', e)
                }
            }
        }
    }

    async processClientFunc(message, fromConnectionId){
        await this.SDPProcess(message, fromConnectionId);
    }

    async userJoined(){
        this.socket.on('userJoined', async({ userId, connectionId }) => {
            this.addUser({ userId, connectionId });
            await this.setConnection(connectionId);
        })

        this.socket.on('informMeAboutOtherUser', async({ meetingUsers }) => {

            meetingUsers.map(async(user) => {
                 this.addUser({ userId: user.userId, connectionId: user.connectionId });
                await this.setConnection(user.connectionId);
            })
        })

        this.socket.on('SDPProcess', async ({message, fromConnectionId})=> {
            await this.processClientFunc(message, fromConnectionId);
        })
    }

    addUser({ userId, connectionId }){
       let otherTemplateClone =  $('#otherTemplate').clone(); // get an instance from this div
       otherTemplateClone = otherTemplateClone.attr('id', connectionId).addClass('other'); // set attributes
       otherTemplateClone.find('h2').attr('id', userId).text(userId)// find h2 inside div and set h2 to his name
       otherTemplateClone.find('video').attr('id', `v_${connectionId}`)// find video inside div and set its id to v_connectionId
       otherTemplateClone.find('audio').attr('id', `a_${connectionId}`)// find audio inside div and set its id to a_connectionId
       otherTemplateClone.show(); // toggle from display none to display
       $('#divUsers').append(otherTemplateClone); // push new cloned div into a parent
    }


    async setOffer(connectionId){
        const connection = this.peersConnection[connectionId];
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        this.serverProcess(JSON.stringify({
            offer: connection.localDescription,
        }), connectionId)
    }


    async setConnection(connectionId){
        /*
        const iceConfiguration = {
            iceServers: [
                {
                    urls: 'stun:stun.l.google.com/19302',
                },
                {
                    urls: 'stun:stun1.l.google.com/19302'
                }
            ]
        }
        */

        const iceConfiguration = [{"urls":["turn:domain.com:8080?transport=udp","turn:domain.com:8080?transport=tcp","turn:domain.com:8080"],"username":"test","credential":"password"}];



        const self = this;

        const connection = new RTCPeerConnection(iceConfiguration);
        connection.onnegotiationneeded = async function(event){
            await self.setOffer(connectionId);
        }
        connection.onicecandidate = function(event){
            if(event.candidate){
                self.serverProcess(JSON.stringify({
                    icecandidate: event.candidate,
                }), connectionId);
            }
        }
        connection.ontrack = function(event){
            if(!self.remoteVideoStream[connectionId]){
                self.remoteVideoStream[connectionId] = new MediaStream();
            }

            if(!self.remoteAudioStream[connectionId]){
                self.remoteAudioStream[connectionId] = new MediaStream();
            }

            if(event.track.kind == "video"){
                self.remoteVideoStream[connectionId]
                    .getVideoTracks()
                    .forEach((t) => {
                        self.remoteVideoStream[connectionId]
                            .removeTrack(t);
                    })

                self.remoteVideoStream[connectionId].addTrack(event.track);
                const remoteVideoPlayer = document.getElementById('v_'+connectionId);
                remoteVideoPlayer.srcObject = null;
                remoteVideoPlayer.srcObject = self.remoteVideoStream[connectionId];
                remoteVideoPlayer.load();

            }else if(event.track.kind == 'audio'){
                self.remoteAudioStream[connectionId]
                    .getAudioTracks()
                    .forEach((t) => {
                        self.remoteAudioStream[connectionId]
                            .removeTrack(t);
                    })

                self.remoteAudioStream[connectionId].addTrack(event.track);
                const remoteAudioPlayer = document.getElementById('a_'+connectionId);
                remoteAudioPlayer.srcObject = null;
                remoteAudioPlayer.srcObject = self.remoteAudioStream[connectionId];
                remoteAudioPlayer.load();

            }
        }

        this.peersConnectionIds[connectionId] = connectionId;
        this.peersConnection[connectionId] = connection;

        if(this.videoSt == this.videoStates.Camera || 
            this.videoSt == this.videoStates.ScreenShare){
            
            if(this.videoCamTrack){
                this.updateMediaSenders(this.videoCamTrack, this.rtpVideoSenders)
            }
        }
        return connection;
    }

    async SDP(data, toConnectionId){
        this.socket.emit('SDPProcess', {
            message: data,
            toConnectionId,
        });
    }

    async init(SDPFn, myConnectionId){
        this.serverProcess = SDPFn;
        this.myConnectionId = myConnectionId;
        this.eventProcess();
        this.localDev = document.getElementById('localVideoPlayer');
    }

    async eventProcess(){
        const self = this;
        $("#miceMuteUnmute").on("click", async function() {
            if(!self.audio) {
                await self.loadAudio();
            }

            if(!self.audio) {
                alert('Audio Permission has not granted')
                return;
            }

            if(self.isAudioMute){
                self.audio.enabled = true;
                $(self).html('<span class="material-icons" style="width: 100%;">mic</span>')
                
                self.updateMediaSenders(self.audio, self.rtpAudioSenders);
            }else{
                self.audio.enabled = false;
                $(self).html('<span class="material-icons" style="width: 100%;" >mic-off</span>')

                self.removeMediaSenders(self.rtpAudioSenders)
            }
            self.isAudioMute = !self.isAudioMute
        });
        
        // video cam
        $('#VideoCamOnOff').on('click', async function(){
            if(self.videoSt == self.videoStates.Camera){
                await self.videoProcess(self.videoStates.None)
            }else{
                await self.videoProcess(self.videoStates.Camera);
            }
        });

        $('#screenShareOnOff').on('click', async function(){
            if(self.videoSt == self.videoStates.ScreenShare){
                await self.videoProcess(self.videoStates.None)
            }else{
                await self.videoProcess(self.videoStates.ScreenShare);
            }
        });

    }

    removeMediaSenders(rtpSenders){
        for(let connectionId in this.peersConnectionIds){
            if(rtpSenders[connectionId] && 
                this.connectionStatus(this.peersConnection[connectionId])){
                    this.peersConnection[connectionId].removeTrack(rtpSenders[connectionId]);
                    rtpSenders[connectionId] = null;
            }
        }
    }

    async loadAudio(){
        try{
            let astream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true,
            });
            this.audio = astream.getAudioTracks()[0];
            this.audio.enabled = false;
        }catch(e){
            console.log('########### error ', e)
        }
    }
    
    removeVideoStream(rtpSenders){
        if(this.videoCamTrack){
            this.videoCamTrack.stop();
            this.videoCamTrack = null;
            this.localDev.srcObject = null;
            this.removeMediaSenders(rtpSenders)
        }
    }

    async videoProcess(newVideoState){

        if(newVideoState == this.videoStates.None){
            $('#VideoCamOnOff').html('<span class="material-icons" style="width: 100%;">videocam_off</span>')
            this.videoSt = newVideoState;
            this.removeVideoStream(this.rtpVideoSenders);
            return;
        }

       if(newVideoState == this.videoStates.Camera){
            $('#VideoCamOnOff').html('<span class="material-icons" style="width: 100%;">videocam_on</span>')
        }

        try{
            let vstream = null;
            if(newVideoState == this.videoStates.Camera){

                vstream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        width: 1920,
                        height:1080,
                    },
                    audio: false,
                })

            }else if(newVideoState == this.videoStates.ScreenShare){

                vstream = await navigator.mediaDevices.getDisplayMedia({
                    video: { 
                        width: 1920,
                        height:1080,
                    },
                    audio: false,
                })
            }

            if(vstream && vstream.getVideoTracks().length > 0){
                this.videoCamTrack = vstream.getVideoTracks()[0];
                if(this.videoCamTrack){
                    this.localDev.srcObject = new MediaStream([this.videoCamTrack])
                    this.updateMediaSenders(this.videoCamTrack, this.rtpVideoSenders);
                }
            }
        }catch(e){
            console.log('########## error ', e)
        }

        this.videoSt = newVideoState;

    }

   

    connectionStatus(connections){
        if(connections && (connections.connectionState == 'new ' || 
        connections.connectionState == 'connecting' ||
        connections.connectionState == 'connected')){
            return true;
        }
        return false;
    }

    updateMediaSenders(track, rtpSenders){
        for(let connectionId in this.peersConnectionIds){
            if(this.connectionStatus(this.peersConnection[connectionId])){
                if(rtpSenders[connectionId] && rtpSenders[connectionId].track){
                    rtpSenders[connectionId].replaceTrack(track)
                }else{
                    rtpSenders[connectionId] = this.peersConnection[connectionId].addTrack(track);
                }
            }
        }

    }
}

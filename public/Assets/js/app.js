class App{
    constructor(userId, meetingId){
        this.peersConnectionIds = [];
        this.peersConnection = [];
        this.serverProcess = this.SDP;
        this.socket = io.connect();
        this.userId = userId;
        this.meetingId = meetingId;
        this.init(this.userId, this.meetingId);
        this.eventProcess();
        this.userJoined();
    }

    init(userId, meetingId){
        console.log(`fuck that shit ${userId} , ${meetingId}`)
    }

    eventProcess(){
        this.socket.on('connect', () => {
            if(this.socket.connected){

                this.init(this.SDP, this.socket.id)

                if(this.userId && this.meetingId){
                    this.socket.emit('userConnect', {
                        userId: this.userId,
                        meetingId: this.meetingId,
                    });
                }
            }
        })
    }

    userJoined(){
        this.socket.on('userJoined', ({ userId, connectionId }) => {
            this.addUser({ userId, connectionId });
            alert('new user has been joined ')
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

    async setConnection(connectionId){
        iceConfiguration = {
            iceServers: [
                {
                    urls: 'stun:stun.l.google.com/19302',
                },
                {
                    urls: 'stun:stun1.l.google.com/19302'
                }
            ]
        }
        const connection = new RTCPeerConnection(iceConfiguration);
        connection.onnegotiationneeded = async function(event){
            await this.setOffer(connectionId);
        }
        connection.onicecandidate = function(event){
            if(event.candidate){
                this.serverProcess(JSON.stringify({
                    icecandidate: event.candidate,
                }), connectionId);
            }
        }
        connection.ontrack = function(event){

        }
        this.peersConnectionIds[connectionId] = connectionId;
        this.peersConnection[connectionId] = connection;
    }

    SDP(data, toConnectionId){
        this.socket.emit('SDPProcess', {
            message: data,
            toConnectionId,
        });
    }

    init(SDPFn, myConnectionId){}

    async setOffer(connectionId){
        const connection = this.peersConnection[connectionId];
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        this.serverProcess(JSON.stringify({
            offer: connection.localDescription,
        }), connectionId)
    }
}

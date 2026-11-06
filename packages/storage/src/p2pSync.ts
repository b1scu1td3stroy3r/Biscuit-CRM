/**
 * Zero-Knowledge Peer-to-Peer State Sync Engine
 * Uses WebRTC DataChannels for browser-to-browser sync with no central CRM cloud.
 */

export interface PeerMessage {
  type: 'SYNC_UPDATE' | 'CURSOR_PRESENCE' | 'BROADCAST_NOTIFICATION';
  payload: any;
  senderId: string;
  timestamp: string;
}

export class P2PClientSync {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private onMessageCallback: ((msg: PeerMessage) => void) | null = null;
  public peerId: string;

  constructor() {
    this.peerId = 'peer_' + Math.random().toString(36).substring(2, 9);
  }

  public initAsHost(onOfferCreated: (offerSDP: string) => void) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    this.dataChannel = this.peerConnection.createDataChannel('biscuit_sync_channel');
    this.setupDataChannelHandlers(this.dataChannel);

    this.peerConnection.onicecandidate = (event) => {
      if (!event.candidate && this.peerConnection?.localDescription) {
        onOfferCreated(JSON.stringify(this.peerConnection.localDescription));
      }
    };

    this.peerConnection.createOffer().then((offer) => {
      this.peerConnection?.setLocalDescription(offer);
    });
  }

  public async connectWithAnswer(answerSDPString: string) {
    if (!this.peerConnection) return;
    try {
      const answer = JSON.parse(answerSDPString);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err) {
      console.error('Failed to set remote answer:', err);
    }
  }

  public async initAsGuest(offerSDPString: string, onAnswerCreated: (answerSDP: string) => void) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelHandlers(this.dataChannel);
    };

    this.peerConnection.onicecandidate = (event) => {
      if (!event.candidate && this.peerConnection?.localDescription) {
        onAnswerCreated(JSON.stringify(this.peerConnection.localDescription));
      }
    };

    const offer = JSON.parse(offerSDPString);
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
  }

  private setupDataChannelHandlers(dc: RTCDataChannel) {
    dc.onopen = () => console.log('Zero-Knowledge P2P DataChannel open.');
    dc.onmessage = (event) => {
      try {
        const msg: PeerMessage = JSON.parse(event.data);
        if (this.onMessageCallback) this.onMessageCallback(msg);
      } catch (err) {
        console.error('Failed to parse peer message:', err);
      }
    };
  }

  public onMessage(callback: (msg: PeerMessage) => void) {
    this.onMessageCallback = callback;
  }

  public broadcast(type: PeerMessage['type'], payload: any) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      const msg: PeerMessage = {
        type,
        payload,
        senderId: this.peerId,
        timestamp: new Date().toISOString()
      };
      this.dataChannel.send(JSON.stringify(msg));
    }
  }
}

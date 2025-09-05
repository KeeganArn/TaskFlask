import React, { useState, useRef, useEffect } from 'react';
import { 
  Phone, 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor,
  Users,
  Settings,
  X
} from 'lucide-react';

interface CallParticipant {
  id: number;
  user_id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  is_muted: boolean;
  is_video_enabled: boolean;
  connection_quality: 'excellent' | 'good' | 'fair' | 'poor';
}

interface VideoCallProps {
  roomId: string;
  callType: 'audio' | 'video';
  onEndCall: () => void;
  chatRoomId?: number;
}

const VideoCall: React.FC<VideoCallProps> = ({ 
  roomId, 
  callType, 
  onEndCall,
  chatRoomId 
}) => {
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<{ [userId: number]: RTCPeerConnection }>({});
  
  const startTime = useRef<number>(Date.now());

  // Update call duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Initialize media devices
  useEffect(() => {
    initializeMedia();
    return () => {
      cleanup();
    };
  }, []);

  const initializeMedia = async () => {
    try {
      const constraints = {
        audio: true,
        video: isVideoEnabled
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Join the call
      await joinCall();
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  };

  const joinCall = async () => {
    try {
      // In a real implementation, this would integrate with your signaling server
      // For now, we'll simulate the call interface
      console.log('Joining call room:', roomId);
      
      // Simulate participants
      setParticipants([
        {
          id: 1,
          user_id: 1,
          username: 'current_user',
          first_name: 'You',
          is_muted: false,
          is_video_enabled: isVideoEnabled,
          connection_quality: 'excellent'
        }
      ]);
    } catch (error) {
      console.error('Error joining call:', error);
    }
  };

  const toggleMute = async () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
        
        // Update participant settings on server
        await updateParticipantSettings({
          is_muted: !isMuted
        });
      }
    }
  };

  const toggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoEnabled;
        setIsVideoEnabled(!isVideoEnabled);
        
        // Update participant settings on server
        await updateParticipantSettings({
          is_video_enabled: !isVideoEnabled
        });
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Replace video track with screen share
        const videoTrack = screenStream.getVideoTracks()[0];
        
        if (localStreamRef.current) {
          const sender = Object.values(peerConnectionsRef.current)[0]?.getSenders()
            .find(s => s.track?.kind === 'video');
          
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        }
        
        setIsScreenSharing(true);
        
        // Handle screen share end
        videoTrack.onended = () => {
          setIsScreenSharing(false);
          // Switch back to camera
        };
      } else {
        // Stop screen sharing and switch back to camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        const videoTrack = stream.getVideoTracks()[0];
        const sender = Object.values(peerConnectionsRef.current)[0]?.getSenders()
          .find(s => s.track?.kind === 'video');
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
        
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  };

  const updateParticipantSettings = async (settings: any) => {
    try {
      // In real implementation, this would call the API
      console.log('Updating participant settings:', settings);
    } catch (error) {
      console.error('Error updating participant settings:', error);
    }
  };

  const endCall = async () => {
    cleanup();
    onEndCall();
  };

  const cleanup = () => {
    // Stop all media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Close all peer connections
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getConnectionColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'fair': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {callType === 'video' ? (
              <Video className="h-5 w-5 text-green-500" />
            ) : (
              <Phone className="h-5 w-5 text-green-500" />
            )}
            <span className="font-medium">
              {callType === 'video' ? 'Video Call' : 'Voice Call'}
            </span>
          </div>
          <div className="text-sm text-gray-300">
            {formatDuration(callDuration)}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-sm text-gray-300">
            <Users className="h-4 w-4" />
            <span>{participants.length}</span>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Settings className="h-5 w-5" />
          </button>
          <button
            onClick={endCall}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 relative bg-gray-900">
        {callType === 'video' && (
          <div className="w-full h-full flex items-center justify-center">
            {/* Remote video would go here */}
            <div className="text-white text-center">
              <Video className="h-16 w-16 mx-auto mb-4 text-gray-500" />
              <p className="text-gray-300">Waiting for other participants...</p>
            </div>
          </div>
        )}

        {callType === 'audio' && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-32 h-32 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="h-16 w-16 text-gray-400" />
              </div>
              <p className="text-white text-lg font-medium">Voice Call Active</p>
              <p className="text-gray-300">Audio only mode</p>
            </div>
          </div>
        )}

        {/* Local Video Preview */}
        {callType === 'video' && (
          <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
              You
            </div>
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="bg-gray-900 p-4 flex items-center justify-center space-x-4">
        <button
          onClick={toggleMute}
          className={`p-3 rounded-full transition-colors ${
            isMuted 
              ? 'bg-red-600 hover:bg-red-700' 
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          {isMuted ? (
            <MicOff className="h-6 w-6 text-white" />
          ) : (
            <Mic className="h-6 w-6 text-white" />
          )}
        </button>

        {callType === 'video' && (
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-colors ${
              !isVideoEnabled 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {!isVideoEnabled ? (
              <VideoOff className="h-6 w-6 text-white" />
            ) : (
              <Video className="h-6 w-6 text-white" />
            )}
          </button>
        )}

        <button
          onClick={toggleScreenShare}
          className={`p-3 rounded-full transition-colors ${
            isScreenSharing 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          <Monitor className="h-6 w-6 text-white" />
        </button>

        <button
          onClick={endCall}
          className="p-3 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
        >
          <PhoneOff className="h-6 w-6 text-white" />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-16 right-4 w-64 bg-white rounded-lg shadow-lg p-4 z-10">
          <h3 className="font-medium text-gray-900 mb-4">Call Settings</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-2">Audio Input</label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option>Default Microphone</option>
              </select>
            </div>
            
            {callType === 'video' && (
              <div>
                <label className="block text-sm text-gray-600 mb-2">Video Input</label>
                <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                  <option>Default Camera</option>
                </select>
              </div>
            )}
            
            <div>
              <label className="block text-sm text-gray-600 mb-2">Audio Output</label>
              <select className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option>Default Speaker</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;

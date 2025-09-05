import React, { createContext, useContext, useState, useEffect } from 'react';
import { callsApi } from '../services/api';

interface CallContextType {
  currentCall: CallSession | null;
  isInCall: boolean;
  startCall: (chatRoomId: number, callType: 'audio' | 'video', participantIds?: number[]) => Promise<void>;
  joinCall: (roomId: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  isMuted: boolean;
  isVideoEnabled: boolean;
}

interface CallSession {
  id: number;
  room_id: string;
  chat_room_id: number;
  call_type: 'audio' | 'video';
  status: 'initiated' | 'ongoing' | 'ended';
  participants_count: number;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

interface CallProviderProps {
  children: React.ReactNode;
}

export const CallProvider: React.FC<CallProviderProps> = ({ children }) => {
  const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const isInCall = currentCall !== null;

  const startCall = async (
    chatRoomId: number, 
    callType: 'audio' | 'video', 
    participantIds: number[] = []
  ) => {
    try {
      const callSession = await callsApi.initiateCall(chatRoomId, callType, participantIds);
      setCurrentCall(callSession);
      setIsVideoEnabled(callType === 'video');
    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  };

  const joinCall = async (roomId: string) => {
    try {
      const callSession = await callsApi.joinCall(roomId);
      setCurrentCall(callSession);
    } catch (error) {
      console.error('Error joining call:', error);
      throw error;
    }
  };

  const endCall = async () => {
    if (!currentCall) return;

    try {
      await callsApi.leaveCall(currentCall.room_id);
      setCurrentCall(null);
      setIsMuted(false);
      setIsVideoEnabled(true);
    } catch (error) {
      console.error('Error ending call:', error);
      // End call locally even if API call fails
      setCurrentCall(null);
      setIsMuted(false);
      setIsVideoEnabled(true);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // Update participant settings
    if (currentCall) {
      callsApi.updateParticipantSettings(currentCall.room_id, {
        is_muted: !isMuted
      }).catch(console.error);
    }
  };

  const toggleVideo = () => {
    setIsVideoEnabled(!isVideoEnabled);
    // Update participant settings
    if (currentCall) {
      callsApi.updateParticipantSettings(currentCall.room_id, {
        is_video_enabled: !isVideoEnabled
      }).catch(console.error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentCall) {
        callsApi.leaveCall(currentCall.room_id).catch(console.error);
      }
    };
  }, []);

  const contextValue: CallContextType = {
    currentCall,
    isInCall,
    startCall,
    joinCall,
    endCall,
    toggleMute,
    toggleVideo,
    isMuted,
    isVideoEnabled
  };

  return (
    <CallContext.Provider value={contextValue}>
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, MessageCircle, Users, Phone, Video, MoreVertical } from 'lucide-react';
import { useSocket, useMessagingSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useCall } from '../contexts/CallContext';
import VideoCall from '../components/VideoCall';
import { messagesApi } from '../services/api';
import { ChatRoom, Message, User } from '../types';

const Messages: React.FC = () => {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [contacts, setContacts] = useState<User[]>([]);
  const [typingUsers, setTypingUsers] = useState<{ [roomId: number]: { userId: number; username: string }[] }>({});

  const { user } = useAuth();
  const { isConnected, joinRoom, leaveRoom, sendMessage, startTyping, stopTyping } = useSocket();
  const { showNotification } = useNotifications();
  const { currentCall, isInCall, startCall, endCall } = useCall();

  // Handle real-time messaging events
  const handleNewMessage = useCallback((message: Message) => {
    if (selectedRoom && message.chat_room_id === selectedRoom.id) {
      setMessages(prev => [...prev, message]);
    }
    
    // Update chat room's last message
    setChatRooms(prev => prev.map(room => 
      room.id === message.chat_room_id 
        ? { ...room, last_message: message, last_message_at: message.created_at }
        : room
    ));

    // Show notification for new messages (only if not from current user and not in current room)
    if (message.sender_id !== user?.id && (!selectedRoom || message.chat_room_id !== selectedRoom.id)) {
      const senderName = message.sender?.first_name 
        ? `${message.sender.first_name} ${message.sender.last_name || ''}`.trim()
        : message.sender?.username || 'Someone';
      
      showNotification(
        `New message from ${senderName}`,
        message.content,
        {
          onClick: () => {
            // Focus window and navigate to the chat room
            window.focus();
            const room = chatRooms.find(r => r.id === message.chat_room_id);
            if (room) {
              setSelectedRoom(room);
            }
          }
        }
      );
    }
  }, [selectedRoom, user?.id, showNotification, chatRooms]);

  const handleNewChatRoom = useCallback((chatRoom: ChatRoom) => {
    setChatRooms(prev => [chatRoom, ...prev]);
  }, []);

  const handleUserTyping = useCallback((data: { userId: number; username: string; roomId: number }) => {
    if (data.userId === user?.id) return; // Don't show own typing
    
    setTypingUsers(prev => ({
      ...prev,
      [data.roomId]: [
        ...(prev[data.roomId] || []).filter(u => u.userId !== data.userId),
        { userId: data.userId, username: data.username }
      ]
    }));
  }, [user?.id]);

  const handleUserStoppedTyping = useCallback((data: { userId: number; roomId: number }) => {
    setTypingUsers(prev => ({
      ...prev,
      [data.roomId]: (prev[data.roomId] || []).filter(u => u.userId !== data.userId)
    }));
  }, []);

  // Register socket event handlers
  useMessagingSocket({
    onNewMessage: handleNewMessage,
    onNewChatRoom: handleNewChatRoom,
    onUserTyping: handleUserTyping,
    onUserStoppedTyping: handleUserStoppedTyping,
    onError: (error) => console.error('Messaging error:', error)
  });

  useEffect(() => {
    fetchChatRooms();
    fetchContacts();
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom.id);
      joinRoom(selectedRoom.id);
      
      return () => {
        leaveRoom(selectedRoom.id);
      };
    }
  }, [selectedRoom, joinRoom, leaveRoom]);

  const fetchChatRooms = async () => {
    try {
      const rooms = await messagesApi.getRooms();
      setChatRooms(rooms);
    } catch (error) {
      console.error('Error fetching chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (roomId: number) => {
    try {
      const roomMessages = await messagesApi.getMessages(roomId);
      setMessages(roomMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      const userContacts = await messagesApi.getContacts();
      setContacts(userContacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedRoom) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    
    try {
      // Send via API directly (more reliable than WebSocket)
      const newMsg = await messagesApi.sendMessage(selectedRoom.id, {
        content: messageContent,
        message_type: 'text'
      });
      
      // Add to local state immediately
      setMessages(prev => [...prev, newMsg]);
      
      // Try WebSocket for real-time delivery to others (optional)
      if (isConnected) {
        sendMessage(selectedRoom.id, messageContent);
        stopTyping(selectedRoom.id);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
      setNewMessage(messageContent); // Restore message on error
    }
  };

  const handleTyping = () => {
    if (selectedRoom) {
      startTyping(selectedRoom.id);
      
      // Auto-stop typing after 3 seconds of inactivity
      setTimeout(() => stopTyping(selectedRoom.id), 3000);
    }
  };

  const createDirectMessage = async (contactId: number) => {
    try {
      const room = await messagesApi.createDirectMessage(contactId);
      setChatRooms(prev => [room, ...prev]);
      setSelectedRoom(room);
      setShowNewChatModal(false);
    } catch (error) {
      console.error('Error creating direct message:', error);
    }
  };

  const filteredRooms = chatRooms.filter(room => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      room.name?.toLowerCase().includes(searchLower) ||
      room.last_message?.content?.toLowerCase().includes(searchLower)
    );
  });

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffHours < 1) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString();
    }
  };

  const getRoomDisplayName = (room: ChatRoom) => {
    if (room.type === 'direct') {
      // For direct messages, show the other participant's name
      const otherParticipant = room.participants?.find(p => p.user_id !== user?.id);
      if (otherParticipant?.user) {
        return otherParticipant.user.first_name && otherParticipant.user.last_name
          ? `${otherParticipant.user.first_name} ${otherParticipant.user.last_name}`
          : otherParticipant.user.username;
      }
      return 'Direct Message';
    }
    return room.name || 'Group Chat';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading messages...</div>
      </div>
    );
  }

  return (
    <>
      {/* Video Call Overlay */}
      {isInCall && currentCall && (
        <VideoCall
          roomId={currentCall.room_id}
          callType={currentCall.call_type}
          onEndCall={endCall}
          chatRoomId={currentCall.chat_room_id}
        />
      )}
      
      <div className="flex h-full bg-white rounded-lg shadow">
      {/* Chat Rooms Sidebar */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900">Messages</h1>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Connection Status */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center text-sm">
            <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            {isConnected ? 'Real-time connected' : 'Basic messaging active'}
          </div>
        </div>

        {/* Chat Rooms List */}
        <div className="flex-1 overflow-y-auto">
          {filteredRooms.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No conversations yet</p>
              <p className="text-sm">Start a new conversation!</p>
            </div>
          ) : (
            filteredRooms.map((room) => (
              <div
                key={room.id}
                onClick={() => setSelectedRoom(room)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedRoom?.id === room.id ? 'bg-primary-50 border-primary-200' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {room.type === 'direct' ? (
                      <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-medium">
                        {getRoomDisplayName(room).charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white">
                        <Users className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {getRoomDisplayName(room)}
                      </h3>
                      {room.last_message_at && (
                        <span className="text-xs text-gray-500">
                          {formatMessageTime(room.last_message_at)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500 truncate">
                        {room.last_message?.content || 'No messages yet'}
                      </p>
                      {room.unread_count && room.unread_count > 0 && (
                        <span className="ml-2 bg-primary-600 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                          {room.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {selectedRoom.type === 'direct' ? (
                      <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-medium">
                        {getRoomDisplayName(selectedRoom).charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white">
                        <Users className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">
                      {selectedRoom.type === 'direct' 
                        ? `Talking to ${getRoomDisplayName(selectedRoom)}`
                        : getRoomDisplayName(selectedRoom)
                      }
                    </h2>
                    <p className="text-sm text-gray-500">
                      {selectedRoom.type === 'direct' 
                        ? 'Direct message'
                        : `${selectedRoom.participant_count} participants`
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => startCall(selectedRoom.id, 'audio')}
                    disabled={isInCall}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Start audio call"
                  >
                    <Phone className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => startCall(selectedRoom.id, 'video')}
                    disabled={isInCall}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Start video call"
                  >
                    <Video className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => alert('More options coming soon!')}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                    title="More options"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.sender_id === user?.id
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}>
                    {message.sender_id !== user?.id && (
                      <p className="text-xs font-medium mb-1 opacity-75">
                        {message.sender?.first_name || message.sender?.username}
                      </p>
                    )}
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.sender_id === user?.id ? 'text-primary-200' : 'text-gray-500'
                    }`}>
                      {formatMessageTime(message.created_at)}
                    </p>
                  </div>
                </div>
              ))}
              
              {/* Typing indicators */}
              {typingUsers[selectedRoom.id] && typingUsers[selectedRoom.id].length > 0 && (
                <div className="flex justify-start">
                  <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-lg bg-gray-100">
                    <p className="text-sm text-gray-600">
                      {typingUsers[selectedRoom.id].map(u => u.username).join(', ')} {
                        typingUsers[selectedRoom.id].length === 1 ? 'is' : 'are'
                      } typing...
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white">
              <div className="flex space-x-4">
                                  <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  placeholder="Type a message..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </div>
            </form>
          </>
        ) : (
          /* No Room Selected */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No conversation selected</h3>
              <p className="text-gray-500">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Start New Conversation</h3>
            
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => createDirectMessage(contact.id)}
                  className="w-full flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-medium">
                    {(contact.first_name || contact.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {contact.first_name && contact.last_name 
                        ? `${contact.first_name} ${contact.last_name}`
                        : contact.username}
                    </p>
                    <p className="text-sm text-gray-500">{contact.email}</p>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowNewChatModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default Messages;

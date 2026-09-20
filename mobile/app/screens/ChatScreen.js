import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import theme from '../theme';
import ScreenWrapper from '../components/ScreenWrapper';
import EmptyState from '../components/EmptyState';
import { useChatOptional } from '../../context/ChatContext';
import { formatShortTime } from '../utils/ratings';
import { compressImage, resolveMediaUrl } from '../../utils/image';
import { getOrCreateConversation, sendSupportMessage, uploadChatImage } from '../../services/chatApi';
import { mapFundiItem } from '../../services/fundisApi';
import { useLocation } from '../../context/LocationContext';
import { useLanguage } from '../i18n/LanguageContext';

const SENT_BUBBLE = '#3A2A0F';
const RECEIVED_BUBBLE = '#202020';

function formatDateSeparator(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = (now - d) / 86400000;
  if (diff < 1) return 'Today';
  if (diff < 2) return 'Yesterday';
  return d.toLocaleDateString('en-UG', { weekday: 'long', month: 'long', day: 'numeric' });
}

// Deterministic keyboard height on Android. Unlike KeyboardAvoidingView's
// 'height' behavior, this only reacts to real keyboard show/hide events, so the
// input bar never jumps on mount.
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

function ConversationItem({ item, userId, onPress }) {
  const { t } = useLanguage();
  const other = item.participants?.find((p) => p._id !== userId);
  const name = other?.name || 'Unknown';
  const isLastFromMe = item.lastSenderId?._id === userId || item.lastSenderId === userId;
  const time = item.lastMessageAt ? t(formatShortTime(item.lastMessageAt)) : '';
  const initial = name.charAt(0).toUpperCase();

  return (
    <TouchableOpacity style={styles.convItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.convAvatar}>
        <View style={styles.convAvatarInner}>
          <Text style={styles.convAvatarText}>{initial}</Text>
        </View>
      </View>
      <View style={styles.convContent}>
        <View style={styles.convTop}>
          <Text style={styles.convName} numberOfLines={1}>{name}</Text>
          <Text style={styles.convTime}>{time}</Text>
        </View>
        <View style={styles.convBottom}>
          {isLastFromMe ? (
            <Ionicons name="checkmark-done" size={14} color={theme.colors.muted} style={{ marginRight: 3 }} />
          ) : null}
          <Text style={styles.convLast} numberOfLines={1}>
            {item.lastMessage || t('No messages yet')}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function DateSeparator({ date }) {
  const { t } = useLanguage();
  return (
    <View style={styles.dateSepRow}>
      <View style={styles.dateSepLine} />
      <Text style={styles.dateSepText}>{t(formatDateSeparator(date))}</Text>
      <View style={styles.dateSepLine} />
    </View>
  );
}

function MessageBubble({ msg, isOwn, showDateSep }) {
  const { t } = useLanguage();
  const time = msg.createdAt ? t(formatShortTime(msg.createdAt)) : '';
  const imgUrl = msg.imageUrl ? resolveMediaUrl(msg.imageUrl) : null;
  return (
    <>
      {showDateSep ? <DateSeparator date={msg.createdAt} /> : null}
      <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          {isOwn ? <View style={styles.tailOwn} /> : <View style={styles.tailOther} />}
          {imgUrl ? (
            <Image source={{ uri: imgUrl }} style={styles.bubbleImage} resizeMode="cover" />
          ) : null}
          {msg.text ? (
            <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>{msg.text}</Text>
          ) : null}
          <View style={styles.bubbleMeta}>
            <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>{time}</Text>
            {isOwn ? (
              <Ionicons name="checkmark-done" size={12} color={styles.bubbleTimeOwn.color} style={{ marginLeft: 3 }} />
            ) : null}
          </View>
        </View>
      </View>
    </>
  );
}

function TypingDots() {
  const [dot, setDot] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDot((p) => (p + 1) % 4), 400);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.typingRow}>
      <View style={styles.typingBubble}>
        <Text style={styles.typingDots}>{'.'.repeat(dot)}{'\u00A0'.repeat(3 - dot)}</Text>
      </View>
    </View>
  );
}

function ConversationView({ conversationId, userId, onBack, inTab }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { messages, loading, sendTextMessage, sendImageMessage, typingUsers } = useChatOptional();
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const flatRef = useRef(null);
  const typingUserId = typingUsers?.[conversationId];
  const kbHeight = useKeyboardHeight();

  useEffect(() => {
    if (messages?.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [messages?.length]);

  const messagesWithDates = useMemo(() => {
    if (!messages?.length) return [];
    let lastDate = '';
    return messages.map((m) => {
      const d = m.createdAt ? new Date(m.createdAt).toDateString() : '';
      const show = d && d !== lastDate;
      lastDate = d;
      return { ...m, _showDate: show };
    });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendTextMessage(conversationId, input.trim());
    setInput('');
  };

  const handlePickImage = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('Permission needed'), t('Allow access to your photo library to send images.'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.length) return;
    const uri = result.assets[0].uri;
    setUploading(true);
    try {
      const compressed = await compressImage(uri);
      await sendImageMessage(conversationId, compressed);
    } catch (e) {
      Alert.alert(t('Error'), t('Failed to send image. Please try again.'));
    } finally {
      setUploading(false);
    }
  }, [conversationId, sendImageMessage]);

  const renderMessage = useCallback(({ item }) => (
    <MessageBubble
      msg={item}
      isOwn={item.senderId?._id === userId || item.senderId === userId}
      showDateSep={item._showDate}
    />
  ), [userId]);

  return (
    <View style={styles.conversationContainer}>
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} style={[styles.headerBtn, styles.headerBackBtn]}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.white} />
        </TouchableOpacity>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderTitle}>{t('Chat')}</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {loading && messages.length === 0 ? (
        <View style={styles.chatList}>
          <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 40 }} />
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={messagesWithDates}
          keyExtractor={(item) => item._id || String(Math.random())}
          style={styles.chatList}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title={t('No messages')}
              message={t('Send a message to start the conversation.')}
            />
          }
          renderItem={renderMessage}
        />
      )}

      {typingUserId && typingUserId !== userId ? <TypingDots /> : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View
          style={[
            styles.inputRow,
            {
              paddingBottom: inTab ? 8 : Math.max(insets.bottom, 4),
              marginBottom: Platform.OS === 'android' ? kbHeight : 0,
            },
          ]}
        >
          <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <Ionicons name="add-circle-outline" size={26} color={theme.colors.mutedDark} />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('Message')}
            placeholderTextColor={theme.colors.mutedDark}
          />
          {input.trim() ? (
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <Ionicons name="send" size={18} color={theme.colors.textDark} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.micBtn}>
              <Ionicons name="mic-outline" size={22} color={theme.colors.mutedDark} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const SUGGESTED_TOPICS = [
  { icon: 'calendar-outline', label: 'How to book', prompt: 'How do I book a fundi?' },
  { icon: 'card-outline', label: 'Payments', prompt: 'How do payments work?' },
  { icon: 'time-outline', label: 'Response time', prompt: 'How long do fundis take to respond?' },
  { icon: 'shield-checkmark-outline', label: 'Safety & trust', prompt: 'How do I stay safe on Ufundi?' },
  { icon: 'briefcase-outline', label: 'Become a fundi', prompt: 'How do I become a fundi?' },
  { icon: 'call-outline', label: 'Talk to a human', prompt: 'I want to talk to a human agent.' },
];

const SUPPORT_BOT_GRADIENT = ['#FFC94D', '#E5A600'];

function SupportBotAvatar({ size = 30 }) {
  return (
    <View style={[styles.botAvatarWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient
        colors={SUPPORT_BOT_GRADIENT}
        style={[styles.botAvatarInner, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Ionicons name="sparkles" size={Math.round(size * 0.5)} color={theme.colors.textDark} />
      </LinearGradient>
    </View>
  );
}

function SupportTypingDots() {
  const [dot, setDot] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDot((p) => (p + 1) % 4), 380);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={[styles.supportRow, styles.supportRowBot]}>
      <SupportBotAvatar />
      <View style={[styles.supportBubble, styles.supportBubbleBot, styles.supportTypingBubble]}>
        <View style={styles.supportDotsRow}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.supportDot,
                { opacity: i < dot ? 1 : 0.25 },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

export function SupportChat({ userId, inTab, onNavigate }) {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { coords } = useLocation();
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: t("Hi! I'm Ufundi Support 👋. I can help you book a fundi, understand pricing and payments, or answer any question about the platform. You can also upload a photo of a problem (like a leaking pipe or broken socket) and I'll find a nearby fundi who can fix it."),
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const flatRef = useRef(null);
  const kbHeight = useKeyboardHeight();

  useEffect(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages.length, loading, kbHeight]);

  const showSuggestions = messages.length === 1 && !loading;

  const buildHistory = () =>
    messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text || (m.image ? 'I uploaded a photo of a problem.' : ''),
    }));

  const handleSend = async (override) => {
    const text = (override ?? input).trim();
    if (!text || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text, time: new Date() }]);
    setLoading(true);

    try {
      const { data } = await sendSupportMessage(text, buildHistory(), {
        lat: coords?.lat,
        lng: coords?.lng,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: data?.reply || t('Sorry, I could not process your request. Please try again.'),
          recommendation: data?.recommendation || null,
          time: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: t('Sorry, I could not process your request. Please try again.'), time: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    if (uploading || loading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('Permission needed'), t('Allow access to your photo library to share a photo of the problem.'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets?.length) return;
    await analyzeImage(result.assets[0].uri);
  };

  const analyzeImage = async (uri) => {
    setUploading(true);
    try {
      const compressed = await compressImage(uri);
      const formData = new FormData();
      formData.append('image', {
        uri: compressed,
        name: 'problem.jpg',
        type: 'image/jpeg',
      });
      const { data } = await uploadChatImage(formData);
      const imageUrl = data?.url;

      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          text: t("Here's a photo of the problem."),
          image: compressed,
          time: new Date(),
        },
      ]);
      setLoading(true);

      const res = await sendSupportMessage(
        'Please analyze this photo and recommend a nearby fundi who can fix it.',
        buildHistory(),
        { imageUrl, lat: coords?.lat, lng: coords?.lng },
      );

      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          text: res?.data?.reply || t('I could not analyze that photo right now. Please describe the problem in words.'),
          recommendation: res?.data?.recommendation || null,
          time: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', text: t('Sorry, I could not upload that photo. Please try again or describe the problem.'), time: new Date() },
      ]);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const renderMsg = useCallback(({ item }) => {
    const isBot = item.role === 'bot';
    return (
      <View style={[styles.supportRow, isBot ? styles.supportRowBot : styles.supportRowUser]}>
        {isBot ? <SupportBotAvatar /> : null}
        <View
          style={[
            styles.supportBubble,
            isBot ? styles.supportBubbleBot : styles.supportBubbleUser,
            item.image && styles.supportBubbleImage,
          ]}
        >
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.supportImage} resizeMode="cover" />
          ) : null}
          {item.text ? <Text style={[styles.supportText, !isBot && styles.supportTextUser]}>{item.text}</Text> : null}
          {item.recommendation?.fundis?.length ? (
            <View style={styles.recWrap}>
              <Text style={styles.recTitle}>
                {t('{{type}} near you', {
                  type: t(
                    item.recommendation.category === 'plumber'
                      ? 'Plumbers'
                      : item.recommendation.category === 'electrician'
                        ? 'Electricians'
                        : item.recommendation.category === 'carpenter'
                          ? 'Carpenters'
                          : item.recommendation.category === 'painter'
                            ? 'Painters'
                            : 'Fundis',
                  ),
                })}
              </Text>
              {item.recommendation.fundis.map((f) => {
                const artisan = mapFundiItem(f);
                return (
                  <TouchableOpacity
                    key={f._id}
                    style={styles.recCard}
                    activeOpacity={0.85}
                    onPress={() => onNavigate?.('artisan', { artisan })}
                  >
                    <View style={styles.recCardTop}>
                      <View style={styles.recAvatar}>
                        <Text style={styles.recAvatarText}>{(artisan.name || 'F')[0]}</Text>
                      </View>
                      <View style={styles.recInfo}>
                        <Text style={styles.recName} numberOfLines={1}>{artisan.name}</Text>
                        <Text style={styles.recRole} numberOfLines={1}>{artisan.role}</Text>
                      </View>
                      <View style={styles.recMeta}>
                        <View style={styles.recRating}>
                          <Ionicons name="star" size={12} color={theme.colors.accent} />
                          <Text style={styles.recRatingText}>
                            {artisan.rating > 0 ? artisan.rating.toFixed(1) : t('New')}
                          </Text>
                        </View>
                        {artisan.distanceKm != null ? (
                          <Text style={styles.recDistance}>{t('{{distance}} km away', { distance: artisan.distanceKm.toFixed(1) })}</Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.recCardFooter}>
                      {artisan.verified ? (
                        <View style={styles.verifiedBadge}>
                          <Ionicons name="shield-checkmark" size={12} color={theme.colors.green} />
                          <Text style={styles.verifiedText}>{t('Verified')}</Text>
                        </View>
                      ) : null}
                      <Text style={styles.recView}>{t('View profile ›')}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              {item.recommendation.category ? (
                <TouchableOpacity
                  style={styles.recBrowseBtn}
                  activeOpacity={0.85}
                  onPress={() => onNavigate?.('browse', { category: item.recommendation.category })}
                >
                  <Ionicons name="search" size={15} color={theme.colors.textDark} />
                  <Text style={styles.recBrowseText}>{t('Browse all {{category}}s', { category: t(item.recommendation.category) })}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          <Text style={[styles.supportTime, !isBot && styles.supportTimeUser]}>
            {item.time ? t(formatShortTime(item.time)) : ''}
          </Text>
        </View>
      </View>
    );
  }, [onNavigate, t]);

  const renderSuggestions = () => (
    <View style={styles.suggestionsWrap}>
      <Text style={styles.suggestionsTitle}>{t('Try asking about')}</Text>
      <View style={styles.suggestionsGrid}>
        {SUGGESTED_TOPICS.map((topic) => (
          <TouchableOpacity
            key={topic.label}
            style={styles.suggestionChip}
            onPress={() => handleSend(topic.prompt)}
            activeOpacity={0.85}
          >
            <Ionicons name={topic.icon} size={15} color={theme.colors.accent} />
            <Text style={styles.suggestionText}>{t(topic.label)}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.suggestionChip, styles.suggestionChipPhoto]}
          onPress={handlePickImage}
          activeOpacity={0.85}
        >
          <Ionicons name="camera-outline" size={15} color={theme.colors.accent} />
          <Text style={styles.suggestionText}>{t('Upload a photo')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.conversationContainer}>
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        style={styles.chatList}
        contentContainerStyle={[
          styles.messageList,
          { paddingBottom: (Platform.OS === 'ios' ? kbHeight + 90 : 0) + 8 },
        ]}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        renderItem={renderMsg}
        ListFooterComponent={showSuggestions ? renderSuggestions() : null}
      />

      {loading ? <SupportTypingDots /> : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? (inTab ? 90 : 0) : 0}
      >
        <View
          style={[
            styles.inputRow,
            {
              paddingBottom: inTab ? 8 : Math.max(insets.bottom, 4),
              marginBottom: Platform.OS === 'android' ? kbHeight : 0,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={handlePickImage}
            disabled={uploading || loading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <Ionicons name="camera-outline" size={22} color={theme.colors.mutedDark} />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('Ask me anything...')}
            placeholderTextColor={theme.colors.mutedDark}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
          />
          {input.trim() && !loading ? (
            <TouchableOpacity style={styles.supportSendBtn} onPress={() => handleSend()} activeOpacity={0.85}>
              <Ionicons name="send" size={18} color={theme.colors.textDark} />
            </TouchableOpacity>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function ChatScreen({ onNavigate, userRole, userId, targetUserId, inTab }) {
  const { t } = useLanguage();
  const chatCtx = useChatOptional();
  const [tab, setTab] = useState('messages');
  const [view, setView] = useState('list');
  const [activeConvId, setActiveConvId] = useState(null);

  const conversations = chatCtx?.conversations || [];
  const refreshConversations = chatCtx?.refreshConversations;
  const openConversation = chatCtx?.openConversation;

  useEffect(() => {
    refreshConversations?.();
  }, [refreshConversations]);

  useEffect(() => {
    if (!targetUserId || targetUserId === userId) return;
    (async () => {
      try {
        const { data } = await getOrCreateConversation(null, targetUserId);
        if (data?.conversation?._id) {
          setActiveConvId(data.conversation._id);
          setView('conversation');
          openConversation?.(data.conversation._id);
        }
      } catch (e) {
        // fall back to conversation list
      }
    })();
  }, [targetUserId, userId, openConversation]);

  const handleOpenConversation = (convId) => {
    setActiveConvId(convId);
    setView('conversation');
    openConversation?.(convId);
  };

  const handleBack = () => {
    if (view === 'conversation') {
      setView('list');
      setActiveConvId(null);
    } else {
      onNavigate?.('bookings');
    }
  };

  if (view === 'conversation' && activeConvId) {
    return (
      <ScreenWrapper style={styles.safe} edges={['top', 'left', 'right']}>
        <ConversationView
          conversationId={activeConvId}
          userId={userId}
          inTab={inTab}
          onBack={() => setView('list')}
        />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{t('Messages')}</Text>
        {userRole !== 'fundi' && (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setTab(tab === 'messages' ? 'support' : 'messages')}
          >
            <Ionicons
              name={tab === 'support' ? 'chatbubbles' : 'headset-outline'}
              size={22}
              color={theme.colors.accent}
            />
          </TouchableOpacity>
        )}
      </View>

      {tab === 'messages' ? (
        conversations.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title={t('No messages yet')}
            message={t('Start a conversation from an active booking.')}
          />
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item._id}
            style={styles.chatList}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => (
              <ConversationItem
                item={item}
                userId={userId}
                onPress={() => handleOpenConversation(item._id)}
              />
            )}
          />
        )
      ) : userRole !== 'fundi' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.supportHeader}>
            <Ionicons name="headset" size={20} color={theme.colors.accent} />
            <Text style={styles.supportHeaderText}>{t('Ufundi Support')}</Text>
          </View>
          <SupportChat userId={userId} inTab={inTab} onNavigate={onNavigate} />
        </View>
      ) : null}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.black },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.panel,
  },
  headerTitle: { color: theme.colors.white, fontWeight: '700', fontSize: 18 },
  headerBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center' },
  headerBackBtn: { backgroundColor: theme.colors.input },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.colors.black,
  },
  convAvatar: { marginRight: 12 },
  convAvatarInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  convAvatarText: { color: theme.colors.textDark, fontWeight: '700', fontSize: 18 },
  convContent: { flex: 1 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  convName: { color: theme.colors.white, fontWeight: '600', fontSize: 15, flex: 1 },
  convTime: { color: theme.colors.mutedDark, fontSize: 11, marginLeft: 8 },
  convBottom: { flexDirection: 'row', alignItems: 'center' },
  convLast: { color: theme.colors.muted, fontSize: 13, flex: 1 },
  conversationContainer: { flex: 1, backgroundColor: theme.colors.black },
  chatList: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: theme.colors.panel,
  },
  chatHeaderInfo: { flex: 1, marginLeft: 8 },
  chatHeaderTitle: { color: theme.colors.white, fontWeight: '600', fontSize: 16 },
  messageList: { paddingHorizontal: 8, paddingVertical: 8, flexGrow: 1 },
  dateSepRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, marginHorizontal: 40 },
  dateSepLine: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  dateSepText: { color: theme.colors.mutedDark, fontSize: 11, marginHorizontal: 10, fontWeight: '500' },
  bubbleRow: { marginBottom: 2, flexDirection: 'row', paddingHorizontal: 4 },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    position: 'relative',
  },
  bubbleOwn: {
    backgroundColor: SENT_BUBBLE,
    borderTopRightRadius: 2,
  },
  bubbleOther: {
    backgroundColor: RECEIVED_BUBBLE,
    borderTopLeftRadius: 2,
  },
  tailOwn: {
    position: 'absolute',
    top: 0,
    right: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: SENT_BUBBLE,
    borderTopColor: 'transparent',
  },
  tailOther: {
    position: 'absolute',
    top: 0,
    left: -6,
    width: 0,
    height: 0,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderRightColor: RECEIVED_BUBBLE,
    borderTopColor: 'transparent',
  },
  bubbleImage: {
    width: 200,
    height: 160,
    borderRadius: 6,
    marginBottom: 4,
  },
  bubbleText: { color: theme.colors.white, fontSize: 14, lineHeight: 20 },
  bubbleTextOwn: { color: theme.colors.white },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2 },
  bubbleTime: { color: 'rgba(255,255,255,0.5)', fontSize: 10 },
  bubbleTimeOwn: { color: 'rgba(255,255,255,0.6)' },
  typingRow: { paddingHorizontal: 12, paddingBottom: 4 },
  typingBubble: {
    alignSelf: 'flex-start',
    backgroundColor: RECEIVED_BUBBLE,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  typingDots: { color: theme.colors.white, fontSize: 18, lineHeight: 16, letterSpacing: 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: theme.colors.panel,
  },
  attachBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.glass, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  input: {
    flex: 1,
    backgroundColor: theme.colors.input,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 9,
    color: theme.colors.white,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.glass,
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  supportHeaderText: { color: theme.colors.accent, fontWeight: '600', fontSize: 14 },

  /* Support chat — premium bot */
  supportRow: { marginBottom: 10, flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 4 },
  supportRowBot: { justifyContent: 'flex-start' },
  supportRowUser: { justifyContent: 'flex-end' },
  botAvatarWrap: {
    marginRight: 8,
    backgroundColor: 'rgba(255,184,0,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  botAvatarInner: { justifyContent: 'center', alignItems: 'center' },
  supportBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  supportBubbleBot: {
    backgroundColor: theme.colors.input,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.14)',
    borderTopLeftRadius: 4,
  },
  supportBubbleUser: {
    backgroundColor: theme.colors.accent,
    borderTopRightRadius: 4,
    ...theme.elevation.sm,
  },
  supportBubbleImage: {
    maxWidth: '72%',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  supportImage: {
    width: 200,
    height: 140,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: theme.colors.black,
  },
  supportText: { color: theme.colors.white, fontSize: 14, lineHeight: 20 },
  supportTextUser: { color: theme.colors.textDark, fontWeight: '600' },
  supportTime: { color: theme.colors.mutedDark, fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  supportTimeUser: { color: 'rgba(11,11,11,0.55)', fontWeight: '700' },
  supportTypingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  supportDotsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  supportDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: theme.colors.accent,
  },
  supportSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    ...theme.elevation.sm,
  },

  /* Suggested topics */
  suggestionsWrap: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 8 },
  suggestionsTitle: { color: theme.colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 10 },
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,184,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.22)',
  },
  suggestionText: { color: theme.colors.white, fontSize: 12, fontWeight: '700' },
  suggestionChipPhoto: {
    backgroundColor: 'rgba(255,184,0,0.16)',
    borderColor: 'rgba(255,184,0,0.4)',
  },

  /* Fundi recommendation cards */
  recWrap: { marginTop: 10, gap: 8 },
  recTitle: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  recCard: {
    backgroundColor: theme.colors.panel,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.18)',
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  recCardTop: { flexDirection: 'row', alignItems: 'center' },
  recAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  recAvatarText: { color: theme.colors.textDark, fontSize: 16, fontWeight: '800' },
  recInfo: { flex: 1, marginRight: 8 },
  recName: { color: theme.colors.white, fontSize: 14, fontWeight: '700' },
  recRole: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
  recMeta: { alignItems: 'flex-end', gap: 3 },
  recRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recRatingText: { color: theme.colors.white, fontSize: 13, fontWeight: '700' },
  recDistance: { color: theme.colors.muted, fontSize: 11 },
  recCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { color: theme.colors.green, fontSize: 11, fontWeight: '700' },
  recView: { color: theme.colors.accent, fontSize: 12, fontWeight: '700' },
  recBrowseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 2,
  },
  recBrowseText: { color: theme.colors.textDark, fontSize: 13, fontWeight: '800' },
});
